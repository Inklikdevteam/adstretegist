import { db } from "../db";
import { campaigns, users, type Campaign, type InsertCampaign } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class CampaignService {
  async getUserCampaigns(userId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.userId, userId));
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
