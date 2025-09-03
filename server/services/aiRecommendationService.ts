import { db } from "../db";
import { recommendations, auditLogs, campaigns, type Recommendation, type InsertRecommendation, type InsertAuditLog } from "@shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { analyzeCampaignPerformance, generateDailySummary } from "../openai";
import { CampaignService } from "./campaignService";

export class AIRecommendationService {
  private campaignService = new CampaignService();

  // Helper method to clean currency values for database insertion
  private parseCurrencyValue(value: string | number | undefined | null): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value.toString();
    
    // Remove currency symbols (₹, $, €, etc.) and commas
    const cleanValue = value.toString()
      .replace(/[₹$€£¥,]/g, '') // Remove common currency symbols and commas
      .replace(/\s+/g, '') // Remove spaces
      .trim();
    
    // Handle empty or invalid values
    if (!cleanValue || cleanValue === '' || isNaN(parseFloat(cleanValue))) {
      return null;
    }
    
    return parseFloat(cleanValue).toString();
  }

  async generateRecommendationsForUser(userId: string, selectedAccountIds?: string[]): Promise<Recommendation[]> {
    console.log(`DEBUG: Starting recommendation generation for user ${userId}`);
    const userCampaigns = await this.campaignService.getUserCampaigns(userId, selectedAccountIds);
    console.log(`DEBUG: Found ${userCampaigns.length} campaigns for user`);
    const newRecommendations: Recommendation[] = [];

    // If no campaigns available, return empty array
    if (!userCampaigns || userCampaigns.length === 0) {
      console.log('DEBUG: No campaigns found, returning empty array');
      return [];
    }

    // Clear old recommendations for this user (delete all old ones, not just pending)
    const oldRecommendations = await db.select({ id: recommendations.id }).from(recommendations).where(eq(recommendations.userId, userId));
    
    for (const rec of oldRecommendations) {
      await db.delete(auditLogs).where(eq(auditLogs.recommendationId, rec.id));
    }
    
    await db.delete(recommendations).where(eq(recommendations.userId, userId));

    for (const campaign of userCampaigns) {
      try {
        console.log(`DEBUG: Processing campaign: ${campaign.name} (ID: ${campaign.id})`);
        // Double-check campaign still exists before creating recommendation
        const campaignCheck = await db.select().from(campaigns).where(eq(campaigns.id, campaign.id)).limit(1);
        if (campaignCheck.length === 0) {
          console.warn(`Campaign ${campaign.id} no longer exists, skipping recommendation generation`);
          continue;
        }

        console.log(`DEBUG: Calling analyzeCampaignPerformance for campaign ${campaign.name}`);
        const analysis = await analyzeCampaignPerformance(campaign);
        console.log(`DEBUG: Analysis completed for campaign ${campaign.name}:`, {
          type: analysis.recommendation_type,
          title: analysis.title,
          confidence: analysis.confidence
        });
        
        const recommendationData: InsertRecommendation = {
          userId: userId,
          campaignId: campaign.id,
          type: analysis.recommendation_type,
          priority: analysis.priority,
          title: analysis.title,
          description: analysis.description,
          reasoning: analysis.reasoning,
          aiModel: "gpt-4o",
          confidence: analysis.confidence,
          potentialSavings: this.parseCurrencyValue(analysis.potential_savings),
          actionData: analysis.action_data,
          status: 'pending'
        };

        console.log(`DEBUG: Inserting recommendation data:`, recommendationData);
        
        const [recommendation] = await db
          .insert(recommendations)
          .values(recommendationData)
          .returning();
          
        console.log(`DEBUG: Successfully inserted recommendation:`, recommendation);
        
        newRecommendations.push(recommendation);
        console.log(`DEBUG: Total recommendations created so far: ${newRecommendations.length}`);

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
        console.error(`Failed to generate recommendation for campaign ${campaign.id} (${campaign.name}):`, error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
      }
    }

    console.log(`DEBUG: Finished processing all campaigns. Created ${newRecommendations.length} recommendations`);
    return newRecommendations;
  }

  async getRecommendationsByUser(userId: string): Promise<Recommendation[]> {
    console.log(`DEBUG: Getting recommendations for user ${userId}`);
    const userRecommendations = await db
      .select()
      .from(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.status, 'pending')))
      .orderBy(desc(recommendations.createdAt));
    console.log(`DEBUG: Found ${userRecommendations.length} recommendations for user ${userId}`);
    return userRecommendations;
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

  async getAuditTrail(userId: string, limit: number = 100) {
    // Include both user-specific activities AND system-level activities
    return await db
      .select()
      .from(auditLogs)
      .where(or(eq(auditLogs.userId, userId), eq(auditLogs.userId, 'system')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  private async logAuditEvent(eventData: InsertAuditLog) {
    await db.insert(auditLogs).values(eventData);
  }

  async getDashboardSummary(userId: string, selectedAccounts?: string[]) {
    const campaigns = await this.campaignService.getUserCampaigns(userId, selectedAccounts);
    const pendingRecommendations = await this.getRecommendationsByUser(userId);
    
    // If specific accounts are selected, filter recommendations to only those for campaigns from those accounts
    const filteredRecommendations = selectedAccounts && selectedAccounts.length > 0
      ? pendingRecommendations.filter(r => {
          const campaignForRecommendation = campaigns.find(c => c.id === r.campaignId);
          return campaignForRecommendation !== undefined;
        })
      : pendingRecommendations;
    
    const summary = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active' || c.status === 'enabled').length,
      recommendations: {
        actionable: filteredRecommendations.filter(r => r.type === 'actionable').length,
        monitor: filteredRecommendations.filter(r => r.type === 'monitor').length,
        clarification: filteredRecommendations.filter(r => r.type === 'clarification').length
      },
      totalSpend: campaigns.reduce((sum, c) => sum + parseFloat(c.spend7d || '0'), 0),
      totalConversions: campaigns.reduce((sum, c) => sum + (c.conversions7d || 0), 0)
    };

    return summary;
  }

  // Performance-specific dashboard summary with date range filtering
  async getPerformanceSummary(userId: string, selectedAccounts?: string[], dateFrom?: Date, dateTo?: Date) {
    const campaigns = await this.campaignService.getPerformanceCampaigns(userId, selectedAccounts, dateFrom, dateTo);
    const pendingRecommendations = await this.getRecommendationsByUser(userId);
    
    // If specific accounts are selected, filter recommendations to only those for campaigns from those accounts
    const filteredRecommendations = selectedAccounts && selectedAccounts.length > 0
      ? pendingRecommendations.filter(r => {
          const campaignForRecommendation = campaigns.find(c => c.id === r.campaignId);
          return campaignForRecommendation !== undefined;
        })
      : pendingRecommendations;
    
    const summary = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active' || c.status === 'enabled').length,
      recommendations: {
        actionable: filteredRecommendations.filter(r => r.type === 'actionable').length,
        monitor: filteredRecommendations.filter(r => r.type === 'monitor').length,
        clarification: filteredRecommendations.filter(r => r.type === 'clarification').length
      },
      totalSpend: campaigns.reduce((sum, c) => sum + parseFloat(c.spend7d || '0'), 0),
      totalConversions: campaigns.reduce((sum, c) => sum + (c.conversions7d || 0), 0)
    };

    return summary;
  }
}
