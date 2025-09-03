import { CampaignService } from './campaignService';
import { StoredRecommendationService } from './storedRecommendationService';
import { MultiAIService } from './multiAIService';
import { GoogleAdsService } from './googleAdsService';
import { db } from '../db';
import { campaigns, recommendations, auditLogs, users, googleAdsAccounts, userSettings } from '@shared/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

export class DailySyncService {
  private campaignService: CampaignService;
  private storedRecommendationService: StoredRecommendationService;
  private multiAIService: MultiAIService;
  private googleAdsService: GoogleAdsService | null = null;

  constructor() {
    this.campaignService = new CampaignService();
    this.storedRecommendationService = new StoredRecommendationService();
    this.multiAIService = new MultiAIService();
  }

  /**
   * Main daily sync process - runs once per day
   */
  async performDailySync(): Promise<void> {
    console.log('=== STARTING DAILY SYNC ===', new Date().toISOString());
    
    try {
      // Get all admin users who have connected Google Ads accounts
      const adminUsers = await this.getAdminUsersWithGoogleAds();
      console.log(`Found ${adminUsers.length} admin users with Google Ads connections`);

      for (const adminUser of adminUsers) {
        await this.syncUserCampaigns(adminUser);
        // Temporarily disabled AI recommendations to fix sync issues
        // await this.generateAIRecommendations(adminUser);
      }

      console.log('=== DAILY SYNC COMPLETED ===', new Date().toISOString());
    } catch (error) {
      console.error('=== DAILY SYNC FAILED ===', error);
      throw error;
    }
  }

  /**
   * Get all admin users who have active Google Ads connections
   */
  private async getAdminUsersWithGoogleAds() {
    const adminUsersWithAds = await db
      .select({
        userId: users.id,
        username: users.username,
        email: users.email,
        customerId: googleAdsAccounts.customerId,
        customerName: googleAdsAccounts.customerName,
        refreshToken: googleAdsAccounts.refreshToken
      })
      .from(users)
      .innerJoin(googleAdsAccounts, eq(googleAdsAccounts.adminUserId, users.id))
      .where(
        and(
          eq(users.role, 'admin'),
          eq(users.isActive, true),
          eq(googleAdsAccounts.isActive, true)
        )
      );

    return adminUsersWithAds;
  }

  /**
   * Sync campaigns for a specific admin user
   */
  private async syncUserCampaigns(adminUser: any): Promise<void> {
    console.log(`--- Syncing campaigns for admin user: ${adminUser.username} ---`);
    
    try {
      // Get user's selected Google Ads accounts
      const userSettingsData = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, adminUser.userId))
        .limit(1);

      const selectedAccounts = userSettingsData[0]?.selectedGoogleAdsAccounts || [];
      
      if (selectedAccounts.length === 0) {
        console.log(`No selected accounts for user ${adminUser.username}, skipping sync`);
        return;
      }

      // Initialize Google Ads Service with this user's credentials
      this.googleAdsService = new GoogleAdsService({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refreshToken: adminUser.refreshToken,
        customerId: adminUser.customerId,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
      });

      // Fetch fresh campaign data from Google Ads API
      console.log(`Fetching campaigns for accounts: ${selectedAccounts}`);
      const freshCampaigns = await this.googleAdsService.getCampaigns(selectedAccounts);

      // Update database with fresh data
      console.log(`Updating ${freshCampaigns.length} campaigns in database`);
      await this.updateCampaignsInDatabase(adminUser.userId, freshCampaigns);

      console.log(`✓ Successfully synced ${freshCampaigns.length} campaigns for ${adminUser.username}`);
    } catch (error) {
      console.error(`✗ Failed to sync campaigns for ${adminUser.username}:`, error);
      // Log error but continue with other users
      await this.logSyncError(adminUser.userId, 'campaign_sync', error);
    }
  }

  /**
   * Update campaigns in database with fresh Google Ads data
   */
  private async updateCampaignsInDatabase(userId: string, googleAdsCampaigns: any[]): Promise<void> {
    try {
      for (const gaCampaign of googleAdsCampaigns) {
        // Check if campaign already exists
        const existingCampaign = await db
          .select()
          .from(campaigns)
          .where(
            and(
              eq(campaigns.googleAdsCampaignId, gaCampaign.id),
              eq(campaigns.userId, userId)
            )
          )
          .limit(1);

        if (existingCampaign.length > 0) {
          // Update existing campaign with fresh data
          await db
            .update(campaigns)
          .set({
            name: gaCampaign.name,
            status: gaCampaign.status,
            type: gaCampaign.type,
            dailyBudget: gaCampaign.budget ?? 0,
            impressions7d: Math.round(gaCampaign.impressions || 0),
            clicks7d: Math.round(gaCampaign.clicks || 0),
            conversions7d: Math.round(gaCampaign.conversions || 0),
            conversionValue7d: gaCampaign.conversionsValue || 0,
            spend7d: gaCampaign.cost || 0,
            ctr7d: gaCampaign.ctr || 0,
            avgCpc7d: gaCampaign.avgCpc || 0,
            conversionRate7d: gaCampaign.conversionRate || 0,
            actualCpa: gaCampaign.actualCpa ?? null,
            actualRoas: gaCampaign.actualRoas ?? null,
            updatedAt: new Date()
          })
          .where(eq(campaigns.id, existingCampaign[0].id));
        } else {
          // Create new campaign
          await db
            .insert(campaigns)
          .values({
            userId: userId,
            googleAdsCampaignId: gaCampaign.id,
            googleAdsAccountId: gaCampaign.accountId,
            name: gaCampaign.name,
            status: gaCampaign.status,
            type: gaCampaign.type,
            dailyBudget: gaCampaign.budget ?? 0,
            impressions7d: Math.round(gaCampaign.impressions || 0),
            clicks7d: Math.round(gaCampaign.clicks || 0),
            conversions7d: Math.round(gaCampaign.conversions || 0),
            conversionValue7d: gaCampaign.conversionsValue || 0,
            spend7d: gaCampaign.cost || 0,
            ctr7d: gaCampaign.ctr || 0,
            avgCpc7d: gaCampaign.avgCpc || 0,
            conversionRate7d: gaCampaign.conversionRate || 0,
            actualCpa: gaCampaign.actualCpa ?? null,
            actualRoas: gaCampaign.actualRoas ?? null
          });
        }
      }
    } catch (error) {
      console.error('❌ Database update failed:', error);
      throw error; // Re-throw to propagate the error up
    }
  }

  /**
   * Generate AI recommendations based on stored campaign data
   */
  private async generateAIRecommendations(adminUser: any): Promise<void> {
    console.log(`--- Generating AI recommendations for admin user: ${adminUser.username} ---`);
    
    try {
      // Use stored recommendation service to generate recommendations
      const result = await this.storedRecommendationService.generateRecommendationsForStoredCampaigns(adminUser.userId);
      
      console.log(`✓ Successfully generated AI recommendations for ${adminUser.username}: ${result.generated} generated, ${result.errors} errors`);
    } catch (error) {
      console.error(`✗ Failed to generate AI recommendations for ${adminUser.username}:`, error);
      await this.logSyncError(adminUser.userId, 'ai_recommendations', error);
    }
  }


  /**
   * Log sync errors for debugging and monitoring
   */
  private async logSyncError(userId: string, syncType: string, error: any): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: userId,
        action: `daily_sync_error_${syncType}`,
        performedBy: 'system',
        details: JSON.stringify({
          error: error.message,
          timestamp: new Date().toISOString(),
          syncType: syncType
        }),
        timestamp: new Date()
      });
    } catch (logError) {
      console.error('Failed to log sync error:', logError);
    }
  }

  /**
   * Get sync status and last run information
   */
  async getSyncStatus(): Promise<{ lastSync: Date | null; nextSync: Date | null; status: string }> {
    try {
      // Get latest successful sync from audit logs
      const lastSyncLog = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, 'daily_sync_completed'))
        .orderBy(desc(auditLogs.timestamp))
        .limit(1);

      const lastSync = lastSyncLog[0]?.timestamp || null;
      
      // Calculate next sync (24 hours from last sync)
      const nextSync = lastSync ? new Date(lastSync.getTime() + 24 * 60 * 60 * 1000) : new Date();
      
      return {
        lastSync,
        nextSync,
        status: 'scheduled'
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        lastSync: null,
        nextSync: null,
        status: 'error'
      };
    }
  }

  /**
   * Manual trigger for daily sync (for testing or manual refresh)
   */
  async triggerManualSync(): Promise<{ success: boolean; message: string; syncedUsers: number; syncedAccounts?: number; syncedCampaigns?: number }> {
    try {
      const adminUsers = await this.getAdminUsersWithGoogleAds();
      
      // Track sync statistics
      let totalAccounts = 0;
      let totalCampaigns = 0;
      
      for (const adminUser of adminUsers) {
        // Get user's selected accounts to count them
        const userSettingsData = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, adminUser.userId))
          .limit(1);

        const selectedAccounts = userSettingsData[0]?.selectedGoogleAdsAccounts || [];
        totalAccounts += selectedAccounts.length;
        
        // Count campaigns in database for this user
        const userCampaigns = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.userId, adminUser.userId));
        totalCampaigns += userCampaigns.length;
      }
      
      await this.performDailySync();
      
      // Log successful sync
      await db.insert(auditLogs).values({
        userId: 'system',
        action: 'daily_sync_completed',
        performedBy: 'system',
        details: JSON.stringify({
          syncedUsers: adminUsers.length,
          syncedAccounts: totalAccounts,
          syncedCampaigns: totalCampaigns,
          timestamp: new Date().toISOString(),
          trigger: 'manual'
        }),
        timestamp: new Date()
      });

      return {
        success: true,
        message: `Successfully synced ${totalCampaigns} campaigns from ${totalAccounts} Google Ads accounts`,
        syncedUsers: adminUsers.length,
        syncedAccounts: totalAccounts,
        syncedCampaigns: totalCampaigns
      };
    } catch (error) {
      return {
        success: false,
        message: `Sync failed: ${error.message}`,
        syncedUsers: 0
      };
    }
  }
}