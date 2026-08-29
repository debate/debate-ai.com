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
  // Required by better-auth's `anonymous` plugin, which reads and writes this
  // column on every sign-in/sign-up/callback path (one-tap included) to
  // detect and clean up anonymous sessions once they resolve to a real user.
  // Without this column the drizzle adapter throws — "field does not exist in
  // the schema" — inside that plugin's post-sign-in hook, which fails every
  // first-time sign-in through those paths (verified with a local repro:
  // magic-link and anonymous sign-in both throw this on the pre-fix schema).
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
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

// Debate round videos ingested from the subscribed YouTube channels (see
// packages/debate-data-sync/src/youtube/channel-config.ts). Populated by the
// admin resync action (lib/youtube/resync-rounds.ts) so the admin page can
// page through them from SQL instead of re-hitting the YouTube API.
export const youtubeRoundVideos = sqliteTable(
  "youtube_round_videos",
  {
    id: text("id").primaryKey(), // YouTube video id
    title: text("title").notNull(),
    publishedAt: text("published_at").notNull(), // ISO date (YYYY-MM-DD), sorts lexically
    channel: text("channel").notNull(),
    views: integer("views").notNull().default(0),
    description: text("description").notNull().default(""),
    style: integer("style").notNull(), // 1=Policy, 2=PF, 3=LD, 4=College
    tournament: text("tournament"),
    roundLevel: text("round_level"),
    aff: text("aff"),
    neg: text("neg"),
    winner: integer("winner", { mode: "boolean" }),
    judgeDecision: text("judge_decision"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    publishedAtIdx: index("idx_youtube_round_videos_published_at").on(table.publishedAt),
    channelIdx: index("idx_youtube_round_videos_channel").on(table.channel),
    styleIdx: index("idx_youtube_round_videos_style").on(table.style),
  }),
);

export type YoutubeRoundVideo = typeof youtubeRoundVideos.$inferSelect;

// One row per admin-triggered resync, so the admin page can show progress
// and history without re-running the sync to find out what happened.
export const youtubeSyncRuns = sqliteTable(
  "youtube_sync_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status").notNull().default("running"), // "running" | "success" | "error"
    triggeredBy: text("triggered_by"), // admin email, when known
    channelsSynced: integer("channels_synced").notNull().default(0),
    videosFetched: integer("videos_fetched").notNull().default(0),
    videosUpserted: integer("videos_upserted").notNull().default(0),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
  },
  (table) => ({
    startedAtIdx: index("idx_youtube_sync_runs_started_at").on(table.startedAt),
  }),
);

export type YoutubeSyncRun = typeof youtubeSyncRuns.$inferSelect;

// On Page Card Reuse Search — server-backed reuse index (see
// packages/debate-card-search/src/lib/shared-evidence-library.ts and TODO.md
// idea #7, follow-up (a)). A small, dedicated index of "this URL has been
// cut" facts (not a full mirror of `EvidenceLibraryEntry`), keyed by the
// caller-assigned entry `id` so re-registering the same entry (e.g. after an
// edit) upserts rather than duplicates. `normalizedUrl` is the
// `normalizeSourceUrl`-normalized form, indexed for the reuse-check lookup.
export const evidenceReuseIndex = sqliteTable(
  "evidence_reuse_index",
  {
    id: text("id").primaryKey(),
    sourceUrl: text("source_url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    cite: text("cite").notNull().default(""),
    argBlock: text("arg_block").notNull().default(""),
    topic: text("topic").notNull().default(""),
    contributorId: text("contributor_id").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    normalizedUrlIdx: index("idx_evidence_reuse_index_normalized_url").on(table.normalizedUrl),
  }),
);

export type EvidenceReuseIndexRow = typeof evidenceReuseIndex.$inferSelect;

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
//
// Not to be confused with `youtube_round_videos` above: that one is the
// admin resync's landing table, filled straight from the YouTube API for the
// admin page, and holds rounds only. This one backs the public `/api/videos`
// feed and is the projection of the committed JSON assets (rounds, lectures
// and top picks). They are separate pipelines that happen to overlap on
// rounds; consolidating them is a follow-up, not something this table
// assumes.
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
