import { db } from "../db";
import { campaigns, users, googleAdsAccounts, auditLogs, recommendations, userSettings, type Campaign, type InsertCampaign } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { GoogleAdsService } from "./googleAdsService";

export class CampaignService {
  // Helper method to clean currency values for database insertion
  private parseCurrencyValue(value: string | number): number {
    if (typeof value === 'number') return value;
    
    // Remove currency symbols (₹, $, €, etc.) and commas
    const cleanValue = value.toString()
      .replace(/[₹$€£¥,]/g, '') // Remove common currency symbols and commas
      .replace(/\s+/g, '') // Remove spaces
      .trim();
    
    // Handle empty or invalid values
    if (!cleanValue || cleanValue === '' || isNaN(parseFloat(cleanValue))) {
      return 0;
    }
    
    return parseFloat(cleanValue);
  }

  // Safe cleanup method that handles foreign key constraints
  private async cleanupUserCampaigns(userId: string): Promise<void> {
    try {
      // Get all campaign IDs for this user
      const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, userId));
      const campaignIds = userCampaigns.map(c => c.id);

      if (campaignIds.length === 0) return;

      // First delete audit logs that reference these campaigns
      for (const campaignId of campaignIds) {
        await db.delete(auditLogs).where(eq(auditLogs.campaignId, campaignId));
      }

      // Then delete recommendations that reference these campaigns
      for (const campaignId of campaignIds) {
        await db.delete(recommendations).where(eq(recommendations.campaignId, campaignId));
      }

      // Finally delete the campaigns themselves
      await db.delete(campaigns).where(eq(campaigns.userId, userId));
    } catch (error) {
      console.error('Error cleaning up user campaigns:', error);
      throw error;
    }
  }
  async getUserCampaigns(userId: string, selectedAccountIds?: string[]): Promise<Campaign[]> {
    console.log('CampaignService getUserCampaigns for userId:', userId, 'selectedAccounts:', selectedAccountIds);
    
    // Get user details to determine if this is a sub-account
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      console.log('User not found');
      return [];
    }
    
    let targetUserId = userId;
    let effectiveSelectedAccountIds = selectedAccountIds;
    
    // For sub-accounts, get admin's connected accounts and selected accounts
    if (user.role === 'sub_account') {
      console.log('Sub-account detected, finding admin users...');
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      
      if (adminUsers.length > 0) {
        targetUserId = adminUsers[0].id; // Use first admin
        console.log(`Sub-account ${user.username} will use admin ${targetUserId}'s connected accounts`);
        
        // Get admin's approved accounts (scope restriction)
        const adminSettings = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, targetUserId));
          
        if (adminSettings.length > 0) {
          const adminApprovedAccounts = adminSettings[0].selectedGoogleAdsAccounts as string[];
          console.log(`Admin's approved accounts:`, adminApprovedAccounts);
          
          // If sub-account provided specific selection, validate it's within admin's scope
          if (selectedAccountIds && selectedAccountIds.length > 0) {
            // Filter sub-account's selection to only include admin-approved accounts
            effectiveSelectedAccountIds = selectedAccountIds.filter(accountId => 
              adminApprovedAccounts?.includes(accountId)
            );
            console.log(`Sub-account filtered selection:`, effectiveSelectedAccountIds);
          } else {
            // Sub-account selected nothing - return empty array (show no data)
            effectiveSelectedAccountIds = [];
            console.log(`Sub-account selected no accounts - showing no data`);
          }
        }
      }
    }
    
    // Check if target user has connected Google Ads accounts
    const connectedAccounts = await db
      .select()
      .from(googleAdsAccounts)
      .where(and(eq(googleAdsAccounts.adminUserId, targetUserId), eq(googleAdsAccounts.isActive, true)));
    
    if (connectedAccounts.length > 0) {
      // User has connected Google Ads - fetch real campaigns
      return await this.fetchRealCampaigns(userId, connectedAccounts, effectiveSelectedAccountIds);
    }
    
    // No connected accounts - check for existing campaigns or create samples
    const existingCampaigns = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.userId, userId), eq(campaigns.status, 'active')));
    
    if (existingCampaigns.length === 0) {
      // Initialize sample campaigns for users without Google Ads
      return await this.initializeSampleCampaigns(userId);
    }
    
    return existingCampaigns;
  }

  // Performance-specific method that respects date ranges
  async getPerformanceCampaigns(userId: string, selectedAccountIds?: string[], dateFrom?: Date, dateTo?: Date): Promise<Campaign[]> {
    console.log('CampaignService getPerformanceCampaigns for userId:', userId, 'selectedAccounts:', selectedAccountIds, 'dateRange:', { dateFrom, dateTo });
    
    // Get user details to determine if this is a sub-account
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      console.log('User not found');
      return [];
    }
    
    let targetUserId = userId;
    let effectiveSelectedAccountIds = selectedAccountIds;
    
    // For sub-accounts, get admin's connected accounts and selected accounts
    if (user.role === 'sub_account') {
      console.log('Sub-account detected for performance data, finding admin users...');
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      
      if (adminUsers.length > 0) {
        targetUserId = adminUsers[0].id; // Use first admin
        console.log(`Sub-account ${user.username} will use admin ${targetUserId}'s connected accounts for performance data`);
        
        // Get admin's approved accounts (scope restriction)
        const adminSettings = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, targetUserId));
          
        if (adminSettings.length > 0) {
          const adminApprovedAccounts = adminSettings[0].selectedGoogleAdsAccounts as string[];
          console.log(`Admin's approved accounts for performance:`, adminApprovedAccounts);
          
          // If sub-account provided specific selection, validate it's within admin's scope
          if (selectedAccountIds && selectedAccountIds.length > 0) {
            // Filter sub-account's selection to only include admin-approved accounts
            effectiveSelectedAccountIds = selectedAccountIds.filter(accountId => 
              adminApprovedAccounts?.includes(accountId)
            );
            console.log(`Sub-account performance filtered selection:`, effectiveSelectedAccountIds);
          } else {
            // Sub-account selected nothing - return empty array (show no data)
            effectiveSelectedAccountIds = [];
            console.log(`Sub-account selected no accounts for performance - showing no data`);
          }
        }
      }
    }
    
    // Check if target user has connected Google Ads accounts
    const connectedAccounts = await db
      .select()
      .from(googleAdsAccounts)
      .where(and(eq(googleAdsAccounts.adminUserId, targetUserId), eq(googleAdsAccounts.isActive, true)));
    
    if (connectedAccounts.length > 0) {
      // User has connected Google Ads - fetch real campaigns with date range
      return await this.fetchRealCampaignsWithDateRange(userId, connectedAccounts, effectiveSelectedAccountIds, dateFrom, dateTo);
    }
    
    // No connected accounts - return regular campaigns
    return await this.getUserCampaigns(userId, selectedAccountIds);
  }

  private async fetchRealCampaignsWithDateRange(userId: string, accounts: any[], selectedAccountIds?: string[], dateFrom?: Date, dateTo?: Date): Promise<Campaign[]> {
    try {
      const primaryAccount = accounts.find(acc => acc.isPrimary) || accounts[0];
      
      if (!primaryAccount.refreshToken) {
        console.warn('No refresh token available for Google Ads account');
        return await this.getFallbackCampaigns(userId);
      }

      // Check for invalid customer ID
      if (!primaryAccount.customerId || primaryAccount.customerId === 'no-customer-found' || primaryAccount.customerId === '') {
        console.warn(`Invalid customer ID detected: ${primaryAccount.customerId}. Removing invalid account and using fallback.`);
        
        // Delete the invalid account record
        await db.delete(googleAdsAccounts).where(eq(googleAdsAccounts.id, primaryAccount.id));
        
        return await this.getFallbackCampaigns(userId);
      }

      const googleAdsService = new GoogleAdsService({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refreshToken: primaryAccount.refreshToken,
        customerId: primaryAccount.customerId,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
      });

      const realCampaigns = await googleAdsService.getCampaignsWithDateRange(selectedAccountIds, dateFrom, dateTo);
      
      // If selectedAccountIds is empty, return empty array (don't show any campaigns)
      if (selectedAccountIds && selectedAccountIds.length === 0) {
        console.log('No accounts selected for date range - returning empty campaign list');
        return [];
      }
      
      // Filter only active/enabled campaigns (status 2 = ENABLED in Google Ads API)
      const activeCampaigns = realCampaigns.filter(campaign => 
        campaign.status && (campaign.status === 2 || campaign.status === 'ENABLED' || campaign.status.toString().toUpperCase() === 'ENABLED')
      );
      
      // Get existing campaigns for this user
      const existingCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, userId));
      
      const updatedCampaigns: Campaign[] = [];
      
      for (const googleCampaign of activeCampaigns) {
        // Find existing campaign by exact name match first, with more robust matching
        const campaignName = googleCampaign.name || 'Unnamed Campaign';
        const existingCampaign = existingCampaigns.find(ec => 
          ec.name === campaignName
        );
        
        // Use actual conversion value from Google Ads API and calculate ROAS
        const conversionValue = googleCampaign.conversionsValue || 0;
        const calculatedRoas = googleCampaign.cost > 0 ? (conversionValue / googleCampaign.cost) : 0;
        
        const campaignData = {
          userId,
          googleAdsAccountId: accounts.find(acc => acc.isPrimary)?.id || accounts[0]?.id, // Set the account ID
          name: googleCampaign.name || 'Unnamed Campaign',
          type: this.mapCampaignType(googleCampaign.type),
          status: (googleCampaign.status === 2 || googleCampaign.status === 'ENABLED') ? 'active' : 'active' as 'active',
          dailyBudget: this.parseCurrencyValue(googleCampaign.budget.toFixed(2)).toString(),
          spend7d: this.parseCurrencyValue(googleCampaign.cost.toFixed(2)).toString(),
          conversions7d: Math.round(googleCampaign.conversions || 0),
          actualCpa: googleCampaign.conversions > 0 ? this.parseCurrencyValue(googleCampaign.cost / googleCampaign.conversions).toString() : null,
          actualRoas: calculatedRoas > 0 ? this.parseCurrencyValue(calculatedRoas).toString() : null,
          // Additional metrics from Google Ads API
          impressions7d: Math.round(googleCampaign.impressions || 0),
          clicks7d: Math.round(googleCampaign.clicks || 0),
          ctr7d: this.parseCurrencyValue(googleCampaign.ctr || 0).toString(),
          conversionValue7d: this.parseCurrencyValue(conversionValue).toString(),
          avgCpc7d: this.parseCurrencyValue(googleCampaign.avgCpc || 0).toString(),
          conversionRate7d: this.parseCurrencyValue(googleCampaign.conversionRate || 0).toString(),
          // Preserve existing goals if they exist
          targetCpa: existingCampaign?.targetCpa || (googleCampaign.targetCpa ? this.parseCurrencyValue(googleCampaign.targetCpa).toString() : null),
          targetRoas: existingCampaign?.targetRoas || (googleCampaign.targetRoas ? this.parseCurrencyValue(googleCampaign.targetRoas).toString() : null),
          goalDescription: existingCampaign?.goalDescription || `Real Google Ads campaign - ${googleCampaign.bidStrategy || 'Auto bidding'}`
        };

        // Create the final campaign object with all Google Ads metrics and campaign age data
        const finalCampaign = {
          ...campaignData,
          // Real Google Ads metrics
          impressions: googleCampaign.impressions || 0,
          clicks: googleCampaign.clicks || 0,
          ctr: googleCampaign.ctr || 0,
          avgCpc: googleCampaign.avgCpc || 0, // Already converted from micros in the service
          conversions: googleCampaign.conversions || 0,
          conversionValue: conversionValue, // Real conversion value from Google Ads
          conversionRate: googleCampaign.conversionRate || 0,
          // Campaign age data for AI analysis
          startDate: googleCampaign.startDate,
          campaignAgeInDays: googleCampaign.campaignAgeInDays,
          actualDataDays: googleCampaign.actualDataDays
        };
        
        // For Performance page, we don't update the database, just return the data
        updatedCampaigns.push(finalCampaign as Campaign);
      }
      
      return updatedCampaigns;
    } catch (error) {
      console.error('Error fetching performance campaigns with date range:', error);
      // Fallback to regular campaigns
      return await this.getUserCampaigns(userId, selectedAccountIds);
    }
  }

  private async fetchRealCampaigns(userId: string, accounts: any[], selectedAccountIds?: string[]): Promise<Campaign[]> {
    try {
      const primaryAccount = accounts.find(acc => acc.isPrimary) || accounts[0];
      
      if (!primaryAccount.refreshToken) {
        console.warn('No refresh token available for Google Ads account');
        return await this.getFallbackCampaigns(userId);
      }

      // Check for invalid customer ID
      if (!primaryAccount.customerId || primaryAccount.customerId === 'no-customer-found' || primaryAccount.customerId === '') {
        console.warn(`Invalid customer ID detected: ${primaryAccount.customerId}. Removing invalid account and using fallback.`);
        
        // Delete the invalid account record
        await db.delete(googleAdsAccounts).where(eq(googleAdsAccounts.id, primaryAccount.id));
        
        return await this.getFallbackCampaigns(userId);
      }

      const googleAdsService = new GoogleAdsService({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refreshToken: primaryAccount.refreshToken,
        customerId: primaryAccount.customerId,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
      });

      const realCampaigns = await googleAdsService.getCampaigns(selectedAccountIds);
      
      // If selectedAccountIds is empty, return empty array (don't show any campaigns)
      if (selectedAccountIds && selectedAccountIds.length === 0) {
        console.log('No accounts selected - returning empty campaign list');
        return [];
      }
      
      // Filter only active/enabled campaigns (status 2 = ENABLED in Google Ads API)
      const activeCampaigns = realCampaigns.filter(campaign => 
        campaign.status && (campaign.status === 2 || campaign.status === 'ENABLED' || campaign.status.toString().toUpperCase() === 'ENABLED')
      );
      
      // Get existing campaigns for this user
      const existingCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, userId));
      
      const updatedCampaigns: Campaign[] = [];
      
      for (const googleCampaign of activeCampaigns) {
        // Find existing campaign by exact name match first, with more robust matching
        const campaignName = googleCampaign.name || 'Unnamed Campaign';
        const existingCampaign = existingCampaigns.find(ec => 
          ec.name === campaignName
        );
        
        console.log(`DEBUG: Matching campaign "${campaignName}" - Found existing:`, !!existingCampaign);
        if (existingCampaign) {
          console.log(`DEBUG: Preserving goals - CPA: ${existingCampaign.targetCpa}, ROAS: ${existingCampaign.targetRoas}`);
          console.log(`DEBUG: Existing campaign ID: ${existingCampaign.id}`);
        }
        
        // Debug: Log Google Ads data for this campaign
        console.log(`DEBUG: Google Ads data for "${campaignName}":`, {
          impressions: googleCampaign.impressions,
          clicks: googleCampaign.clicks,
          cost: googleCampaign.cost,
          conversions: googleCampaign.conversions,
          conversionsValue: googleCampaign.conversionsValue,
          ctr: googleCampaign.ctr,
          avgCpc: googleCampaign.avgCpc,
          conversionRate: googleCampaign.conversionRate
        });
        
        // Use actual conversion value from Google Ads API and calculate ROAS
        const conversionValue = googleCampaign.conversionsValue || 0;
        const calculatedRoas = googleCampaign.cost > 0 ? (conversionValue / googleCampaign.cost) : 0;
        
        const campaignData = {
          userId,
          googleAdsAccountId: accounts.find(acc => acc.isPrimary)?.id || accounts[0]?.id, // Set the account ID
          name: googleCampaign.name || 'Unnamed Campaign',
          type: this.mapCampaignType(googleCampaign.type),
          status: (googleCampaign.status === 2 || googleCampaign.status === 'ENABLED') ? 'active' : 'active' as 'active',
          dailyBudget: this.parseCurrencyValue(googleCampaign.budget.toFixed(2)).toString(),
          spend7d: this.parseCurrencyValue(googleCampaign.cost.toFixed(2)).toString(),
          conversions7d: Math.round(googleCampaign.conversions || 0),
          actualCpa: googleCampaign.conversions > 0 ? this.parseCurrencyValue(googleCampaign.cost / googleCampaign.conversions).toString() : null,
          actualRoas: calculatedRoas > 0 ? this.parseCurrencyValue(calculatedRoas).toString() : null,
          // Additional metrics from Google Ads API
          impressions7d: Math.round(googleCampaign.impressions || 0),
          clicks7d: Math.round(googleCampaign.clicks || 0),
          ctr7d: this.parseCurrencyValue(googleCampaign.ctr || 0).toString(),
          conversionValue7d: this.parseCurrencyValue(conversionValue).toString(),
          avgCpc7d: this.parseCurrencyValue(googleCampaign.avgCpc || 0).toString(),
          conversionRate7d: this.parseCurrencyValue(googleCampaign.conversionRate || 0).toString(),
          // Preserve existing goals if they exist
          targetCpa: existingCampaign?.targetCpa || (googleCampaign.targetCpa ? this.parseCurrencyValue(googleCampaign.targetCpa).toString() : null),
          targetRoas: existingCampaign?.targetRoas || (googleCampaign.targetRoas ? this.parseCurrencyValue(googleCampaign.targetRoas).toString() : null),
          goalDescription: existingCampaign?.goalDescription || `Real Google Ads campaign - ${googleCampaign.bidStrategy || 'Auto bidding'}`
        };

        // Create the final campaign object with all Google Ads metrics and campaign age data
        const finalCampaign = {
          ...campaignData,
          // Real Google Ads metrics
          impressions: googleCampaign.impressions || 0,
          clicks: googleCampaign.clicks || 0,
          ctr: googleCampaign.ctr || 0,
          avgCpc: googleCampaign.avgCpc || 0, // Already converted from micros in the service
          conversions: googleCampaign.conversions || 0,
          conversionValue: conversionValue, // Real conversion value from Google Ads
          conversionRate: googleCampaign.conversionRate || 0,
          // Campaign age data for AI analysis
          startDate: googleCampaign.startDate,
          campaignAgeInDays: googleCampaign.campaignAgeInDays,
          actualDataDays: googleCampaign.actualDataDays
        };
        
        if (existingCampaign) {
          // Update existing campaign in database
          const [updatedCampaign] = await db
            .update(campaigns)
            .set(campaignData)
            .where(eq(campaigns.id, existingCampaign.id))
            .returning();
          // Add Google Ads metrics to the returned campaign
          updatedCampaigns.push({ ...updatedCampaign, ...finalCampaign });
        } else {
          // Use upsert logic to handle potential race conditions
          try {
            const [newCampaign] = await db
              .insert(campaigns)
              .values(campaignData as InsertCampaign)
              .returning();
            // Add Google Ads metrics to the returned campaign
            updatedCampaigns.push({ ...newCampaign, ...finalCampaign });
          } catch (insertError: any) {
            // Handle unique constraint violation by updating existing campaign
            if (insertError.code === '23505' && insertError.constraint === 'campaigns_user_name_unique') {
              console.log(`DEBUG: Handling duplicate campaign insertion for "${campaignName}" - updating existing`);
              
              // Find the existing campaign that caused the conflict
              const conflictCampaign = await db
                .select()
                .from(campaigns)
                .where(and(eq(campaigns.userId, userId), eq(campaigns.name, campaignName)))
                .limit(1);
              
              if (conflictCampaign.length > 0) {
                const [updatedCampaign] = await db
                  .update(campaigns)
                  .set(campaignData)
                  .where(eq(campaigns.id, conflictCampaign[0].id))
                  .returning();
                // Add Google Ads metrics to the returned campaign
                updatedCampaigns.push({ ...updatedCampaign, ...finalCampaign });
              }
            } else {
              throw insertError; // Re-throw other errors
            }
          }
        }
      }
      
      // Remove campaigns that no longer exist in Google Ads
      const googleCampaignNames = activeCampaigns.map(c => c.name || 'Unnamed Campaign');
      const campaignsToRemove = existingCampaigns.filter(ec => 
        !googleCampaignNames.includes(ec.name)
      );
      
      for (const campaignToRemove of campaignsToRemove) {
        // Clean up related data first
        await db.delete(auditLogs).where(eq(auditLogs.campaignId, campaignToRemove.id));
        await db.delete(recommendations).where(eq(recommendations.campaignId, campaignToRemove.id));
        await db.delete(campaigns).where(eq(campaigns.id, campaignToRemove.id));
      }

      return updatedCampaigns;
    } catch (error) {
      console.error('Error fetching real Google Ads campaigns:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      
      // Clear any failed/partial data safely
      await this.cleanupUserCampaigns(userId);
      
      return await this.getFallbackCampaigns(userId);
    }
  }

  private mapCampaignType(googleAdsType: string): string {
    // Updated to handle the actual mapped types from GoogleAdsService
    const typeMap: { [key: string]: string } = {
      // New format from GoogleAdsService.mapChannelType()
      'Search': 'search',
      'Display': 'display', 
      'Shopping': 'shopping',
      'Video': 'video',
      'Hotel': 'hotel',
      'App': 'app',
      'Local': 'local',
      'Smart': 'smart',
      'Performance Max': 'performance_max',
      'Local Services': 'local_services',
      'Discovery': 'discovery',
      'Travel': 'travel',
      // Legacy format for backwards compatibility
      'SEARCH': 'search',
      'DISPLAY': 'display',
      'SHOPPING': 'shopping',
      'VIDEO': 'video',
      'DISCOVERY': 'discovery',
      'APP': 'app',
      'SMART': 'smart',
      'PERFORMANCE_MAX': 'performance_max'
    };
    return typeMap[googleAdsType] || 'search';
  }

  private async getFallbackCampaigns(userId: string): Promise<Campaign[]> {
    // Return existing campaigns or create samples as fallback
    const existingCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
    if (existingCampaigns.length > 0) {
      return existingCampaigns;
    }
    return await this.initializeSampleCampaigns(userId);
  }

  async getCampaignById(id: string, userId: string): Promise<Campaign | undefined> {
    console.log('CampaignService getCampaignById for userId:', userId, 'campaignId:', id);
    
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
    return campaign;
  }

  async createCampaign(campaignData: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(campaignData).returning();
    return campaign;
  }

  async updateCampaign(id: string, userId: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
      .returning();
    return campaign;
  }

  // Initialize sample campaigns for new users
  async hasGoogleAdsConnection(userId: string): Promise<boolean> {
    const connectedAccounts = await db
      .select()
      .from(googleAdsAccounts)
      .where(and(eq(googleAdsAccounts.adminUserId, userId), eq(googleAdsAccounts.isActive, true)));
    return connectedAccounts.length > 0;
  }

  async initializeSampleCampaigns(userId: string): Promise<Campaign[]> {
    // Return empty array - only use real Google Ads data
    console.log("Skipping sample campaigns - only using real Google Ads data");
    return [];
  }

  async updateCampaignGoals(
    campaignId: string, 
    userId: string, 
    goals: { targetCpa?: string; targetRoas?: string; goalDescription?: string }
  ): Promise<Campaign | undefined> {
    console.log('CampaignService updateCampaignGoals for userId:', userId, 'campaignId:', campaignId);
    
    const [campaign] = await db
      .update(campaigns)
      .set({ 
        ...goals, 
        updatedAt: new Date(),
        lastModified: new Date()
      })
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
      .returning();
    return campaign;
  }
}
