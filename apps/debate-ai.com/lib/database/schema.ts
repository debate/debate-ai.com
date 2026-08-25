import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// REASON editor documents — persistence for the native reason-editor route
// (ported from quick search's document model; see /reason-editor).
export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull().default("Untitled"),
    content: text("content").notNull().default(""),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_documents_user_id").on(table.userId),
    updatedAtIdx: index("idx_documents_updated_at").on(table.updatedAt),
  }),
);

export type ReasonDocument = typeof documents.$inferSelect;

// Shared, AI-Generated Debate Flow — server-backed live sync transport for
// `debate-round`'s `FlowEdit` records (see packages/debate-round/src/flow/shared-flow-sync.ts
// and TODO.md idea #16, follow-up (a)). `boxPath` is a JSON-encoded number
// array (drizzle's sqlite core has no native array column type). Rows are
// upserted by their caller-assigned `id` so re-pushing the same edit is a
// no-op rather than a duplicate.
export const flowSyncEdits = sqliteTable(
  "flow_sync_edits",
  {
    id: text("id").primaryKey(),
    flowId: integer("flow_id").notNull(),
    boxPath: text("box_path").notNull(),
    authorId: text("author_id").notNull(),
    content: text("content").notNull().default(""),
    timestampMs: integer("timestamp_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    flowIdIdx: index("idx_flow_sync_edits_flow_id").on(table.flowId),
  }),
);

export type FlowSyncEditRow = typeof flowSyncEdits.$inferSelect;

// Video library — the queryable projection of the `data/videos/*.json` assets
// (rounds-policy/pf/ld/college, debate-lectures, debate-top-picks) that the
// YouTube sync writes. `/api/videos` pages over this table instead of shipping
// the whole ~1.1 MB JSON blob on first paint; `scripts/seed-videos.ts` loads
// the JSON into it (local SQLite and Cloudflare D1 share this schema).
//
// `style` is the numeric debate format (1 Policy, 2 PF, 3 LD, 4 College) and is
// null for lectures; `category`/`category_key` hold the lecture category label
// and its URL slug and are null for rounds — together they mirror tuple index 6.
// `season_year` is the precomputed competition season (June-to-June, 0 = legacy
// pre-2010) so season filtering is an indexed equality test rather than a scan,
// and `published_ms` is the parsed publish timestamp: a handful of rows carry
// non-ISO date strings ("May 14, 2013"), which would sort wrongly if recency
// ordering used the raw `published_at` text.
export const videos = sqliteTable(
  "videos",
  {
    videoId: text("video_id").primaryKey(),
    source: text("source").notNull(),
    title: text("title").notNull().default(""),
    publishedAt: text("published_at").notNull().default(""),
    publishedMs: integer("published_ms").notNull().default(0),
    channel: text("channel").notNull().default(""),
    viewCount: integer("view_count").notNull().default(0),
    description: text("description").notNull().default(""),
    style: integer("style"),
    category: text("category"),
    categoryKey: text("category_key"),
    tournament: text("tournament"),
    roundLevel: text("round_level"),
    affTeam: text("aff_team"),
    negTeam: text("neg_team"),
    affWin: integer("aff_win", { mode: "boolean" }),
    judgeDecision: text("judge_decision"),
    arg1ac: text("arg_1ac"),
    arg2nr: text("arg_2nr"),
    isTopPick: integer("is_top_pick", { mode: "boolean" }).notNull().default(false),
    speechDocsUrl: text("speech_docs_url"),
    seasonYear: integer("season_year").notNull().default(0),
    searchText: text("search_text").notNull().default(""),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    publishedMsIdx: index("idx_videos_published_ms").on(table.publishedMs),
    viewCountIdx: index("idx_videos_view_count").on(table.viewCount),
    styleIdx: index("idx_videos_style").on(table.style),
    seasonYearIdx: index("idx_videos_season_year").on(table.seasonYear),
    categoryKeyIdx: index("idx_videos_category_key").on(table.categoryKey),
    sourceIdx: index("idx_videos_source").on(table.source),
    topPickIdx: index("idx_videos_is_top_pick").on(table.isTopPick),
  }),
);

export type VideoTableRow = typeof videos.$inferSelect;
export type VideoTableInsert = typeof videos.$inferInsert;
