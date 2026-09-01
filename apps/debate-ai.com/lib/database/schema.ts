import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
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

// Per-user settings — one row per user, created on first save (see
// /api/settings and /settings). Account-linked app preferences — TODO.md
// idea #17 ("User Settings — account-linked debate preferences"), first
// slice. One row per user, mirroring `debate-round`'s local-only `Settings`
// singleton
// (`packages/debate-round/src/state/settings.ts`) so a signed-in user's
// `debateStyle`/`fontSize` choices follow them across devices instead of
// staying stuck in one browser's localStorage. `debateStyle`/`fontSize`
// are nullable — a null column means "use the client default", the same
// semantics as an absent key in the local `Settings` store.
//
// `colorTheme`/`themeMode` (idea #17, follow-up (2)) extend the same row
// with the color-theme/light-dark preference `components/theme-dropdown.tsx`
// previously kept in `localStorage`/a cookie only — also nullable, with the
// same "no saved row/value yet" semantics, validated by `debate-round`'s
// `normalizeThemeSettingsPatch` against its `THEME_NAMES`/`THEME_MODES`
// lists (the same lists `ThemeDropdown`'s picker UI uses).
//
// `favoriteTools` (idea #17, follow-up "integrate tools into user
// settings") stores a signed-in user's starred `/tools` entries as a JSON
// array of route paths (e.g. `["/reason-editor","/drills"]`), or null when
// empty — same "no saved value yet" semantics as every other column here.
// Validated by `debate-round`'s `normalizeFavoriteToolsPatch`, which (unlike
// `debateStyle`/`colorTheme`) can only check shape, not membership in the
// real tool catalog — that catalog is app-specific (`app/tools/
// tool-groups.tsx`), not something the shared package knows about.
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  debateStyle: integer("debate_style"),
  fontSize: integer("font_size"),
  colorTheme: text("color_theme"),
  themeMode: text("theme_mode"),
  favoriteTools: text("favorite_tools"),
  // JSON-serialized map of CardMirror editor-preference keys (General /
  // Appearance / Accessibility settings, e.g. `displayColors`, `bodyFont`,
  // `reduceMotion`) to their current values — moved here from the editor's
  // own gear-icon settings modal (see /settings and
  // packages/debate-editor-cardmirror/src/editor/settings.ts) so a
  // signed-in user's choices follow them across devices instead of staying
  // in that browser's localStorage. Null/absent means "use the client
  // default", same semantics as every other nullable column here.
  editorPreferences: text("editor_preferences"),
  // JSON-serialized arrays of News Stream item ids the signed-in user has
  // read/liked (see packages/debate-card-search/src/lib/news-stream-sync.ts
  // and TODO.md's Product Feature Idea "Community-Rated Summaries" /
  // docs/features/news-stream.md's "Read/like state is per-browser" Known
  // gap). Null/absent means "nothing synced yet" — same semantics as every
  // other nullable column here; the client's own localStorage state is
  // still the source of truth for a signed-out browser and is merged
  // (union, not replaced) with these on sign-in rather than overwritten.
  newsRead: text("news_read"),
  newsLiked: text("news_liked"),
  // JSON-serialized array of `{ name, wordLimit }` custom word-limit
  // presets (see packages/debate-round/src/state/wordLimitPresets.ts and
  // TODO.md idea #2's "a per-style word-limit preset manager (add/edit/
  // remove custom limits instead of only the built-in registry)"
  // follow-up), checked ahead of debate-timer's hardcoded `wordCountStyles`
  // registry by `resolveSpeechWordLimit`. Null/absent means "no custom
  // presets saved yet", same semantics as every other nullable column here.
  wordLimitPresets: text("word_limit_presets"),
  // JSON-serialized array of `{ name, filter }` named Outline filter
  // presets (see packages/debate-round/src/state/outlineFilterPresets.ts
  // and TODO.md idea #10's "Save and reuse named filter presets instead of
  // re-picking filters each visit" follow-up). Null/absent means "no
  // presets saved yet", same semantics as every other nullable column here.
  outlineFilterPresets: text("outline_filter_presets"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type UserSettingsRow = typeof userSettings.$inferSelect;

// Account-linked flow cloud save — TODO.md idea #17 ("User Settings —
// account-linked debate preferences"), follow-up (3): `debate-round`'s
// `useFlowStore` keeps its `flows`/`rounds` in `localStorage` only (see
// `packages/debate-round/src/state/store.ts`), so a signed-in user's flows
// don't follow them to another device. This is the "flows" half of that
// follow-up (rounds are not migrated by this slice — see TODO.md). One row
// per saved flow per user, keyed by the local `Flow.id` (a
// `Date.now()`-based number assigned client-side) via the
// `(user_id, client_id)` unique index below, so re-saving the same flow
// upserts instead of duplicating. `data` holds the whole `Flow` object
// (recursive `Box` tree plus `speechDocs`/`sharedSpeeches`) JSON-stringified
// — mirrors `documents.content`'s blob-column approach rather than
// normalizing the tree into rows, since a `Flow` is read/written as one
// unit everywhere it's used. `label` is a short display string derived
// server-side from `Flow.content` at save time, so listing saved flows
// (`GET /api/flows`) doesn't need to parse every row's full `data` blob.
export const savedFlows = sqliteTable(
  "saved_flows",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: integer("client_id").notNull(),
    label: text("label").notNull().default(""),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_flows_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_flows_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedFlowRow = typeof savedFlows.$inferSelect;

// Account-linked round cloud save — TODO.md idea #17, follow-up (3)/(b):
// "migrate rounds themselves (the tournament/debaters/judges wrapper)... needs
// its own schema design for how a saved round should reference its saved
// flows." A `Round` only ever references its flows indirectly via
// `flowIds: number[]` — the local `Flow.id`s in `useFlowStore`'s `flows`
// array — so a saved round's `data` blob keeps that same indirection rather
// than embedding the flows themselves: loading a saved round resolves each
// `flowIds` entry against the user's already-saved flows (`saved_flows`),
// the same way the local `Round`/`Flow` stores are cross-referenced today.
// This mirrors `savedFlows` above one row per (user, round), unique on
// `(user_id, client_id)` so re-saving an edited round upserts rather than
// duplicates, cascade-deleted with the account.
export const savedRounds = sqliteTable(
  "saved_rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: integer("client_id").notNull(),
    label: text("label").notNull().default(""),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_rounds_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_rounds_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedRoundRow = typeof savedRounds.$inferSelect;

// Account-linked word-count-round history sync — TODO.md idea #2
// ("Word-Count-Only Speech Format"), "account-sync round history itself
// (today `wordCountRounds` is local-storage-only, unlike
// `wordLimitPresets`), so the trend view follows a signed-in user across
// devices instead of staying per-browser" follow-up. One row per (user,
// round) pair, same shape as `savedFlows`/`savedRounds` above, except
// `clientId` is `text` here rather than `integer` — a word-count round is
// keyed by the caller-assigned string `roundId` (e.g. `"round-1"`,
// freely typed into `WordCountRoundsPanel`'s "Round ID" field), not a
// `Date.now()`-based number. `data` holds the whole `WordCountRoundRecord`
// (style key + submitted speeches + its own `createdAt`) JSON-stringified,
// so `GET /api/word-count-rounds` can return every record in one call
// without a second round-trip per row — unlike a `Flow`/`Round`, a
// word-count round's payload is small (a handful of speech texts), so
// there's no need for `savedFlows`/`savedRounds`'s summary-list-then-fetch
// split.
export const savedWordCountRounds = sqliteTable(
  "saved_word_count_rounds",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_word_count_rounds_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_word_count_rounds_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedWordCountRoundRow = typeof savedWordCountRounds.$inferSelect;

// Account-linked judge-decision-history sync — TODO.md idea #5 ("AI Judge
// Decision Modes"), "(b) a decision history log per round instead of only
// the latest result" follow-up. Unlike `savedFlows`/`savedRounds`/
// `savedWordCountRounds` above (one row per (user, round), upserted), a
// round's judge decisions form a growing append-only log — many rows can
// share the same `roundId`, so `clientId` here holds the decision's own
// generated `JudgeDecisionRecord.id` (unique per user, for idempotent
// upsert-by-id) rather than the round id itself. `roundId` is a plain
// (non-unique) indexed column so `GET /api/judge-decisions` and the merge
// hook can still resolve/group a round's full history. `data` holds the
// whole `JudgeDecisionRecord` JSON-stringified, same small-payload
// full-record-in-list-response shape as `savedWordCountRounds`.
export const savedJudgeDecisions = sqliteTable(
  "saved_judge_decisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    roundId: text("round_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_judge_decisions_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_judge_decisions_user_client").on(table.userId, table.clientId),
    roundIdIdx: index("idx_saved_judge_decisions_round_id").on(table.roundId),
  }),
);

export type SavedJudgeDecisionRow = typeof savedJudgeDecisions.$inferSelect;

// Account-linked Speech Documents send-log sync — closes docs/features/
// flow-tools-menu.md's/user-settings.md's standing "docs" gap: CardMirror's
// speech-send history (`packages/debate-editor-cardmirror/src/editor/
// speech-send-log.ts`, rendered by `/speech-documents`) was IndexedDB-only,
// unlike flows/rounds/word-count-rounds/judge-decisions above, which all
// already follow a signed-in user across devices. Same one-row-per-entry,
// upsert-by-caller-id shape as `savedJudgeDecisions` — a `SpeechSendLogEntry`
// is generated once and never edited afterward, so `clientId` (the entry's
// own generated `id`) is enough to dedupe a re-push.
export const savedSpeechSendLog = sqliteTable(
  "saved_speech_send_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_speech_send_log_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_speech_send_log_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedSpeechSendLogRow = typeof savedSpeechSendLog.$inferSelect;

// Account-linked counsel-panel-assessment-history sync — TODO.md idea #4
// ("AI Response-Outcome Charts"), "a timeline of past AI counsel-panel
// assessments for a round, not just the latest" follow-up. Same
// append-only-log shape as `savedJudgeDecisions` above (many rows can share
// a `roundId`), so `clientId` here holds the assessment's own generated
// `CounselPanelAssessmentRecord.id` (unique per user, for idempotent
// upsert-by-id) rather than the round id itself. `roundId` is a plain
// (non-unique) indexed column so `GET /api/counsel-panel-assessments` and
// the merge hook can still resolve/group a round's full history. `data`
// holds the whole `CounselPanelAssessmentRecord` JSON-stringified.
export const savedCounselPanelAssessments = sqliteTable(
  "saved_counsel_panel_assessments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    roundId: text("round_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_counsel_panel_assessments_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_counsel_panel_assessments_user_client").on(
      table.userId,
      table.clientId,
    ),
    roundIdIdx: index("idx_saved_counsel_panel_assessments_round_id").on(table.roundId),
  }),
);

export type SavedCounselPanelAssessmentRow = typeof savedCounselPanelAssessments.$inferSelect;

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
