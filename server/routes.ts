import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./localAuth";
import { setupGoogleAdsAuth } from "./googleAdsAuth";
import { AIRecommendationService } from "./services/aiRecommendationService";
import { CampaignService } from "./services/campaignService";
import { MultiAIService } from "./services/multiAIService";
import { GoogleAdsService } from "./services/googleAdsService";
import { DailySyncService } from "./services/dailySyncService";
import { schedulerService } from "./services/schedulerService";
import { StoredRecommendationService } from "./services/storedRecommendationService";
import { insertCampaignSchema, insertUserSettingsSchema, campaigns, googleAdsAccounts, auditLogs, recommendations, userSettings, users } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./db";
import { buildPrompt } from "./prompts/corePrompt";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Google Ads OAuth setup
  await setupGoogleAdsAuth(app);

  const aiService = new AIRecommendationService();
  const campaignService = new CampaignService();
  const multiAIService = new MultiAIService();
  const dailySyncService = new DailySyncService();
  const storedRecommendationService = new StoredRecommendationService();

  // User management routes (admin only)
  app.get('/api/admin/users', isAdmin, async (req: any, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          createdBy: users.createdBy,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.patch('/api/admin/users/:id/status', isAdmin, async (req: any, res) => {
    try {
      const { isActive } = req.body;
      const userId = req.params.id;

      const [updatedUser] = await db
        .update(users)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          isActive: users.isActive
        });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: updatedUser 
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      res.status(500).json({ message: 'Failed to update user status' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      console.log('Auth user request for:', user.id);
      
      // Return the actual user data
      const userResponse = {
        id: user.id,
        username: user.username,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        role: user.role,
        isActive: user.isActive,
        profileImageUrl: user.profileImageUrl || null
      };
      
      console.log('Returning user response:', userResponse);
      res.json(userResponse);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Delete user (admin only, sub-accounts only)
  app.delete('/api/admin/users/:id', isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const adminUser = req.user;

      // First, get the user to be deleted to check their role
      const [userToDelete] = await db
        .select({ role: users.role, username: users.username })
        .from(users)
        .where(eq(users.id, userId));

      if (!userToDelete) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent deleting admin accounts
      if (userToDelete.role === 'admin') {
        return res.status(403).json({ message: 'Cannot delete admin accounts' });
      }

      // Prevent admins from deleting themselves (extra safety)
      if (userId === adminUser.id) {
        return res.status(403).json({ message: 'Cannot delete your own account' });
      }

      // Use transaction to ensure all deletions happen atomically
      const result = await db.transaction(async (tx) => {
        console.log(`Starting cascade deletion for user ${userId}`);
        
        // Delete user settings
        const deletedSettings = await tx
          .delete(userSettings)
          .where(eq(userSettings.userId, userId))
          .returning({ id: userSettings.id });
        console.log(`Deleted ${deletedSettings.length} user settings`);

        // Delete campaigns created by this user
        const deletedCampaigns = await tx
          .delete(campaigns)
          .where(eq(campaigns.userId, userId))
          .returning({ id: campaigns.id });
        console.log(`Deleted ${deletedCampaigns.length} campaigns`);

        // Delete recommendations for this user
        const deletedRecommendations = await tx
          .delete(recommendations)
          .where(eq(recommendations.userId, userId))
          .returning({ id: recommendations.id });
        console.log(`Deleted ${deletedRecommendations.length} recommendations`);

        // Delete audit logs for this user
        const deletedAudits = await tx
          .delete(auditLogs)
          .where(eq(auditLogs.userId, userId))
          .returning({ id: auditLogs.id });
        console.log(`Deleted ${deletedAudits.length} audit logs`);

        // Finally, delete the user
        const [deletedUser] = await tx
          .delete(users)
          .where(eq(users.id, userId))
          .returning({ username: users.username });

        console.log(`Deleted user: ${deletedUser?.username}`);
        return deletedUser;
      });

      if (!result) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: `Sub-account "${result.username}" has been permanently deleted`
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Update user profile
  app.patch('/api/auth/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { firstName, lastName, email, profileImageUrl } = req.body;
      
      // Basic validation
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      
      const [updatedUser] = await db
        .update(users)
        .set({ 
          firstName: firstName || null,
          lastName: lastName || null, 
          email: email || null,
          profileImageUrl: profileImageUrl || null,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id))
        .returning({
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          isActive: users.isActive,
          profileImageUrl: users.profileImageUrl
        });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: 'Profile updated successfully',
        user: updatedUser 
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Performance-specific endpoint with date range filtering
  app.get('/api/performance/campaigns', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
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
      
      // Parse date range parameters for Performance page only
      const dateFromParam = req.query.dateFrom as string;
      const dateToParam = req.query.dateTo as string;
      const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
      const dateTo = dateToParam ? new Date(dateToParam) : undefined;
      
      // Use a separate method for Performance page that respects date ranges
      const campaigns = await campaignService.getPerformanceCampaigns(dbUserId, selectedAccounts, dateFrom, dateTo);
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching performance campaigns:', error);
      res.status(500).json({ message: 'Failed to fetch performance campaigns' });
    }
  });

  // Performance-specific dashboard summary with date range filtering
  app.get('/api/performance/summary', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
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
      
      // Parse date range parameters for Performance page only
      const dateFromParam = req.query.dateFrom as string;
      const dateToParam = req.query.dateTo as string;
      const dateFrom = dateFromParam ? new Date(dateFromParam) : undefined;
      const dateTo = dateToParam ? new Date(dateToParam) : undefined;
      
      const summary = await aiService.getPerformanceSummary(dbUserId, selectedAccounts, dateFrom, dateTo);
      res.json(summary);
    } catch (error) {
      console.error('Error fetching performance summary:', error);
      res.status(500).json({ message: 'Failed to fetch performance summary' });
    }
  });

  // Dashboard summary endpoint
  app.get('/api/dashboard/summary', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
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
      
      console.log('Dashboard summary for user:', { userId: user.id, dbUserId, userEmail: user.email, selectedAccounts });
      
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
      const user = req.user;
      
      if (!user) {
        console.log('No user found for campaigns');
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
      
      // Use stored data first (primary method for daily operations)
      let campaigns = await campaignService.getUserCampaignsFromStorage(dbUserId, selectedAccounts);
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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

  // User settings endpoints
  app.get('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const settings = await storage.getUserSettings(dbUserId);
      
      if (!settings) {
        // Return default settings if none exist
        const defaultSettings = {
          aiFrequency: 'daily',
          confidenceThreshold: 70,
          emailAlerts: true,
          dailySummaries: false,
          budgetAlerts: true,
          selectedGoogleAdsAccounts: [],
          currentViewAccounts: []
        };
        res.json(defaultSettings);
      } else {
        res.json(settings);
      }
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  // Get admin settings for sub-accounts
  app.get('/api/admin/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only sub-accounts can access this endpoint
      if (user.role !== 'sub_account') {
        return res.status(403).json({ message: "Access denied - sub-accounts only" });
      }

      // Find admin users
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, 'admin'));

      if (adminUsers.length === 0) {
        return res.status(404).json({ message: "No admin users found" });
      }

      // Get the first admin's settings
      const adminUserId = adminUsers[0].id;
      const [adminSettings] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, adminUserId));

      if (!adminSettings) {
        // Return default settings if admin hasn't configured anything
        return res.json({
          selectedGoogleAdsAccounts: [],
          aiFrequency: 'daily',
          confidenceThreshold: 70,
          emailAlerts: true,
          dailySummaries: false,
          budgetAlerts: true
        });
      }

      res.json(adminSettings);
    } catch (error) {
      console.error('Error fetching admin settings:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.patch('/api/user/settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      
      // Validate request body
      const validatedSettings = insertUserSettingsSchema.parse(req.body);
      
      const updatedSettings = await storage.upsertUserSettings(dbUserId, validatedSettings);
      
      res.json({
        message: "Settings updated successfully",
        settings: updatedSettings
      });
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  // Recommendations endpoints
  app.get('/api/recommendations', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const dbUserId = user.id.toString();
      const selectedAccountsParam = req.query.selectedAccounts;
      let selectedAccounts: string[] | undefined = undefined;
      
      console.log('🔍 DEBUG: Recommendations route - selectedAccountsParam received:', selectedAccountsParam);
      
      if (selectedAccountsParam) {
        try {
          selectedAccounts = JSON.parse(decodeURIComponent(selectedAccountsParam as string));
          console.log('🔍 DEBUG: Parsed selectedAccounts for recommendations:', selectedAccounts);
        } catch (e) {
          console.log('❌ Failed to parse selectedAccounts:', e);
        }
      } else {
        console.log('⚠️ DEBUG: No selectedAccountsParam received for recommendations - using undefined');
      }

      // Use stored recommendation service for efficient data retrieval
      const userRecommendations = await storedRecommendationService.getUserRecommendations(dbUserId, selectedAccounts);
      res.json(userRecommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Get last generation timestamp
  app.get('/api/recommendations/last-generated', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
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
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { selectedAccounts } = req.body;
      const dbUserId = user.id.toString();
      console.log(`DEBUG: Generating recommendations for user ${dbUserId} (User ID: ${user.id}) with selected accounts:`, selectedAccounts);
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
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
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const { selectedAccounts } = req.body;
      const dbUserId = user.id;
      console.log(`DEBUG: Refreshing Google Ads data for user ${dbUserId} (User ID: ${user.id}) with selected accounts:`, selectedAccounts);
      
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
      const user = req.user;
      console.log(`=== /api/google-ads/available-accounts request for user: ${user?.username} (${user?.role}) ===`);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const dbUserId = user.id.toString();
      
      // For sub-accounts, find admin users to get their connected Google Ads accounts
      // For admin users, use their own connected accounts
      let targetUserIds = [dbUserId]; // Default: current user
      
      if (user.role === 'sub_account') {
        console.log('This is a sub-account, looking for admin users...');
        // Sub-accounts should see Google Ads accounts connected by any admin
        const adminUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, 'admin'));
        
        targetUserIds = adminUsers.map(admin => admin.id);
        console.log(`Sub-account ${user.username} accessing Google Ads accounts from admins:`, targetUserIds);
      } else {
        console.log('This is an admin user, using their own accounts');
      }
      
      // Get connected Google Ads accounts (simplified approach)
      console.log('Querying for Google Ads accounts with targetUserIds:', targetUserIds);
      
      // Simple approach: just check each target user ID
      let connectedAccounts = [];
      for (const userId of targetUserIds) {
        console.log(`Checking Google Ads accounts for user ID: ${userId}`);
        const accounts = await db
          .select()
          .from(googleAdsAccounts)
          .where(
            and(
              eq(googleAdsAccounts.adminUserId, userId),
              eq(googleAdsAccounts.isActive, true)
            )
          );
        console.log(`Found ${accounts.length} accounts for user ${userId}:`, accounts.map(acc => ({ id: acc.id, customerId: acc.customerId })));
        connectedAccounts.push(...accounts);
      }
      
      console.log(`Total connected accounts found: ${connectedAccounts.length}`);
      
      // For sub-accounts, they should see the manager account but with restricted child account access
      if (user.role === 'sub_account') {
        console.log(`Sub-account will see admin's connected accounts, but data will be filtered by admin's selections`);
        // Sub-accounts see all connected accounts from admin
        // The filtering happens at the campaign data level, not account connection level
      }
      
      console.log('Final accounts to return:', connectedAccounts.map(acc => ({ id: acc.id, adminUserId: acc.adminUserId, customerId: acc.customerId })));

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
      const user = req.user;
      
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

  // Disconnect all Google Ads accounts for admin user
  app.post('/api/google-ads/disconnect-all', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Only admins can disconnect Google Ads integration
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can disconnect Google Ads integration" });
      }

      const dbUserId = user.id.toString();
      console.log(`Admin ${user.username} (${dbUserId}) requesting to disconnect all Google Ads accounts`);
      
      // Get all active Google Ads accounts for this admin
      const accounts = await db
        .select()
        .from(googleAdsAccounts)
        .where(
          and(
            eq(googleAdsAccounts.adminUserId, dbUserId),
            eq(googleAdsAccounts.isActive, true)
          )
        );

      if (accounts.length === 0) {
        return res.status(404).json({ message: 'No active Google Ads accounts found to disconnect' });
      }

      console.log(`Found ${accounts.length} Google Ads accounts to disconnect`);

      // Optional: Revoke refresh tokens with Google before deleting
      // This is a security best practice but not strictly required
      try {
        const { OAuth2Client } = await import('google-auth-library');
        const oauth2Client = new OAuth2Client(
          process.env.GOOGLE_OAUTH_CLIENT_ID,
          process.env.GOOGLE_OAUTH_CLIENT_SECRET
        );

        for (const account of accounts) {
          if (account.refreshToken) {
            try {
              await oauth2Client.revokeToken(account.refreshToken);
              console.log(`Revoked refresh token for account ${account.customerId}`);
            } catch (revokeError) {
              console.warn(`Failed to revoke token for account ${account.customerId}:`, revokeError);
              // Continue with deletion even if revocation fails
            }
          }
        }
      } catch (oauthError) {
        console.warn('Failed to revoke tokens with Google:', oauthError);
        // Continue with database cleanup even if token revocation fails
      }

      // Delete all Google Ads accounts for this admin
      const deletedAccounts = await db
        .delete(googleAdsAccounts)
        .where(eq(googleAdsAccounts.adminUserId, dbUserId))
        .returning();

      console.log(`Successfully disconnected ${deletedAccounts.length} Google Ads accounts`);

      // Clear all campaigns for this user since they're no longer connected to Google Ads
      const userCampaigns = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.userId, dbUserId));
      const campaignIds = userCampaigns.map(c => c.id);

      // Clean up related data (audit logs and recommendations)
      for (const campaignId of campaignIds) {
        await db.delete(auditLogs).where(eq(auditLogs.campaignId, campaignId));
        await db.delete(recommendations).where(eq(recommendations.campaignId, campaignId));
      }
      
      // Delete campaigns
      await db.delete(campaigns).where(eq(campaigns.userId, dbUserId));

      // Clear Google Ads account selections from user settings
      await db
        .update(userSettings)
        .set({
          selectedGoogleAdsAccounts: [],
          currentViewAccounts: [],
          updatedAt: new Date()
        })
        .where(eq(userSettings.userId, dbUserId));

      res.json({
        message: `Successfully disconnected ${deletedAccounts.length} Google Ads accounts and cleared all related data`,
        disconnectedAccounts: deletedAccounts.length
      });
    } catch (error) {
      console.error("Error disconnecting Google Ads integration:", error);
      res.status(500).json({ message: "Failed to disconnect Google Ads integration", error: error.message });
    }
  });

  // Daily Sync Management Routes (Admin Only)
  
  // Get sync status and last run information
  app.get('/api/sync/status', isAdmin, async (req: any, res) => {
    try {
      const syncStatus = await dailySyncService.getSyncStatus();
      const schedulerStatus = schedulerService.getStatus();
      
      res.json({
        ...syncStatus,
        scheduler: schedulerStatus
      });
    } catch (error) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ message: "Failed to get sync status", error: error.message });
    }
  });

  // Manually trigger daily sync
  app.post('/api/sync/trigger', isAdmin, async (req: any, res) => {
    try {
      console.log(`Manual sync triggered by admin user: ${req.user.username}`);
      const result = await schedulerService.triggerManualSync();
      
      res.json(result);
    } catch (error) {
      console.error("Error triggering manual sync:", error);
      res.status(500).json({ message: "Failed to trigger sync", error: error.message });
    }
  });

  // Initial data pull for authenticated users (temporary endpoint for setup)
  app.post('/api/sync/initial', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      console.log(`Initial sync triggered by user: ${user.username}`);
      const result = await schedulerService.triggerManualSync();
      
      res.json(result);
    } catch (error) {
      console.error("Error triggering initial sync:", error);
      res.status(500).json({ message: "Failed to trigger initial sync", error: error.message });
    }
  });

  // Simplified AI Chat Assistant Endpoint
  app.post('/api/chat/query', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { query, provider = 'OpenAI' } = req.body;
      
      if (!query?.trim()) {
        return res.status(400).json({ message: 'Query is required' });
      }

      // Get ALL campaign data from storage
      const allCampaigns = await campaignService.getUserCampaignsFromStorage(dbUserId);
      const connectedAccounts = await storage.getGoogleAdsAccounts(dbUserId);
      
      console.log(`💬 Chat Query: "${query}" | Campaigns: ${allCampaigns.length}`);

      // Build complete account data
      const completeAccountData = {
        connectedAccounts: connectedAccounts.map(acc => ({
          name: acc.customerName,
          customerId: acc.customerId,
          isActive: acc.isActive
        })),
        totalCampaigns: allCampaigns.length,
        totalSpend7d: allCampaigns.reduce((sum: number, c: any) => sum + (parseFloat(c.spend7d) || 0), 0),
        totalConversions7d: allCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.conversions7d) || 0), 0),
        totalConversionValue7d: allCampaigns.reduce((sum: number, c: any) => sum + (parseFloat(c.conversionValue7d) || 0), 0),
        campaigns: allCampaigns.map(c => ({
          name: c.name,
          type: c.type,
          status: c.status,
          budget: c.dailyBudget,
          spend_last_7_days: c.spend7d,
          conversions_last_7_days: c.conversions7d,
          conversion_value_last_7_days: c.conversionValue7d,
          cost_per_acquisition: c.actualCpa,
          return_on_ad_spend: c.actualRoas,
          target_cpa: c.targetCpa,
          target_roas: c.targetRoas
        }))
      };

      // Simple, clear system prompt
      const systemPrompt = `You are a friendly Google Ads expert assistant with complete access to the user's Google Ads account data. Answer questions naturally like you're having a conversation with a colleague.

ACCOUNT DATA (Complete and Real-Time):
${JSON.stringify(completeAccountData, null, 2)}

CRITICAL RESPONSE RULES:
1. You have FULL ACCESS to all campaign data above - analyze it directly
2. Write ONLY in natural, flowing conversational language like ChatGPT
3. Provide specific metrics and numbers from the actual data using INR (₹)
4. ABSOLUTELY FORBIDDEN - Never use these in your response:
   - "Expected Outcome:"
   - "Confidence Score:"
   - "Action Type:"
   - "Recommendation:"
   - Any numbered section headers
   - Any bold headings or labels
   - Any structured template formats
   - Any JSON or code-like formatting
5. Instead, integrate all information naturally into conversational sentences
6. Example good response: "Your Girlfriend campaign is performing really well with a ROAS of 4.2x. You've spent ₹45,000 and got 89 conversions at ₹506 per conversion. I'd recommend increasing the budget by 15% since it's crushing your targets."
7. Example BAD response: "Expected Outcome: Increased conversions... Confidence Score: 85"

Write naturally and conversationally - like you're chatting with a friend about their ads performance.`;

      // Generate AI response using raw prompt (bypass structured template)
      const aiResponse = await multiAIService.generateSingle(
        `${systemPrompt}\n\nUser Question: ${query}`,
        provider,
        null,
        true // Use raw prompt without structured template
      );
      
      res.json({
        response: aiResponse.content,
        provider: provider,
        confidence: aiResponse.confidence || 85
      });
    } catch (error) {
      console.error("Error processing chat query:", error);
      res.status(500).json({ message: "Failed to process chat query", error: error.message });
    }
  });

  // Chat consensus endpoint for multi-AI responses
  app.post('/api/chat/consensus', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const dbUserId = user.id.toString();
      const { query, campaignId, campaigns = [] } = req.body;
      
      if (!query?.trim()) {
        return res.status(400).json({ message: 'Query is required' });
      }

      // Get comprehensive account context (same as single query endpoint)
      let campaign = null;
      if (campaignId) {
        campaign = await campaignService.getCampaignById(campaignId, dbUserId);
      } else if (campaigns.length > 0) {
        campaign = campaigns[0];
      }

      // Get user settings for account preferences
      const userSettings = await storage.getUserSettings(dbUserId);
      
      // Get connected Google Ads accounts information
      const connectedAccounts = await storage.getGoogleAdsAccounts(dbUserId);
      
      // Calculate account-level performance summary
      const allCampaigns = campaigns.length > 0 ? campaigns : await campaignService.getUserCampaignsFromStorage(dbUserId);
      const accountSummary = {
        totalCampaigns: allCampaigns.length,
        totalSpend: allCampaigns.reduce((sum: number, c: any) => sum + (parseFloat(c.spend7d) || 0), 0),
        totalConversions: allCampaigns.reduce((sum: number, c: any) => sum + (parseInt(c.conversions7d) || 0), 0),
        totalConversionValue: allCampaigns.reduce((sum: number, c: any) => sum + (parseFloat(c.conversionValue7d) || 0), 0),
        activeCampaigns: allCampaigns.filter((c: any) => c.status === 'active').length,
        campaignTypes: [...new Set(allCampaigns.map((c: any) => c.type))]
      };

      if (!multiAIService.isAvailable()) {
        return res.status(503).json({ message: "Multi-AI service not available" });
      }

      // Build enhanced prompt for consensus with account context
      const enhancedQuery = `You are expert Google Ads strategists with DIRECT ACCESS to the user's complete Google Ads account data.

IMPORTANT: You have full access to all campaign performance data. This is REAL data from their connected account. Use it directly in your analysis - DO NOT ask for manual data sharing.

User Query: ${query}

Account Data Summary:
- Total Campaigns: ${accountSummary.totalCampaigns}
- Active Campaigns: ${accountSummary.activeCampaigns}  
- Total 7-day Spend: ₹${accountSummary.totalSpend.toLocaleString()}
- Total 7-day Conversions: ${accountSummary.totalConversions}
- Total Conversion Value: ₹${accountSummary.totalConversionValue?.toLocaleString() || '0'}
- Campaign Types: ${accountSummary.campaignTypes.join(', ')}
- Connected Accounts: ${connectedAccounts.length}

All Campaigns List:
${allCampaigns.slice(0, 20).map(c => `- ${c.name}: Spend ₹${c.spend7d}, ${c.conversions7d} conversions, ROAS ${c.actualRoas}x`).join('\n')}

Response Format Instructions:
- Write in PLAIN, CONVERSATIONAL LANGUAGE - talk like you're advising a colleague
- DO NOT use ANY structured elements: NO JSON, code blocks, templates, action types, section headers, or labels
- ABSOLUTELY FORBIDDEN: "Expected Outcome:", "Confidence Score:", "Action Type:", "Recommendation:", bold headers, numbered sections
- Integrate metrics naturally into flowing sentences
- Give recommendations directly in your narrative - don't label or categorize them
- Use flowing paragraphs or simple bullet points - NO structured sections
- Keep it natural and conversational throughout

Data Analysis Instructions:
- YOU HAVE DIRECT ACCESS to all campaign data shown above
- Analyze the actual performance metrics provided
- For specific campaign questions, reference the exact data from the campaigns list
- Provide data-driven consensus recommendations with real numbers

Example Good Response: "Looking at your account, you've spent ₹100,000 across 6 campaigns with a solid overall ROAS of 2.3x. Your PMax campaign is your top performer with 114 conversions. You should shift 20% more budget there to capitalize on its strong performance."

Example Bad Responses to AVOID:
- "Action Type: Recommendation {data: {...}, analysis: {...}}"
- "Expected Outcome: Increased conversions..."
- "Confidence Score: 85"
- "**Key Finding:** Your campaign..."
- Any response with section headers or structured labels

Provide comprehensive analysis using the real data above in natural, helpful language.`;

      // Generate consensus with enhanced prompt
      const consensus = await multiAIService.generateWithConsensus(
        enhancedQuery,
        campaign
      );
      
      res.json({
        response: consensus.finalRecommendation,
        consensus: consensus,
        provider: 'Multi-AI Consensus',
        confidence: consensus.confidence,
        accountContext: {
          totalCampaigns: accountSummary.totalCampaigns,
          connectedAccounts: connectedAccounts.length,
          specificCampaign: campaign?.name || null
        },
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
