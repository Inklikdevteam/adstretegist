import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { AIRecommendationService } from "./services/aiRecommendationService";
import { CampaignService } from "./services/campaignService";
import { insertCampaignSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

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
