import { db } from "../db";
import { recommendations, auditLogs, type Recommendation, type InsertRecommendation, type InsertAuditLog } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { analyzeCampaignPerformance, generateDailySummary } from "../openai";
import { CampaignService } from "./campaignService";

export class AIRecommendationService {
  private campaignService = new CampaignService();

  async generateRecommendationsForUser(userId: string): Promise<Recommendation[]> {
    const campaigns = await this.campaignService.getUserCampaigns(userId);
    const newRecommendations: Recommendation[] = [];

    // Clear old pending recommendations
    await db.delete(recommendations).where(eq(recommendations.status, 'pending'));

    for (const campaign of campaigns) {
      try {
        const analysis = await analyzeCampaignPerformance(campaign);
        
        const recommendationData: InsertRecommendation = {
          campaignId: campaign.id,
          type: analysis.recommendation_type,
          priority: analysis.priority,
          title: analysis.title,
          description: analysis.description,
          reasoning: analysis.reasoning,
          aiModel: "gpt-4o",
          confidence: analysis.confidence,
          potentialSavings: analysis.potential_savings?.toString(),
          actionData: analysis.action_data,
          status: 'pending'
        };

        const [recommendation] = await db
          .insert(recommendations)
          .values(recommendationData)
          .returning();
        
        newRecommendations.push(recommendation);

        // Log the AI analysis
        await this.logAuditEvent({
          userId,
          campaignId: campaign.id,
          recommendationId: recommendation.id,
          action: "AI Recommendation Generated",
          details: `${analysis.recommendation_type} recommendation: ${analysis.title}`,
          performedBy: "ai",
          aiModel: "gpt-4o"
        });

      } catch (error) {
        console.error(`Failed to generate recommendation for campaign ${campaign.id}:`, error);
      }
    }

    return newRecommendations;
  }

  async getRecommendationsByUser(userId: string): Promise<Recommendation[]> {
    return await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.status, 'pending'))
      .orderBy(desc(recommendations.createdAt));
  }

  async applyRecommendation(recommendationId: string, userId: string): Promise<boolean> {
    try {
      const [recommendation] = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.id, recommendationId));

      if (!recommendation) {
        throw new Error("Recommendation not found");
      }

      // Mark recommendation as applied
      await db
        .update(recommendations)
        .set({ 
          status: 'applied',
          appliedAt: new Date()
        })
        .where(eq(recommendations.id, recommendationId));

      // Log the application
      await this.logAuditEvent({
        userId,
        campaignId: recommendation.campaignId,
        recommendationId: recommendation.id,
        action: "Applied AI Recommendation",
        details: `Applied: ${recommendation.title}`,
        performedBy: "user"
      });

      return true;
    } catch (error) {
      console.error("Failed to apply recommendation:", error);
      return false;
    }
  }

  async dismissRecommendation(recommendationId: string, userId: string): Promise<boolean> {
    try {
      const [recommendation] = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.id, recommendationId));

      if (!recommendation) {
        throw new Error("Recommendation not found");
      }

      await db
        .update(recommendations)
        .set({ status: 'dismissed' })
        .where(eq(recommendations.id, recommendationId));

      await this.logAuditEvent({
        userId,
        campaignId: recommendation.campaignId,
        recommendationId: recommendation.id,
        action: "Dismissed AI Recommendation", 
        details: `Dismissed: ${recommendation.title}`,
        performedBy: "user"
      });

      return true;
    } catch (error) {
      console.error("Failed to dismiss recommendation:", error);
      return false;
    }
  }

  async getAuditTrail(userId: string, limit: number = 10) {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  private async logAuditEvent(eventData: InsertAuditLog) {
    await db.insert(auditLogs).values(eventData);
  }

  async getDashboardSummary(userId: string) {
    const campaigns = await this.campaignService.getUserCampaigns(userId);
    const pendingRecommendations = await this.getRecommendationsByUser(userId);
    
    const summary = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      recommendations: {
        actionable: pendingRecommendations.filter(r => r.type === 'actionable').length,
        monitor: pendingRecommendations.filter(r => r.type === 'monitor').length,
        clarification: pendingRecommendations.filter(r => r.type === 'clarification').length
      },
      totalSpend: campaigns.reduce((sum, c) => sum + parseFloat(c.spend7d || '0'), 0),
      totalConversions: campaigns.reduce((sum, c) => sum + (c.conversions7d || 0), 0)
    };

    return summary;
  }
}
