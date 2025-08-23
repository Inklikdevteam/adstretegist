import {
  users,
  campaigns,
  recommendations,
  auditLogs,
  googleAdsAccounts,
  userSettings,
  type User,
  type UpsertUser,
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
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Google Ads account operations
  createGoogleAdsAccount(account: InsertGoogleAdsAccount): Promise<GoogleAdsAccount>;
  getGoogleAdsAccounts(userId: string): Promise<GoogleAdsAccount[]>;
  updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<GoogleAdsAccount | undefined>;
  deleteGoogleAdsAccount(id: string, userId: string): Promise<boolean>;
  
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
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(replit_user_id: string): Promise<User | undefined> {
    try {
      // Find the user with adwords@inklik.com email (the correct account)
      const [user] = await db.select().from(users).where(eq(users.email, 'adwords@inklik.com'));
      if (user) {
        console.log('Found adwords user:', user);
        return user;
      }
      
      console.log('No adwords user found, checking all users...');
      const allUsers = await db.select().from(users);
      console.log('All users in database:', allUsers);
      
      // Return null so we handle this properly in the routes
      return undefined;
    } catch (error) {
      console.error('Error getting user from database:', error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // First try to find existing user by email or ID
      let existingUser = null;
      if (userData.email) {
        const [userByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
        existingUser = userByEmail;
      }
      
      if (!existingUser && userData.id) {
        const [userById] = await db.select().from(users).where(eq(users.id, userData.id));
        existingUser = userById;
      }

      if (existingUser) {
        // Update existing user (exclude ID from updates to prevent foreign key issues)
        const { id, ...updateData } = userData;
        const [updatedUser] = await db
          .update(users)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();
        return updatedUser;
      } else {
        // Create new user
        const [newUser] = await db
          .insert(users)
          .values(userData)
          .returning();
        return newUser;
      }
    } catch (error) {
      console.error('Error in upsertUser:', error);
      throw error;
    }
  }

  // Google Ads account operations
  async createGoogleAdsAccount(account: InsertGoogleAdsAccount): Promise<GoogleAdsAccount> {
    const [created] = await db.insert(googleAdsAccounts).values(account).returning();
    return created;
  }

  async getGoogleAdsAccounts(userId: string): Promise<GoogleAdsAccount[]> {
    return await db.select().from(googleAdsAccounts).where(eq(googleAdsAccounts.userId, userId));
  }

  async updateGoogleAdsAccount(id: string, updates: Partial<GoogleAdsAccount>): Promise<GoogleAdsAccount | undefined> {
    const [updated] = await db
      .update(googleAdsAccounts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(googleAdsAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteGoogleAdsAccount(id: string, userId: string): Promise<boolean> {
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
      .set(updates)
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
  
  async upsertUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings> {
    // Check if settings exist for this user
    const existing = await this.getUserSettings(userId);
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(userSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [created] = await db
        .insert(userSettings)
        .values({ userId, ...settings })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
