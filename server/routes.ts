import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupGoogleAdsAuth } from "./googleAdsAuth";
import { AIRecommendationService } from "./services/aiRecommendationService";
import { CampaignService } from "./services/campaignService";
import { multiAIService } from "./services/multiAiService";
import { insertCampaignSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Google Ads OAuth setup
  await setupGoogleAdsAuth(app);

  const aiService = new AIRecommendationService();
  const campaignService = new CampaignService();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard summary endpoint
  app.get('/api/dashboard/summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await aiService.getDashboardSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  // Campaigns endpoints
  app.get('/api/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let campaigns = await campaignService.getUserCampaigns(userId);
      
      // Initialize sample campaigns for new users
      if (campaigns.length === 0) {
        campaigns = await campaignService.initializeSampleCampaigns(userId);
      }
      
      res.json(campaigns);
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
      
      const campaign = await campaignService.updateCampaignGoals(
        req.params.id,
        userId,
        { targetCpa, targetRoas, goalDescription }
      );
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Error updating campaign goals:", error);
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
      const recommendations = await aiService.generateRecommendationsForUser(userId);
      res.json({ 
        message: "Recommendations generated successfully",
        count: recommendations.length,
        recommendations 
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
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

      // Get campaign context
      const campaigns = await storage.getCampaigns(userId);
      const campaign = campaigns.find(c => c.id === campaignId);
      
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
      
      const campaigns = await storage.getCampaigns(userId);
      const campaign = campaigns.find(c => c.id === campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      const response = await multiAIService.generateSingle(
        prompt || `Analyze this campaign and provide specific optimization recommendations`,
        provider,
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

  const httpServer = createServer(app);
  return httpServer;
}
