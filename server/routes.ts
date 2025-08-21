import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
// Note: Google Ads authentication is now integrated with main authentication
import { AIRecommendationService } from "./services/aiRecommendationService";
import { CampaignService } from "./services/campaignService";
import { MultiAIService } from "./services/multiAIService";
import { insertCampaignSchema, campaigns, googleAdsAccounts, auditLogs, recommendations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Note: Google Ads authentication is now integrated with main authentication
  // No separate setup needed

  const aiService = new AIRecommendationService();
  const campaignService = new CampaignService();
  const multiAIService = new MultiAIService();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      console.log('Auth user request for:', replitUserId);
      
      const user = await storage.getUser(replitUserId);
      console.log('User from storage:', user);
      
      if (!user) {
        console.log('No user found, returning minimal user object');
        return res.json({
          id: 'temp-' + replitUserId,
          replit_user_id: replitUserId,
          firstName: req.user.name || 'User',
          lastName: '',
          email: req.user.email || '',
          profileImageUrl: req.user.profileImageUrl || null
        });
      }
      
      // Ensure we return a valid JSON response
      const userResponse = {
        id: user.id,
        replit_user_id: user.replit_user_id || replitUserId,
        firstName: user.firstName || req.user.name || 'User',
        lastName: user.lastName || '',
        email: user.email || req.user.email || '',
        profileImageUrl: user.profileImageUrl || req.user.profileImageUrl || null
      };
      
      console.log('Returning user response:', userResponse);
      res.json(userResponse);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard summary endpoint
  app.get('/api/dashboard/summary', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      const dbUserId = user?.id?.toString() || replitUserId;
      
      console.log('Dashboard summary for user:', { replitUserId, dbUserId });
      const summary = await aiService.getDashboardSummary(dbUserId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  // Campaigns endpoints
  app.get('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      const dbUserId = user?.id?.toString() || replitUserId;
      
      console.log('Campaigns for user:', { replitUserId, dbUserId });
      let campaigns = await campaignService.getUserCampaigns(dbUserId);
      
      // Filter to only show active campaigns
      const activeCampaigns = campaigns.filter(campaign => 
        campaign.status === 'active' || campaign.status === 'enabled'
      );
      
      // Initialize sample campaigns ONLY if no Google Ads connection AND no active campaigns
      if (activeCampaigns.length === 0) {
        const hasGoogleAdsConnection = await campaignService.hasGoogleAdsConnection(userId);
        if (!hasGoogleAdsConnection) {
          campaigns = await campaignService.initializeSampleCampaigns(userId);
          res.json(campaigns);
          return;
        }
      }
      
      res.json(activeCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaign = await campaignService.getCampaignById(req.params.id, userId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching campaign:", error);
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  app.post('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        userId
      });
      
      const campaign = await campaignService.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      res.status(400).json({ message: "Failed to create campaign" });
    }
  });

  app.patch('/api/campaigns/:id/goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { targetCpa, targetRoas, goalDescription } = req.body;
      
      console.log(`DEBUG: Updating goals for campaign ${req.params.id}:`, { targetCpa, targetRoas, goalDescription });
      
      const campaign = await campaignService.updateCampaignGoals(
        req.params.id,
        userId,
        { targetCpa, targetRoas, goalDescription }
      );
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      console.log(`DEBUG: Goals updated successfully for campaign ${req.params.id}`);
      res.json({ 
        message: "Campaign goals updated successfully",
        campaign 
      });
    } catch (error) {
      console.error("Error updating campaign goals:", error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      res.status(500).json({ message: "Failed to update campaign goals" });
    }
  });

  // Recommendations endpoints
  app.get('/api/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recommendations = await aiService.getRecommendationsByUser(userId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  app.post('/api/recommendations/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`DEBUG: Generating recommendations for user ${userId}`);
      const recommendations = await aiService.generateRecommendationsForUser(userId);
      console.log(`DEBUG: Generated ${recommendations.length} recommendations`);
      res.json({ 
        message: "Recommendations generated successfully",
        count: recommendations.length,
        recommendations 
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  app.post('/api/recommendations/:id/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await aiService.applyRecommendation(req.params.id, userId);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to apply recommendation" });
      }
      
      res.json({ message: "Recommendation applied successfully" });
    } catch (error) {
      console.error("Error applying recommendation:", error);
      res.status(500).json({ message: "Failed to apply recommendation" });
    }
  });

  app.post('/api/recommendations/:id/dismiss', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await aiService.dismissRecommendation(req.params.id, userId);
      
      if (!success) {
        return res.status(400).json({ message: "Failed to dismiss recommendation" });
      }
      
      res.json({ message: "Recommendation dismissed successfully" });
    } catch (error) {
      console.error("Error dismissing recommendation:", error);
      res.status(500).json({ message: "Failed to dismiss recommendation" });
    }
  });

  // Enhanced 1-click apply with real campaign changes
  app.post('/api/recommendations/:id/apply-live', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recommendation = await storage.getRecommendations(req.params.id);
      
      if (!recommendation.length) {
        return res.status(404).json({ message: "Recommendation not found" });
      }

      // Apply the recommendation and make real changes
      const result = await aiService.applyRecommendationLive(req.params.id, userId);
      
      res.json({
        message: "Recommendation applied with live changes",
        appliedChanges: result.changes,
        status: result.success ? 'applied' : 'failed'
      });
    } catch (error) {
      console.error("Error applying live recommendation:", error);
      res.status(500).json({ message: "Failed to apply live recommendation" });
    }
  });

  // Multi-AI consensus recommendations
  app.post('/api/recommendations/generate-consensus', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { campaignId, prompt } = req.body;
      
      if (!multiAIService.isAvailable()) {
        return res.status(503).json({ message: "Multi-AI service not available" });
      }

      // Get campaign context using campaign service
      const campaign = await campaignService.getCampaignById(campaignId, userId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const consensus = await multiAIService.generateWithConsensus(
        prompt || `Analyze this campaign performance and provide optimization recommendations`,
        campaign
      );
      
      res.json({
        consensus,
        availableModels: multiAIService.getAvailableProviders()
      });
    } catch (error) {
      console.error("Error generating AI consensus:", error);
      res.status(500).json({ message: "Failed to generate AI consensus" });
    }
  });

  // Get available AI providers
  app.get('/api/ai/providers', isAuthenticated, async (req: any, res) => {
    try {
      res.json({
        available: multiAIService.getAvailableProviders(),
        isReady: multiAIService.isAvailable()
      });
    } catch (error) {
      console.error("Error fetching AI providers:", error);
      res.status(500).json({ message: "Failed to fetch AI providers" });
    }
  });

  // Generate recommendations with specific AI provider
  app.post('/api/recommendations/generate-with-provider', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { campaignId, provider, prompt } = req.body;
      
      // Get campaign using campaign service
      const campaign = await campaignService.getCampaignById(campaignId, userId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const response = await multiAIService.generateSingle(
        prompt || `Analyze this campaign and provide specific optimization recommendations`,
        provider || 'OpenAI',
        campaign
      );
      
      res.json(response);
    } catch (error) {
      console.error("Error generating provider-specific recommendation:", error);
      res.status(500).json({ message: "Failed to generate recommendation" });
    }
  });

  // Real-time campaign monitoring endpoint
  app.get('/api/campaigns/:id/monitor', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const campaignId = req.params.id;
      
      // This would integrate with real-time Google Ads data
      const monitoringData = {
        campaignId,
        lastUpdated: new Date().toISOString(),
        alerts: [],
        liveMetrics: {
          impressions: Math.floor(Math.random() * 1000),
          clicks: Math.floor(Math.random() * 100),
          spend: Math.floor(Math.random() * 500),
          conversions: Math.floor(Math.random() * 10)
        },
        status: 'monitoring',
        nextCheckIn: new Date(Date.now() + 300000).toISOString() // 5 minutes
      };
      
      res.json(monitoringData);
    } catch (error) {
      console.error("Error fetching campaign monitoring data:", error);
      res.status(500).json({ message: "Failed to fetch monitoring data" });
    }
  });

  // Audit trail endpoint
  app.get('/api/audit-trail', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const auditTrail = await aiService.getAuditTrail(userId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ message: "Failed to fetch audit trail" });
    }
  });


  // Google Ads data refresh endpoint
  app.post('/api/google-ads/refresh', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Clear existing data to force refresh safely
      const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, userId));
      const campaignIds = userCampaigns.map(c => c.id);

      // Clean up audit logs and recommendations first
      for (const campaignId of campaignIds) {
        await db.delete(auditLogs).where(eq(auditLogs.campaignId, campaignId));
        await db.delete(recommendations).where(eq(recommendations.campaignId, campaignId));
      }
      
      // Finally delete campaigns
      await db.delete(campaigns).where(eq(campaigns.userId, userId));
      
      // Get fresh campaigns (this will trigger real data fetch)
      const freshCampaigns = await campaignService.getUserCampaigns(userId);
      
      res.json({ 
        message: `Refreshed ${freshCampaigns.length} campaigns from Google Ads`,
        campaigns: freshCampaigns
      });
    } catch (error) {
      console.error("Error refreshing Google Ads data:", error);
      res.status(500).json({ message: "Failed to refresh Google Ads data", error: error.message });
    }
  });

  // Update Google Ads customer ID endpoint
  app.post('/api/google-ads/update-customer-id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { customerId, customerName } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID is required' });
      }
      
      // Update the existing Google Ads account with real customer ID
      const [updatedAccount] = await db
        .update(googleAdsAccounts)
        .set({ 
          customerId: customerId.replace(/\D/g, ''), // Remove non-digits
          customerName: customerName || 'Google Ads Account',
          updatedAt: new Date()
        })
        .where(and(eq(googleAdsAccounts.userId, userId), eq(googleAdsAccounts.isActive, true)))
        .returning();
      
      if (!updatedAccount) {
        return res.status(404).json({ message: 'No active Google Ads account found' });
      }
      
      res.json({ 
        message: 'Customer ID updated successfully',
        account: updatedAccount
      });
    } catch (error) {
      console.error("Error updating customer ID:", error);
      res.status(500).json({ message: "Failed to update customer ID", error: error.message });
    }
  });

  // New AI Chat Endpoints for better conversation handling
  
  // General chat query endpoint
  app.post('/api/chat/query', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query, campaignId, provider = 'OpenAI', campaigns = [] } = req.body;
      
      if (!query?.trim()) {
        return res.status(400).json({ message: 'Query is required' });
      }

      let campaign = null;
      if (campaignId) {
        // Get specific campaign if provided
        campaign = await campaignService.getCampaignById(campaignId, userId);
      } else if (campaigns.length > 0) {
        // Use the first campaign from provided list as context
        campaign = campaigns[0];
      }

      // Create highly specific contextual prompt for actionable insights
      let contextualPrompt = `You are a senior Google Ads strategist with 10+ years of experience in the Indian market. Provide specific, actionable insights.

USER QUERY: ${query}

CAMPAIGN ANALYSIS CONTEXT:
${campaign ? `
🎯 CAMPAIGN: ${campaign.name}
📊 PERFORMANCE DATA:
- Campaign Type: ${campaign.type}
- Status: ${campaign.status}
- Daily Budget: ₹${campaign.dailyBudget}
- 7-Day Spend: ₹${campaign.spend7d}
- 7-Day Conversions: ${campaign.conversions7d}
- Current CPA: ${campaign.actualCpa ? '₹' + campaign.actualCpa : 'Unknown'}
- Current ROAS: ${campaign.actualRoas || 'Unknown'}
- Target CPA: ${campaign.targetCpa ? '₹' + campaign.targetCpa : 'Not set'}
- Target ROAS: ${campaign.targetRoas || 'Not set'}
- Campaign Goal: ${campaign.goalDescription || 'No specific goal'}

ANALYSIS REQUIREMENTS:
1. Analyze the campaign name "${campaign.name}" to infer:
   - Business type (e-commerce/service/brand)
   - Product category
   - Target audience
   - Competition level

2. Based on performance metrics, identify:
   - Performance vs targets
   - Budget utilization efficiency  
   - Conversion optimization opportunities
` : `
📊 PORTFOLIO ANALYSIS:
- Total Campaigns: ${campaigns.length}
- Focus: General Google Ads optimization for Indian market
`}

REQUIRED RESPONSE FORMAT:
## 🚀 Campaign Analysis & Recommendations

### 📈 Performance Assessment
- Current vs target performance analysis
- Key issues identified
- Performance scoring (1-10)

### 🎯 Specific Action Items
1. **Budget Optimization**
   - Exact budget recommendations with ₹ amounts
   - Bid adjustment suggestions

2. **Keyword Strategy** 
   - 10-15 specific keyword suggestions based on campaign name
   - Negative keyword recommendations
   - Match type optimization

3. **Targeting Improvements**
   - Specific audience segments for India
   - Geographic targeting recommendations
   - Demographic adjustments

4. **Creative Optimization**
   - Ad copy improvements
   - Landing page suggestions
   - Extension recommendations

### 📊 Expected Results
- Projected CPA improvement: ₹X to ₹Y
- Expected ROAS increase: X% 
- Estimated conversion lift: X%

### ⚡ Priority Actions (Next 7 Days)
- Top 3 immediate changes to implement
- Specific monitoring metrics

CRITICAL: Provide SPECIFIC suggestions with exact keywords, bid amounts in ₹, and measurable targets. No generic advice!`;

      // Generate response using the multiAI service
      const response = await multiAIService.generateSingle(
        contextualPrompt,
        provider,
        campaign
      );
      
      res.json({
        response: response.content,
        provider: provider,
        confidence: response.confidence || 85,
        campaignContext: campaign?.name || 'General analysis',
        model: provider
      });
    } catch (error) {
      console.error("Error processing chat query:", error);
      res.status(500).json({ message: "Failed to process chat query", error: error.message });
    }
  });

  // Chat consensus endpoint for multi-AI responses
  app.post('/api/chat/consensus', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { query, campaignId, campaigns = [] } = req.body;
      
      if (!query?.trim()) {
        return res.status(400).json({ message: 'Query is required' });
      }

      let campaign = null;
      if (campaignId) {
        campaign = await campaignService.getCampaignById(campaignId, userId);
      } else if (campaigns.length > 0) {
        campaign = campaigns[0];
      }

      if (!multiAIService.isAvailable()) {
        return res.status(503).json({ message: "Multi-AI service not available" });
      }

      // Generate consensus with specific analysis requirements
      const consensus = await multiAIService.generateWithConsensus(
        `MULTI-AI CONSENSUS REQUEST: ${query}

CAMPAIGN CONTEXT: ${campaign ? `
Campaign: ${campaign.name}
Performance: ${campaign.conversions7d} conversions, ₹${campaign.actualCpa || 'N/A'} CPA, ₹${campaign.spend7d} spend (7 days)
Budget: ₹${campaign.dailyBudget}/day | Type: ${campaign.type} | Status: ${campaign.status}` : 'General Google Ads analysis for Indian market'}

CONSENSUS ANALYSIS REQUIREMENTS:
Each AI model must provide:

## 🎯 Campaign-Specific Insights
### Performance Diagnosis
- Identify 3 key performance issues
- Rate campaign health (1-10)

### Keyword Recommendations  
- 10 specific keywords to add (based on campaign name analysis)
- 5 negative keywords to exclude
- Bid range suggestions in ₹

### Budget & Bidding Strategy
- Optimal daily budget recommendation (₹)
- CPA target optimization (current vs recommended ₹)
- ROAS improvement strategy

### Targeting Optimization
- Specific Indian market segments
- City-wise targeting priorities 
- Device/time-of-day adjustments

## 📊 Measurable Outcomes
- Expected CPA change: ₹X → ₹Y
- Projected conversion increase: X%
- Timeline for results: X days

## ⚡ Immediate Actions
Top 3 changes to implement today with step-by-step instructions.

CRITICAL: Provide SPECIFIC data points, exact keywords, precise ₹ amounts, and measurable targets. No generic advice allowed!`,
        campaign
      );
      
      res.json({
        response: consensus.finalRecommendation,
        consensus: consensus,
        provider: 'Multi-AI Consensus',
        confidence: consensus.confidence,
        availableModels: multiAIService.getAvailableProviders()
      });
    } catch (error) {
      console.error("Error generating chat consensus:", error);
      res.status(500).json({ message: "Failed to generate consensus", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
