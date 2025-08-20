import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // 'search', 'display', 'shopping'
  status: varchar("status").notNull().default('active'), // 'active', 'paused', 'removed'
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }).notNull(),
  targetCpa: decimal("target_cpa", { precision: 10, scale: 2 }),
  targetRoas: decimal("target_roas", { precision: 4, scale: 2 }),
  spend7d: decimal("spend_7d", { precision: 10, scale: 2 }).default('0'),
  conversions7d: integer("conversions_7d").default(0),
  actualCpa: decimal("actual_cpa", { precision: 10, scale: 2 }),
  actualRoas: decimal("actual_roas", { precision: 4, scale: 2 }),
  lastModified: timestamp("last_modified").defaultNow(),
  burnInUntil: timestamp("burn_in_until"),
  goalDescription: text("goal_description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => campaigns.id),
  type: varchar("type").notNull(), // 'actionable', 'monitor', 'clarification'
  priority: varchar("priority").notNull(), // 'high', 'medium', 'low'
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  reasoning: text("reasoning").notNull(),
  aiModel: varchar("ai_model").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  status: varchar("status").notNull().default('pending'), // 'pending', 'applied', 'dismissed'
  potentialSavings: decimal("potential_savings", { precision: 10, scale: 2 }),
  actionData: jsonb("action_data"), // Structured data for the action
  createdAt: timestamp("created_at").defaultNow(),
  appliedAt: timestamp("applied_at"),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  recommendationId: varchar("recommendation_id").references(() => recommendations.id),
  action: varchar("action").notNull(),
  details: text("details").notNull(),
  performedBy: varchar("performed_by").notNull(), // 'user', 'ai'
  aiModel: varchar("ai_model"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertCampaign = typeof campaigns.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertRecommendation = typeof recommendations.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;

export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
  appliedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});
