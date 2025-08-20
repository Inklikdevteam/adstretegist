import {
  users,
  campaigns,
  recommendations,
  auditLogs,
  type User,
  type UpsertUser,
  type Campaign,
  type InsertCampaign,
  type Recommendation,
  type InsertRecommendation,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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
}

export const storage = new DatabaseStorage();
