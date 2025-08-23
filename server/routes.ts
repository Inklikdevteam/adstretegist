import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
// Note: Google Ads authentication is now integrated with main authentication
import { AIRecommendationService } from "./services/aiRecommendationService";
import { CampaignService } from "./services/campaignService";
import { MultiAIService } from "./services/multiAIService";
import { GoogleAdsService } from "./services/googleAdsService";
import { insertCampaignSchema, campaigns, googleAdsAccounts, auditLogs, recommendations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { buildPrompt } from "./prompts/corePrompt";

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
        console.log('No user found in database for Replit user:', replitUserId);
        return res.status(401).json({ message: "User not found" });
      }
      
      // Return the actual user data
      const userResponse = {
        id: user.id,
        firstName: user.firstName || 'User',
        lastName: user.lastName || '',
        email: user.email || '',
        profileImageUrl: user.profileImageUrl || null
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
      
      if (!user) {
        console.log('No user found for dashboard summary');
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const selectedAccountsParam = req.query.selectedAccounts as string;
      let selectedAccounts: string[] = [];
      
      if (selectedAccountsParam) {
        try {
          selectedAccounts = JSON.parse(selectedAccountsParam);
        } catch (e) {
          console.log('Invalid selectedAccounts parameter:', selectedAccountsParam);
        }
      }
      
      console.log('Dashboard summary for user:', { replitUserId, dbUserId, userEmail: user.email, selectedAccounts });
      
      const summary = await aiService.getDashboardSummary(dbUserId, selectedAccounts);
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
      
      if (!user) {
        console.log('No user found for campaigns');
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      console.log('Campaigns for user:', { replitUserId, dbUserId, userEmail: user.email });
      
      const selectedAccountsParam = req.query.selectedAccounts as string;
      let selectedAccounts: string[] = [];
      
      if (selectedAccountsParam) {
        try {
          selectedAccounts = JSON.parse(selectedAccountsParam);
        } catch (e) {
          console.log('Invalid selectedAccounts parameter:', selectedAccountsParam);
        }
      }
      
      let campaigns = await campaignService.getUserCampaigns(dbUserId, selectedAccounts);
      
      // Filter to only show active campaigns
      const activeCampaigns = campaigns.filter(campaign => 
        campaign.status === 'active' || campaign.status === 'enabled'
      );
      
      // Since user logged in with Google Ads, they should have campaigns or we initialize sample ones
      if (activeCampaigns.length === 0) {
        console.log('No active campaigns found, initializing sample campaigns for user:', dbUserId);
        campaigns = await campaignService.initializeSampleCampaigns(dbUserId);
        res.json(campaigns);
        return;
      }
      
      res.json(activeCampaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.get('/api/campaigns/:id', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const campaign = await campaignService.getCampaignById(req.params.id, dbUserId);
      
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id;
      const validatedData = insertCampaignSchema.parse({
        ...req.body,
        userId: dbUserId
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { targetCpa, targetRoas, goalDescription } = req.body;
      
      console.log(`DEBUG: Updating goals for campaign ${req.params.id}:`, { targetCpa, targetRoas, goalDescription });
      
      const campaign = await campaignService.updateCampaignGoals(
        req.params.id,
        dbUserId,
        { targetCpa, targetRoas, goalDescription }
      );
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      console.log(`DEBUG: Goals updated successfully for campaign ${req.params.id}:`, campaign);
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const dbUserId = user.id.toString();
      const selectedAccountsParam = req.query.selectedAccounts;
      let selectedAccounts: string[] = [];
      
      if (selectedAccountsParam) {
        try {
          selectedAccounts = JSON.parse(decodeURIComponent(selectedAccountsParam as string));
        } catch (e) {
          console.log('Failed to parse selectedAccounts:', e);
        }
      }

      // Get user campaigns first to filter recommendations
      const userCampaigns = await new CampaignService().getUserCampaigns(dbUserId, selectedAccounts.length > 0 ? selectedAccounts : undefined);
      const campaignIds = userCampaigns.map(c => c.id);

      if (campaignIds.length === 0) {
        return res.json([]);
      }

      // Get recommendations with campaign names, filtered by selected campaigns
      const userRecommendations = await db
        .select({
          id: recommendations.id,
          userId: recommendations.userId,
          campaignId: recommendations.campaignId,
          campaignName: campaigns.name,
          type: recommendations.type,
          priority: recommendations.priority,
          title: recommendations.title,
          description: recommendations.description,
          reasoning: recommendations.reasoning,
          aiModel: recommendations.aiModel,
          confidence: recommendations.confidence,
          status: recommendations.status,
          potentialSavings: recommendations.potentialSavings,
          actionData: recommendations.actionData,
          createdAt: recommendations.createdAt,
          appliedAt: recommendations.appliedAt,
        })
        .from(recommendations)
        .leftJoin(campaigns, eq(recommendations.campaignId, campaigns.id))
        .where(eq(recommendations.userId, dbUserId))
        .orderBy(desc(recommendations.createdAt));

      // Filter results by campaign IDs if specific accounts are selected
      const filteredRecommendations = selectedAccounts.length > 0 
        ? userRecommendations.filter(rec => campaignIds.includes(rec.campaignId))
        : userRecommendations;

      res.json(filteredRecommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Get last generation timestamp
  app.get('/api/recommendations/last-generated', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const dbUserId = user.id.toString();

      const lastGenerated = await db
        .select({ createdAt: recommendations.createdAt })
        .from(recommendations)
        .where(eq(recommendations.userId, dbUserId))
        .orderBy(desc(recommendations.createdAt))
        .limit(1);

      res.json({ 
        lastGenerated: lastGenerated.length > 0 ? lastGenerated[0].createdAt : null 
      });
    } catch (error) {
      console.error("Error fetching last generation time:", error);
      res.status(500).json({ message: "Failed to fetch last generation time" });
    }
  });

  app.post('/api/recommendations/generate', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { selectedAccounts } = req.body;
      const dbUserId = user.id.toString();
      console.log(`DEBUG: Generating recommendations for user ${dbUserId} (Replit: ${replitUserId}) with selected accounts:`, selectedAccounts);
      const recommendations = await aiService.generateRecommendationsForUser(dbUserId, selectedAccounts);
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const success = await aiService.applyRecommendation(req.params.id, dbUserId);
      
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const success = await aiService.dismissRecommendation(req.params.id, dbUserId);
      
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const recommendation = await storage.getRecommendations(req.params.id);
      
      if (!recommendation.length) {
        return res.status(404).json({ message: "Recommendation not found" });
      }

      // Apply the recommendation and make real changes
      const result = await aiService.applyRecommendationLive(req.params.id, dbUserId);
      
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { campaignId, prompt } = req.body;
      
      if (!multiAIService.isAvailable()) {
        return res.status(503).json({ message: "Multi-AI service not available" });
      }

      // Get campaign context using campaign service
      const campaign = await campaignService.getCampaignById(campaignId, dbUserId);
      
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { campaignId, provider, prompt } = req.body;
      
      // Get campaign using campaign service
      const campaign = await campaignService.getCampaignById(campaignId, dbUserId);
      
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const auditTrail = await aiService.getAuditTrail(dbUserId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      res.status(500).json({ message: "Failed to fetch audit trail" });
    }
  });


  // Google Ads data refresh endpoint
  app.post('/api/google-ads/refresh', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { selectedAccounts } = req.body;
      const dbUserId = user.id;
      console.log(`DEBUG: Refreshing Google Ads data for user ${dbUserId} (Replit: ${replitUserId}) with selected accounts:`, selectedAccounts);
      
      // Clear existing data to force refresh safely
      const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, dbUserId));
      const campaignIds = userCampaigns.map(c => c.id);

      // Clean up audit logs and recommendations first
      for (const campaignId of campaignIds) {
        await db.delete(auditLogs).where(eq(auditLogs.campaignId, campaignId));
        await db.delete(recommendations).where(eq(recommendations.campaignId, campaignId));
      }
      
      // Finally delete campaigns
      await db.delete(campaigns).where(eq(campaigns.userId, dbUserId));
      
      // Get fresh campaigns (this will trigger real data fetch) with account filtering
      const freshCampaigns = await campaignService.getUserCampaigns(dbUserId.toString(), selectedAccounts);
      
      res.json({ 
        message: `Refreshed ${freshCampaigns.length} campaigns from Google Ads`,
        campaigns: freshCampaigns
      });
    } catch (error) {
      console.error("Error refreshing Google Ads data:", error);
      res.status(500).json({ message: "Failed to refresh Google Ads data", error: error.message });
    }
  });

  // Get available Google Ads accounts for selection
  app.get('/api/google-ads/available-accounts', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const dbUserId = user.id.toString();
      
      // Get the user's connected Google Ads accounts
      const connectedAccounts = await db
        .select()
        .from(googleAdsAccounts)
        .where(and(eq(googleAdsAccounts.userId, dbUserId), eq(googleAdsAccounts.isActive, true)));

      if (connectedAccounts.length === 0) {
        return res.json({ accounts: [], hasConnection: false });
      }

      const primaryAccount = connectedAccounts.find(acc => acc.isPrimary) || connectedAccounts[0];
      
      if (!primaryAccount.refreshToken || !primaryAccount.customerId || primaryAccount.customerId === 'no-customer-found') {
        return res.json({ accounts: [], hasConnection: false });
      }

      const googleAdsService = new GoogleAdsService({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        refreshToken: primaryAccount.refreshToken,
        customerId: primaryAccount.customerId,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!
      });

      const clientAccounts = await googleAdsService.getClientAccounts();
      
      const accountsWithNames = clientAccounts.map(account => ({
        id: account.id,
        name: account.name || `Account ${account.id}`,
        customerId: account.id
      }));

      res.json({ 
        accounts: accountsWithNames,
        hasConnection: true,
        selectedAccount: req.query.selectedAccount || null
      });
    } catch (error) {
      console.error("Error fetching available Google Ads accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  // Update Google Ads customer ID endpoint
  app.post('/api/google-ads/update-customer-id', isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id;
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
        .where(and(eq(googleAdsAccounts.userId, dbUserId), eq(googleAdsAccounts.isActive, true)))
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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { query, campaignId, provider = 'OpenAI', campaigns = [] } = req.body;
      
      if (!query?.trim()) {
        return res.status(400).json({ message: 'Query is required' });
      }

      let campaign = null;
      if (campaignId) {
        // Get specific campaign if provided
        campaign = await campaignService.getCampaignById(campaignId, dbUserId);
      } else if (campaigns.length > 0) {
        // Use the first campaign from provided list as context
        campaign = campaigns[0];
      }

      // Build campaign metrics JSON
      const metricsJson = campaign ? JSON.stringify({
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        dailyBudget: campaign.dailyBudget,
        spend7d: campaign.spend7d,
        conversions7d: campaign.conversions7d,
        actualCpa: campaign.actualCpa,
        actualRoas: campaign.actualRoas,
        targetCpa: campaign.targetCpa,
        targetRoas: campaign.targetRoas,
        goalDescription: campaign.goalDescription
      }) : 'No specific campaign selected';

      const goals = campaign ? `${campaign.targetCpa ? `Target CPA: ₹${campaign.targetCpa}` : ''} ${campaign.targetRoas ? `Target ROAS: ${campaign.targetRoas}x` : ''} ${campaign.goalDescription || ''}`.trim() || 'No specific goals set' : 'General optimization for Indian market';
      
      const context = `User query: ${query}. ${campaign ? `Campaign context: ${campaign.name}` : `Portfolio analysis with ${campaigns.length} campaigns.`}`;

      const contextualPrompt = buildPrompt({
        metrics_json: metricsJson,
        goals: goals,
        context: context,
        role: 'manager',
        mode: 'deep dive',
        output_format: 'detailed reasoning'
      });

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
      const replitUserId = req.user.claims.sub;
      const user = await storage.getUser(replitUserId);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { query, campaignId, campaigns = [] } = req.body;
      
      if (!query?.trim()) {
        return res.status(400).json({ message: 'Query is required' });
      }

      let campaign = null;
      if (campaignId) {
        campaign = await campaignService.getCampaignById(campaignId, dbUserId);
      } else if (campaigns.length > 0) {
        campaign = campaigns[0];
      }

      if (!multiAIService.isAvailable()) {
        return res.status(503).json({ message: "Multi-AI service not available" });
      }

      // Generate consensus with master prompt
      const consensus = await multiAIService.generateWithConsensus(
        query,
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
