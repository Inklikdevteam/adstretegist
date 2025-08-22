import { db } from "../db";
import { campaigns, users, googleAdsAccounts, auditLogs, recommendations, type Campaign, type InsertCampaign } from "@shared/schema";
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
  async getUserCampaigns(userId: string): Promise<Campaign[]> {
    console.log('CampaignService getUserCampaigns for userId:', userId);
    
    // First check if user has connected Google Ads accounts
    const connectedAccounts = await db
      .select()
      .from(googleAdsAccounts)
      .where(and(eq(googleAdsAccounts.userId, userId), eq(googleAdsAccounts.isActive, true)));
    
    if (connectedAccounts.length > 0) {
      // User has connected Google Ads - fetch real campaigns
      return await this.fetchRealCampaigns(userId, connectedAccounts);
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

  private async fetchRealCampaigns(userId: string, accounts: any[]): Promise<Campaign[]> {
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

      const realCampaigns = await googleAdsService.getCampaigns();
      
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
        // Find existing campaign by name (since Google Ads doesn't provide a stable ID we can use)
        const existingCampaign = existingCampaigns.find(ec => 
          ec.name === googleCampaign.name || 
          ec.name === (googleCampaign.name || 'Unnamed Campaign')
        );
        
        console.log(`DEBUG: Matching campaign "${googleCampaign.name}" - Found existing:`, !!existingCampaign);
        if (existingCampaign) {
          console.log(`DEBUG: Preserving goals - CPA: ${existingCampaign.targetCpa}, ROAS: ${existingCampaign.targetRoas}`);
        }
        
        const campaignData = {
          userId,
          name: googleCampaign.name || 'Unnamed Campaign',
          type: this.mapCampaignType(googleCampaign.type),
          status: (googleCampaign.status === 2 || googleCampaign.status === 'ENABLED') ? 'active' : 'active' as 'active',
          dailyBudget: this.parseCurrencyValue(googleCampaign.budget.toFixed(2)).toString(),
          spend7d: this.parseCurrencyValue(googleCampaign.cost.toFixed(2)).toString(),
          conversions7d: Math.round(googleCampaign.conversions || 0),
          actualCpa: googleCampaign.conversions > 0 ? this.parseCurrencyValue(googleCampaign.cost / googleCampaign.conversions).toString() : null,
          actualRoas: googleCampaign.conversions > 0 && googleCampaign.cost > 0 ? this.parseCurrencyValue(googleCampaign.conversions / googleCampaign.cost).toString() : null,
          // Preserve existing goals if they exist
          targetCpa: existingCampaign?.targetCpa || (googleCampaign.targetCpa ? this.parseCurrencyValue(googleCampaign.targetCpa).toString() : null),
          targetRoas: existingCampaign?.targetRoas || (googleCampaign.targetRoas ? this.parseCurrencyValue(googleCampaign.targetRoas).toString() : null),
          goalDescription: existingCampaign?.goalDescription || `Real Google Ads campaign - ${googleCampaign.bidStrategy || 'Auto bidding'}`
        };
        
        if (existingCampaign) {
          // Update existing campaign
          const [updatedCampaign] = await db
            .update(campaigns)
            .set(campaignData)
            .where(eq(campaigns.id, existingCampaign.id))
            .returning();
          updatedCampaigns.push(updatedCampaign);
        } else {
          // Insert new campaign
          const [newCampaign] = await db
            .insert(campaigns)
            .values(campaignData as InsertCampaign)
            .returning();
          updatedCampaigns.push(newCampaign);
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
    const typeMap: { [key: string]: string } = {
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
      .where(and(eq(googleAdsAccounts.userId, userId), eq(googleAdsAccounts.isActive, true)));
    return connectedAccounts.length > 0;
  }

  async initializeSampleCampaigns(userId: string): Promise<Campaign[]> {
    const sampleCampaigns: InsertCampaign[] = [
      {
        userId,
        name: "E-commerce - Electronics",
        type: "search",
        status: "active",
        dailyBudget: "2500.00",
        targetCpa: "300.00",
        targetRoas: "4.00",
        spend7d: "16240.00",
        conversions7d: 57,
        actualCpa: "285.00",
        actualRoas: "5.20",
        goalDescription: "Maximize conversions while maintaining CPA under ₹300"
      },
      {
        userId,
        name: "Brand Protection",
        type: "search", 
        status: "active",
        dailyBudget: "800.00",
        targetCpa: "300.00",
        targetRoas: "4.00",
        spend7d: "4680.00",
        conversions7d: 19,
        actualCpa: "245.00",
        actualRoas: "6.10",
        lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        burnInUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        goalDescription: "Protect brand terms and maintain high ROAS"
      },
      {
        userId,
        name: "Remarketing - Visitors",
        type: "display",
        status: "active", 
        dailyBudget: "800.00",
        spend7d: "5600.00",
        conversions7d: 12,
        actualCpa: "467.00",
        actualRoas: "2.10",
        goalDescription: null // No goals set - will trigger clarification
      }
    ];

    const createdCampaigns: Campaign[] = [];
    for (const campaignData of sampleCampaigns) {
      const [campaign] = await db.insert(campaigns).values(campaignData).returning();
      createdCampaigns.push(campaign);
    }

    return createdCampaigns;
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
