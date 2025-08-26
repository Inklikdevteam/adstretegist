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
  bigint,
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

// User storage table for username/password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(), // Hashed password
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("sub_account"), // 'admin' or 'sub_account'
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"), // ID of admin who created this sub-account
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Google Ads account connections (admin-level only)
export const googleAdsAccounts = pgTable("google_ads_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: varchar("admin_user_id").notNull(), // Only admins can connect Google Ads
  customerId: varchar("customer_id").notNull(),
  customerName: varchar("customer_name").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false), // For MCC support
  parentCustomerId: varchar("parent_customer_id"), // For MCC child accounts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Can belong to any user (admin or sub-account)
  googleAdsAccountId: varchar("google_ads_account_id").references(() => googleAdsAccounts.id),
  googleAdsCampaignId: varchar("google_ads_campaign_id"), // The actual Google Ads campaign ID
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // 'search', 'display', 'shopping'
  status: varchar("status").notNull().default('active'), // 'active', 'paused', 'removed'
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }).notNull(),
  targetCpa: decimal("target_cpa", { precision: 10, scale: 2 }),
  targetRoas: decimal("target_roas", { precision: 8, scale: 2 }),
  spend7d: decimal("spend_7d", { precision: 10, scale: 2 }).default('0'),
  conversions7d: integer("conversions_7d").default(0),
  actualCpa: decimal("actual_cpa", { precision: 10, scale: 2 }),
  actualRoas: decimal("actual_roas", { precision: 8, scale: 2 }),
  // Additional metrics like campaign cards
  impressions7d: integer("impressions_7d").default(0),
  clicks7d: integer("clicks_7d").default(0),
  ctr7d: decimal("ctr_7d", { precision: 8, scale: 4 }).default('0'), // CTR as decimal (0.0234 = 2.34%)
  conversionValue7d: decimal("conversion_value_7d", { precision: 12, scale: 2 }).default('0'),
  avgCpc7d: decimal("avg_cpc_7d", { precision: 10, scale: 2 }).default('0'),
  conversionRate7d: decimal("conversion_rate_7d", { precision: 8, scale: 4 }).default('0'),
  lastModified: timestamp("last_modified").defaultNow(),
  burnInUntil: timestamp("burn_in_until"),
  goalDescription: text("goal_description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Track which user generated these recommendations
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
  userId: varchar("user_id"),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  recommendationId: varchar("recommendation_id").references(() => recommendations.id),
  action: varchar("action").notNull(),
  details: text("details").notNull(),
  performedBy: varchar("performed_by").notNull(), // 'user', 'ai'
  aiModel: varchar("ai_model"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User settings and preferences
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // AI Recommendation Preferences
  aiFrequency: varchar("ai_frequency").default('daily'), // 'daily', 'weekly', 'manual'
  confidenceThreshold: integer("confidence_threshold").default(70), // 0-100
  // Notification Settings
  emailAlerts: boolean("email_alerts").default(true),
  dailySummaries: boolean("daily_summaries").default(false),
  budgetAlerts: boolean("budget_alerts").default(true),
  // Google Ads Account Selection (Master Configuration - only editable in Settings)
  selectedGoogleAdsAccounts: jsonb("selected_google_ads_accounts").default([]), // Array of account IDs marked as "active"
  // Current View Selection (temporary filter for data display)
  currentViewAccounts: jsonb("current_view_accounts").default([]), // Array of account IDs for current view filter
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertGoogleAdsAccount = typeof googleAdsAccounts.$inferInsert;
export type GoogleAdsAccount = typeof googleAdsAccounts.$inferSelect;

export type InsertCampaign = typeof campaigns.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;

export type InsertRecommendation = typeof recommendations.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;

export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertUserSettings = typeof userSettings.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  userId: true, // userId comes from authenticated user, not request body
  createdAt: true,
  updatedAt: true,
});
export type InsertUserSettingsInput = z.infer<typeof insertUserSettingsSchema>;

// Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

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
