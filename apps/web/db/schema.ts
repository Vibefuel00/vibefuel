import { relations, sql } from "drizzle-orm"
import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Developers (earn side). Authenticated by a serial key; the hash is stored.
// ---------------------------------------------------------------------------

export const developers = pgTable(
  "developers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(), // e.g. "VF-7K2M" for display
    keyEnc: text("key_enc"), // AES-GCM encrypted key so the owner can reveal it again
    walletAddress: text("wallet_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    editor: text("editor"), // last reported editor: cursor, vscode, ...
    extensionVersion: text("extension_version"),
  },
  (t) => [uniqueIndex("developers_key_hash_idx").on(t.keyHash)]
)

// One row per developer per UTC day: how long the editor was active.
export const workDays = pgTable(
  "work_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    activeSeconds: integer("active_seconds").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("work_days_dev_day_idx").on(t.developerId, t.day)]
)

// ---------------------------------------------------------------------------
// Advertisers (pay side). Email + password.
// ---------------------------------------------------------------------------

// Advertisers are identified by the Solana wallet that pays. Signing a
// server-issued message proves ownership; no email or password.
export const advertisers = pgTable(
  "advertisers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletAddress: text("wallet_address").notNull(),
    company: text("company").notNull(),
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("advertisers_wallet_idx").on(t.walletAddress)]
)

export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "pending_payment",
  "active",
  "paused",
  "exhausted",
])

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    advertiserName: text("advertiser_name").notNull(),
    domain: text("domain").notNull(),
    url: text("url").notNull(),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    logoUrl: text("logo_url"),
    brandBg: text("brand_bg").notNull().default("#0a0a0a"),
    brandFg: text("brand_fg").notNull().default("#ffffff"),
    rewardTokens: integer("reward_tokens").notNull().default(10),
    budgetTokens: integer("budget_tokens").notNull().default(0),
    spentTokens: integer("spent_tokens").notNull().default(0),
    status: campaignStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_status_idx").on(t.status)]
)

export const paymentStatus = pgEnum("payment_status", ["pending", "confirmed", "expired"])

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserId: uuid("advertiser_id")
      .notNull()
      .references(() => advertisers.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    lamports: bigint("lamports", { mode: "number" }).notNull(),
    tokens: integer("tokens").notNull(),
    reference: text("reference").notNull(), // Solana Pay reference pubkey
    signature: text("signature"),
    status: paymentStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("payments_reference_idx").on(t.reference)]
)

// ---------------------------------------------------------------------------
// Ad events: the ledger. Rewards are credited here and campaign spend debited.
// ---------------------------------------------------------------------------

export const adEventType = pgEnum("ad_event_type", ["impression", "click", "dismiss"])

export const adEvents = pgTable(
  "ad_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    developerId: uuid("developer_id")
      .notNull()
      .references(() => developers.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    type: adEventType("type").notNull(),
    rewardTokens: integer("reward_tokens").notNull().default(0),
    clientEventId: text("client_event_id"), // idempotency key from the extension
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ad_events_dev_idx").on(t.developerId, t.occurredAt),
    index("ad_events_campaign_idx").on(t.campaignId, t.occurredAt),
    uniqueIndex("ad_events_client_idx").on(t.developerId, t.clientEventId),
  ]
)

export const payoutStatus = pgEnum("payout_status", ["requested", "paid", "rejected"])

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  developerId: uuid("developer_id")
    .notNull()
    .references(() => developers.id, { onDelete: "cascade" }),
  tokens: integer("tokens").notNull(),
  walletAddress: text("wallet_address").notNull(),
  status: payoutStatus("status").notNull().default("requested"),
  signature: text("signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const developersRelations = relations(developers, ({ many }) => ({
  events: many(adEvents),
  workDays: many(workDays),
  payouts: many(payouts),
}))

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  advertiser: one(advertisers, { fields: [campaigns.advertiserId], references: [advertisers.id] }),
  events: many(adEvents),
  payments: many(payments),
}))

export const adEventsRelations = relations(adEvents, ({ one }) => ({
  developer: one(developers, { fields: [adEvents.developerId], references: [developers.id] }),
  campaign: one(campaigns, { fields: [adEvents.campaignId], references: [campaigns.id] }),
}))

export const now = sql`now()`
