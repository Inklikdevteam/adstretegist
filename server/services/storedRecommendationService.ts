import { db } from "../db";
import { recommendations, campaigns, users, userSettings, type Campaign } from "@shared/schema";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";
import { MultiAIService } from "./multiAIService";
import { buildPrompt } from "../prompts/corePrompt";

export class StoredRecommendationService {
  private multiAIService: MultiAIService;

  constructor() {
    this.multiAIService = new MultiAIService();
  }

  /**
   * Get stored recommendations for a user with account filtering
   */
  async getUserRecommendations(userId: string, selectedAccountIds?: string[]): Promise<any[]> {
    console.log('StoredRecommendationService getUserRecommendations for userId:', userId, 'selectedAccounts:', selectedAccountIds);
    
    // Get user details to determine if this is a sub-account
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      console.log('User not found');
      return [];
    }
    
    let targetUserId = userId;
    let effectiveSelectedAccountIds = selectedAccountIds;
    
    // For sub-accounts, apply admin's account filtering
    if (user.role === 'sub_account') {
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));
      
      if (adminUsers.length > 0) {
        targetUserId = adminUsers[0].id;
        
        const adminSettings = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, targetUserId));
          
        if (adminSettings.length > 0) {
          const adminApprovedAccounts = adminSettings[0].selectedGoogleAdsAccounts as string[];
          
          if (selectedAccountIds && selectedAccountIds.length > 0) {
            effectiveSelectedAccountIds = selectedAccountIds.filter(accountId => 
              adminApprovedAccounts?.includes(accountId)
            );
          } else {
            effectiveSelectedAccountIds = [];
          }
        }
      }
    }
    
    // If explicitly empty selection (not undefined), return empty array
    if (effectiveSelectedAccountIds !== undefined && effectiveSelectedAccountIds.length === 0) {
      console.log('No accounts selected for recommendations - returning empty list');
      return [];
    }
    
    // Get campaigns that match the selected accounts
    let campaignConditions = [eq(campaigns.userId, targetUserId)];
    
    if (effectiveSelectedAccountIds && effectiveSelectedAccountIds.length > 0) {
      campaignConditions.push(inArray(campaigns.googleAdsAccountId, effectiveSelectedAccountIds));
    }
    
    const userCampaigns = await db
      .select()
      .from(campaigns)
      .where(and(...campaignConditions));
    const campaignIds = userCampaigns.map(c => c.id);
    
    if (campaignIds.length === 0) {
      return [];
    }
    
    // Get stored recommendations for these campaigns
    const storedRecommendations = await db
      .select({
        id: recommendations.id,
        campaignId: recommendations.campaignId,
        type: recommendations.type,
        content: recommendations.content,
        confidence: recommendations.confidence,
        provider: recommendations.provider,
        isApplied: recommendations.isApplied,
        createdAt: recommendations.createdAt,
        // Include campaign info
        campaignName: campaigns.name,
        campaignType: campaigns.type,
        campaignStatus: campaigns.status,
        accountId: campaigns.googleAdsAccountId
      })
      .from(recommendations)
      .innerJoin(campaigns, eq(recommendations.campaignId, campaigns.id))
      .where(and(
        eq(recommendations.userId, targetUserId),
        inArray(recommendations.campaignId, campaignIds)
      ))
      .orderBy(desc(recommendations.createdAt))
      .limit(50); // Limit to most recent 50 recommendations
    
    console.log(`Found ${storedRecommendations.length} stored recommendations for user ${user.username}`);
    return storedRecommendations;
  }

  /**
   * Generate and store AI recommendations for stored campaigns
   */
  async generateRecommendationsForStoredCampaigns(userId: string): Promise<{ generated: number; errors: number }> {
    console.log(`Generating AI recommendations for stored campaigns - user: ${userId}`);
    
    try {
      // Get all stored campaigns for this user
      const storedCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.userId, userId));

      if (storedCampaigns.length === 0) {
        console.log('No stored campaigns found for AI analysis');
        return { generated: 0, errors: 0 };
      }

      let generated = 0;
      let errors = 0;

      // Clear old recommendations (keep only last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      await db
        .delete(recommendations)
        .where(
          and(
            eq(recommendations.userId, userId),
            gte(recommendations.createdAt, sevenDaysAgo)
          )
        );

      // Generate recommendations for each campaign
      for (const campaign of storedCampaigns) {
        try {
          await this.generateCampaignRecommendation(campaign);
          generated++;
        } catch (error) {
          console.error(`Failed to generate recommendation for campaign ${campaign.name}:`, error);
          errors++;
        }
      }

      console.log(`AI recommendation generation complete: ${generated} generated, ${errors} errors`);
      return { generated, errors };
    } catch (error) {
      console.error('Failed to generate recommendations for stored campaigns:', error);
      throw error;
    }
  }

  /**
   * Generate AI recommendation for a specific campaign
   */
  private async generateCampaignRecommendation(campaign: Campaign): Promise<void> {
    // Build comprehensive context for AI analysis
    const context = `
      Campaign Performance Analysis:
      
      Campaign: ${campaign.name}
      Type: ${campaign.type}
      Status: ${campaign.status}
      Account ID: ${campaign.accountId}
      
      Current Performance Metrics:
      - Impressions: ${campaign.impressions?.toLocaleString() || 0}
      - Clicks: ${campaign.clicks?.toLocaleString() || 0}
      - Conversions: ${campaign.conversions || 0}
      - Total Spend: ₹${campaign.cost?.toLocaleString() || 0}
      - CTR: ${((campaign.ctr || 0) * 100).toFixed(2)}%
      - Avg CPC: ₹${campaign.avgCpc ? Number(campaign.avgCpc).toFixed(2) : 0}
      - Conversion Rate: ${((campaign.conversionRate || 0) * 100).toFixed(2)}%
      - Actual CPA: ${campaign.actualCpa ? '₹' + Number(campaign.actualCpa).toFixed(2) : 'Not calculated'}
      - Actual ROAS: ${campaign.actualRoas ? Number(campaign.actualRoas).toFixed(2) + 'x' : 'Not calculated'}
      
      Campaign Goals:
      - Target CPA: ${campaign.targetCpa ? '₹' + campaign.targetCpa : 'Not set'}
      - Target ROAS: ${campaign.targetRoas ? campaign.targetRoas + 'x' : 'Not set'}
      - Goal Description: ${campaign.goalDescription || 'No specific goals defined'}
      
      Budget Information:
      - Daily Budget: ₹${campaign.dailyBudget?.toLocaleString() || 'Not available'}
      
      Last Updated: ${campaign.lastSyncAt?.toISOString() || 'Unknown'}
      Data Age: ${campaign.lastSyncAt ? Math.floor((Date.now() - campaign.lastSyncAt.getTime()) / (1000 * 60 * 60)) + ' hours ago' : 'Unknown'}
    `;

    // Determine goal context for AI
    const hasGoals = campaign.targetCpa || campaign.targetRoas || campaign.goalDescription;
    const goalContext = hasGoals 
      ? `Campaign has defined goals: ${campaign.targetCpa ? `CPA ≤ ₹${campaign.targetCpa}` : ''} ${campaign.targetRoas ? `ROAS ≥ ${campaign.targetRoas}x` : ''} ${campaign.goalDescription || ''}`.trim()
      : 'No specific optimization goals set - recommend general performance improvements';

    // Build AI prompt for analysis
    const prompt = buildPrompt({
      metrics_json: JSON.stringify({
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        conversions: campaign.conversions,
        cost: campaign.cost,
        ctr: campaign.ctr,
        avgCpc: campaign.avgCpc,
        conversionRate: campaign.conversionRate,
        actualCpa: campaign.actualCpa,
        actualRoas: campaign.actualRoas
      }),
      goals: goalContext,
      context: context,
      role: 'optimization_expert',
      mode: 'daily_analysis',
      output_format: 'actionable_recommendation'
    });

    // Generate AI recommendation
    const aiResponse = await this.multiAIService.generateSingle(
      prompt,
      'OpenAI', // Use OpenAI for stored data analysis
      campaign
    );

    if (aiResponse && aiResponse.content) {
      // Categorize recommendation
      const recommendationType = this.categorizeRecommendation(aiResponse.content);
      
      // Save to database
      await db.insert(recommendations).values({
        userId: campaign.userId,
        campaignId: campaign.id,
        type: recommendationType,
        content: aiResponse.content,
        confidence: aiResponse.confidence || 75,
        provider: 'OpenAI',
        isApplied: false,
        createdAt: new Date()
      });

      console.log(`Generated ${recommendationType} recommendation for campaign: ${campaign.name}`);
    }
  }

  /**
   * Categorize AI recommendation based on content analysis
   */
  private categorizeRecommendation(content: string): 'actionable' | 'monitor' | 'clarification' {
    const lowerContent = content.toLowerCase();
    
    // Actionable keywords - specific changes to implement
    const actionablePatterns = [
      'increase', 'decrease', 'adjust', 'optimize', 'change', 'modify',
      'add negative', 'pause', 'enable', 'disable', 'set bid',
      'update budget', 'add keyword', 'remove keyword', 'split test'
    ];
    
    // Monitor keywords - watch and observe
    const monitorPatterns = [
      'monitor', 'watch', 'track', 'observe', 'keep an eye',
      'continue monitoring', 'check performance', 'review weekly'
    ];
    
    // Clarification keywords - need more information
    const clarificationPatterns = [
      'clarify', 'more information', 'unclear', 'specify',
      'define goals', 'what is your', 'need to know', 'please provide'
    ];
    
    // Check for clarification first
    if (clarificationPatterns.some(pattern => lowerContent.includes(pattern))) {
      return 'clarification';
    }
    
    // Check for monitoring
    if (monitorPatterns.some(pattern => lowerContent.includes(pattern))) {
      return 'monitor';
    }
    
    // Check for actionable (most specific patterns)
    if (actionablePatterns.some(pattern => lowerContent.includes(pattern))) {
      return 'actionable';
    }
    
    // Default to monitor if unclear (safer than assuming actionable)
    return 'monitor';
  }

  /**
   * Get recommendation statistics for dashboard
   */
  async getRecommendationStats(userId: string, selectedAccountIds?: string[]): Promise<{
    total: number;
    actionable: number;
    monitor: number;
    clarification: number;
    recent: number;
  }> {
    const userRecommendations = await this.getUserRecommendations(userId, selectedAccountIds);
    
    const stats = {
      total: userRecommendations.length,
      actionable: userRecommendations.filter(r => r.type === 'actionable').length,
      monitor: userRecommendations.filter(r => r.type === 'monitor').length,
      clarification: userRecommendations.filter(r => r.type === 'clarification').length,
      recent: userRecommendations.filter(r => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return r.createdAt > dayAgo;
      }).length
    };
    
    return stats;
  }
}