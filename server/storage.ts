import {
  users,
  campaigns,
  recommendations,
  auditLogs,
  googleAdsAccounts,
  userSettings,
  type User,
  type Campaign,
  type InsertCampaign,
  type Recommendation,
  type InsertRecommendation,
  type AuditLog,
  type InsertAuditLog,
  type GoogleAdsAccount,
  type InsertGoogleAdsAccount,
  type UserSettings,
  type InsertUserSettings,
  type CreateUserInput
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations for local authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(userData: Partial<User>): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  
  // Google Ads account operations (admin-only)
  createGoogleAdsAccount(account: InsertGoogleAdsAccount): Promise<GoogleAdsAccount>;
  getGoogleAdsAccounts(adminUserId: string): Promise<GoogleAdsAccount[]>;
  updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<GoogleAdsAccount | undefined>;
  deleteGoogleAdsAccount(id: string, adminUserId: string): Promise<boolean>;
  
  // Campaign operations
  getCampaigns(userId: string): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  
  // Recommendation operations
  getRecommendations(campaignId: string): Promise<Recommendation[]>;
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | undefined>;
  
  // Audit log operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(userId: string): Promise<AuditLog[]>;
  
  // User settings operations
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  upsertUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings>;
}

export class DatabaseStorage implements IStorage {
  // User operations for local authentication
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      return undefined;
    }
  }

  async createUser(userData: Partial<User>): Promise<User> {
    try {
      console.log('Creating user with data:', {
        username: userData.username,
        email: userData.email,
        role: userData.role,
        createdBy: userData.createdBy
      });
      
      const [newUser] = await db
        .insert(users)
        .values({
          username: userData.username!,
          password: userData.password!,
          email: userData.email || null,
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          role: userData.role || 'sub_account',
          isActive: userData.isActive ?? true,
          createdBy: userData.createdBy || null,
          // Don't set createdAt and updatedAt manually - let the database handle defaults
        })
        .returning();
      
      console.log('Successfully created user:', { id: newUser.id, username: newUser.username });
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUserLastLogin(id: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, id));
    } catch (error) {
      console.error('Error updating user last login:', error);
      throw error;
    }
  }

  // Google Ads account operations (admin-only)
  async createGoogleAdsAccount(account: InsertGoogleAdsAccount): Promise<GoogleAdsAccount> {
    const [created] = await db.insert(googleAdsAccounts).values(account).returning();
    return created;
  }

  async getGoogleAdsAccounts(adminUserId: string): Promise<GoogleAdsAccount[]> {
    return await db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.adminUserId, adminUserId));
  }

  async updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<GoogleAdsAccount | undefined> {
    const [updated] = await db
      .update(googleAdsAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(googleAdsAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteGoogleAdsAccount(id: string, adminUserId: string): Promise<boolean> {
    const result = await db
      .delete(googleAdsAccounts)
      .where(eq(googleAdsAccounts.id, id))
      .returning();
    return result.length > 0;
  }

  // Campaign operations
  async getCampaigns(userId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [created] = await db.insert(campaigns).values(campaign).returning();
    return created;
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const [updated] = await db
      .update(campaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  // Recommendation operations
  async getRecommendations(campaignId: string): Promise<Recommendation[]> {
    return await db.select().from(recommendations).where(eq(recommendations.campaignId, campaignId));
  }

  async createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const [created] = await db.insert(recommendations).values(recommendation).returning();
    return created;
  }

  async updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | undefined> {
    const [updated] = await db
      .update(recommendations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recommendations.id, id))
      .returning();
    return updated;
  }

  // Audit log operations
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(auditLog).returning();
    return created;
  }

  async getAuditLogs(userId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));
  }

  // User settings operations
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings;
  }

  async upsertUserSettings(userId: string, settingsData: Partial<InsertUserSettings>): Promise<UserSettings> {
    // Check if settings exist
    const existingSettings = await this.getUserSettings(userId);
    
    if (existingSettings) {
      // Update existing settings
      const [updated] = await db
        .update(userSettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(userSettings)
        .values({ userId, ...settingsData } as InsertUserSettings)
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();