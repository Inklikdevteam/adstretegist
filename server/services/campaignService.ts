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
      
      // Clear existing campaigns and related data safely (cascade delete)
      await this.cleanupUserCampaigns(userId);
      
      const campaignsToInsert: InsertCampaign[] = activeCampaigns.map(campaign => ({
        userId,
        name: campaign.name || 'Unnamed Campaign',
        type: this.mapCampaignType(campaign.type),
        status: (campaign.status === 2 || campaign.status === 'ENABLED') ? 'active' : 'active', // Google Ads status 2 = ENABLED
        dailyBudget: this.parseCurrencyValue(campaign.budget.toFixed(2)).toString(), // Clean currency format
        spend7d: this.parseCurrencyValue(campaign.cost.toFixed(2)).toString(), // Clean currency format
        conversions7d: Math.round(campaign.conversions || 0),
        actualCpa: campaign.conversions > 0 ? this.parseCurrencyValue(campaign.cost / campaign.conversions).toString() : null,
        actualRoas: campaign.conversions > 0 && campaign.cost > 0 ? this.parseCurrencyValue(campaign.conversions / campaign.cost).toString() : null, // Proper ROAS calculation
        targetCpa: campaign.targetCpa ? this.parseCurrencyValue(campaign.targetCpa).toString() : null,
        targetRoas: campaign.targetRoas ? this.parseCurrencyValue(campaign.targetRoas).toString() : null,
        goalDescription: `Real Google Ads campaign - ${campaign.bidStrategy || 'Auto bidding'}`
      }));

      if (campaignsToInsert.length > 0) {
        const insertedCampaigns = await db.insert(campaigns).values(campaignsToInsert).returning();
        return insertedCampaigns;
      }

      return [];
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
