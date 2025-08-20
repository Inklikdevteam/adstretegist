import { db } from "../db";
import { campaigns, users, googleAdsAccounts, type Campaign, type InsertCampaign } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { GoogleAdsService } from "./googleAdsService";

export class CampaignService {
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
    const existingCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
    
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
      
      // Clear existing campaigns and insert real ones
      await db.delete(campaigns).where(eq(campaigns.userId, userId));
      
      const campaignsToInsert: InsertCampaign[] = realCampaigns.map(campaign => ({
        userId,
        name: campaign.name,
        type: this.mapCampaignType(campaign.type),
        status: campaign.status.toLowerCase(),
        dailyBudget: (campaign.budget / 100).toFixed(2), // Convert from micros
        spend7d: (campaign.cost / 100).toFixed(2), // Convert from micros
        conversions7d: campaign.conversions,
        actualCpa: campaign.conversions > 0 ? ((campaign.cost / 100) / campaign.conversions).toFixed(2) : null,
        actualRoas: campaign.cost > 0 ? (campaign.conversions * 500 / (campaign.cost / 100)).toFixed(2) : null, // Assuming ₹500 per conversion
        targetCpa: campaign.targetCpa ? (campaign.targetCpa / 100).toFixed(2) : null,
        targetRoas: campaign.targetRoas ? campaign.targetRoas.toFixed(2) : null,
        goalDescription: `Real Google Ads campaign - ${campaign.bidStrategy}`
      }));

      if (campaignsToInsert.length > 0) {
        const insertedCampaigns = await db.insert(campaigns).values(campaignsToInsert).returning();
        return insertedCampaigns;
      }

      return [];
    } catch (error) {
      console.error('Error fetching real Google Ads campaigns:', error);
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
