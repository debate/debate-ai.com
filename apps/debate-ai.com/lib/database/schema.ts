import { sqliteTable, text, integer, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";
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
// (ported from quick search's document model; see /reason-editor). `parentId`
// and `isFolder` back the file-tree sidebar (also ported from quick search's
// REASON editor — see reason-editor-sidebar's FileTree) so documents can be
// organized into folders instead of one flat list. An uploaded `.docx`
// lands here too, converted to CardMirror's native `.cmir` on the way in
// (`lib/cardmirror/stored-cmir.ts`); `format` says which shape a row holds.
export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull().default("Untitled"),
    content: text("content").notNull().default(""),
    // How `content` is encoded: `"cmir"` for an uploaded file, which is kept
    // in CardMirror's native format for its whole life, or `"html"` for a
    // document written in the editor. Same two values as
    // `topic_starter_items.format` — see `lib/cardmirror/format.ts`.
    format: text("format").notNull().default("html"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    isFolder: integer("is_folder", { mode: "boolean" }).notNull().default(false),
    // The file's own slug just before its most recent rename — lets a
    // bookmarked `/reason-editor?doc=<old slug>` link keep resolving after a
    // title edit changes it. `lib/reason-docs/doc-path.ts#findItemByRef`
    // reads it as a fallback; null until the first rename, and only ever
    // remembers one rename back (not a full history).
    previousSlug: text("previous_slug"),
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
    parentIdIdx: index("idx_documents_parent_id").on(table.parentId),
  }),
);

export type ReasonDocument = typeof documents.$inferSelect;

// Public, admin-curated evidence packs. A row is either a folder or an
// imported file; `parentId` preserves the directory structure in an uploaded
// zip. Content is stored inline rather than in a storage bucket so selecting
// a public file can open it directly in the editor without a signed-in
// account: an uploaded DOCX is converted to CardMirror's native `.cmir`
// (gzipped JSON, base64-encoded to fit this text column), which `format`
// records. Rows imported before that carry card HTML and say so.
export const topicStarterItems = sqliteTable(
  "topic_starter_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    format: text("format").notNull().default("html"),
    parentId: integer("parent_id"),
    isFolder: integer("is_folder", { mode: "boolean" }).notNull().default(false),
    tags: text("tags").notNull().default("[]"),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    parentIdIdx: index("idx_topic_starter_items_parent_id").on(table.parentId),
    publishedIdx: index("idx_topic_starter_items_published").on(table.published),
  }),
);

export type TopicStarterItem = typeof topicStarterItems.$inferSelect;

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

// Shared, AI-Generated Debate Flow — server-backed "who's editing now"
// presence for `debate-round`'s `FlowEdit` collaborators (see
// packages/debate-round/src/flow/flow-presence.ts and TODO.md idea #16's
// "Live 'who's editing now' presence indicators alongside the existing
// merge preview" follow-up). One row per (flowId, authorId) pair, upserted
// on every heartbeat so a collaborator re-heartbeating updates their
// existing row rather than accumulating duplicates.
export const flowPresenceHeartbeats = sqliteTable(
  "flow_presence_heartbeats",
  {
    flowId: integer("flow_id").notNull(),
    authorId: text("author_id").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: uniqueIndex("idx_flow_presence_heartbeats_flow_author").on(table.flowId, table.authorId),
    flowIdIdx: index("idx_flow_presence_heartbeats_flow_id").on(table.flowId),
  }),
);

export type FlowPresenceHeartbeatRow = typeof flowPresenceHeartbeats.$inferSelect;

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
// with the color-theme/light-dark preference `components/theme-dropdown.tsx`'s
// `useThemeState` hook previously kept in `localStorage`/a cookie only — also
// nullable, with the same "no saved row/value yet" semantics, validated by
// `debate-round`'s `normalizeThemeSettingsPatch` against its
// `THEME_NAMES`/`THEME_MODES` lists (the same lists `CategoryDock`'s theme
// picker UI uses).
//
// `favoriteTools` (idea #17, follow-up "integrate tools into user
// settings") stores a signed-in user's starred `/tools` entries as a JSON
// array of route paths (e.g. `["/reason-editor","/drills"]`), or null when
// empty — same "no saved value yet" semantics as every other column here.
// Validated by `debate-round`'s `normalizeFavoriteToolsPatch`, which (unlike
// `debateStyle`/`colorTheme`) can only check shape, not membership in the
// real tool catalog — that catalog is app-specific (`app/tools/
// tool-groups.tsx`), not something the shared package knows about.
// `recentTools` mirrors `favoriteTools` above — the last few `/tools` hrefs a
// user opened (via the app-wide command palette), most-recent-first, JSON
// array or null when empty. Closes command-palette.mdx's "recents don't
// follow a signed-in user across devices" gap: `lib/recentTools.ts` already
// owned this list as a localStorage-only convenience, so it keeps owning the
// validation/serialization here too rather than moving that into
// `debate-round`, matching `editorPreferences`'s "app-specific field, not a
// package one" precedent below. Applied via a single `recordRecentTool` op
// (append-to-front, dedupe, cap) resolved against the row's current value,
// the same lost-update fix `favoriteTools`' add/remove ops already use,
// rather than a client-computed whole-list replace.
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  debateStyle: integer("debate_style"),
  fontSize: integer("font_size"),
  colorTheme: text("color_theme"),
  themeMode: text("theme_mode"),
  favoriteTools: text("favorite_tools"),
  recentTools: text("recent_tools"),
  // JSON-serialized map of CardMirror editor-setting keys (e.g.
  // `displayColors`, `bodyFont`, `reduceMotion`, `smartQuotes`) to their
  // current values, for every category /settings hosts — that page is the
  // editor's settings surface (see lib/editor-preferences.ts's
  // EDITOR_PREFERENCE_KEYS, which is both the allow-list and the read-back
  // filter, and packages/debate-editor/src/editor/settings.ts) so a
  // signed-in user's choices follow them across devices instead of staying
  // in that browser's localStorage. Credentials are never among them: an API
  // key or relay token stays in the browser that holds it. Null/absent means
  // "use the client default", same semantics as every other nullable column
  // here.
  editorPreferences: text("editor_preferences"),
  // JSON-serialized arrays of News Stream item ids the signed-in user has
  // read/liked (see packages/debate-card-search/src/lib/news-stream-sync.ts
  // and TODO.md's Product Feature Idea "Community-Rated Summaries" /
  // packages/debate-help-docs/content/docs/internals/news-stream.mdx's "Read/like state is per-browser" Known
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
  // JSON-serialized array of `{ name, tags }` named Argument Library
  // collections (see
  // packages/debate-card-search/src/lib/argument-library-collections.ts and
  // TODO.md's "📚 Common Argument Library" bullet's "saved custom
  // collections per user" follow-up). Null/absent means "no collections
  // saved yet", same semantics as every other nullable column here.
  savedArgumentCollections: text("saved_argument_collections"),
  // JSON-serialized `{ targetCompletedTaskCount, topic?, targetDate? }`
  // personal research-progress goal (see
  // packages/debate-card-search/src/lib/research-progress-goal-sync.ts and
  // TODO.md's "📈 Research Progress Tracking" bullet's "account-syncing the
  // goal across devices" follow-up). `contributorId` isn't stored here —
  // this row already scopes it to one signed-in user. Null/absent means "no
  // goal set", same semantics as every other nullable column here.
  researchProgressGoal: text("research_progress_goal"),
  // JSON-serialized `{ lapseReminderEnabled, freezeDayKeys }` personal
  // quest-streak preferences (see
  // packages/debate-contributor-progress/src/lib/quest-streak-sync.ts and
  // TODO.md's "🎮 Gamified Quests" bullet's "account-syncing reminder
  // opt-ins/streak freezes across devices" follow-up). `contributorId`
  // isn't stored here — this row already scopes it to one signed-in user.
  // Null/absent means "nothing synced yet", same semantics as every other
  // nullable column here.
  questStreakSync: text("quest_streak_sync"),
  // JSON-serialized `QualificationPointsTable` override (see
  // packages/debate-data-sync/src/state/qualificationPointsTable.ts and
  // packages/debate-help-docs/content/docs/features/team-rankings.mdx's "Standings data... is stored in
  // localStorage only" Known gap) and `QualificationCutoffSettings` (see
  // packages/debate-data-sync/src/state/qualificationCutoff.ts, same gap) —
  // the Standings tab's custom point weights and qualification cutoff, kept
  // as two nullable columns rather than folded into one blob since a team
  // can configure either independently. Null/absent means "no custom value
  // saved yet, use the local default", same semantics as every other
  // nullable column here. The logged/imported tournament results
  // themselves are not settings — those sync through the separate
  // `saved_tournament_results` table below, one row per result.
  qualificationPointsTable: text("qualification_points_table"),
  qualificationCutoff: text("qualification_cutoff"),
  // JSON-serialized `BrainstormSessionTimerState` (see
  // packages/debate-team-collaboration/src/lib/brainstorm-session-timer.ts
  // and packages/debate-help-docs/content/docs/features/brainstorm-board.mdx's
  // "The session timer is localStorage-only, not account-synced" Known gap).
  // A whole-value replace on every start/pause/reset/duration change, like
  // `researchProgressGoal` above, rather than op-based — a session timer has
  // at most one moderator driving it at a time, so the two-tabs-race the
  // op-based fields exist for doesn't apply here. Null/absent means "no
  // synced timer yet", same semantics as every other nullable column here.
  brainstormSessionTimer: text("brainstorm_session_timer"),
  // Practice vs AI's gamification score and JSON-serialized array of earned
  // badge ids (see packages/debate-round-practice-ai/src/backend/gamification.ts
  // and packages/debate-help-docs/content/docs/internals/practice-vs-ai.mdx).
  // Read/written by apps/debate-ai.com/lib/practice-vs-ai/store.ts's
  // `getGamificationProfile`/`applyGamificationAward`, not through the
  // generic `/api/settings` PUT — these are server-computed round results,
  // not a user preference. Null/zero means "no round scored yet", same
  // semantics as every other nullable column here.
  practiceVsAiScore: integer("practice_vs_ai_score"),
  practiceVsAiBadges: text("practice_vs_ai_badges"),
  // The UTC calendar day ("YYYY-MM-DD") of the most recent scored round and
  // the day-over-day streak as of that round, the dated activity log the
  // comment above used to say this table didn't have. Advanced by
  // `advanceDailyStreak` (gamification.ts) in `applyGamificationAward`: a
  // second round the same day doesn't move it, the day after extends it,
  // anything else (first round, or a missed day) restarts it at 1. Null
  // means "never played", same semantics as every other nullable column
  // here.
  practiceVsAiLastPlayedDayKey: text("practice_vs_ai_last_played_day_key"),
  practiceVsAiCurrentStreak: integer("practice_vs_ai_current_streak"),
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

// Account-linked tournament-result sync — packages/debate-help-docs/content/docs/features/team-rankings.mdx's
// "Standings data (logged/imported tournament results, the custom points
// table, and the qualification cutoff) is stored in localStorage only... it
// doesn't yet follow a signed-in user across devices" Known gap. A team logs
// or bulk-imports many results, so — like `savedWordCountRounds` above —
// this is one row per (user, result) pair rather than one row per user;
// unlike that table, results are create/delete only (a logged result is
// never edited in place, only removed), so there is no update-conflict
// concern to resolve on merge. `clientId` holds the result's own
// caller-generated `TournamentResultRecord.id` (unique per user, for
// idempotent upsert-by-id). `data` holds the whole record JSON-stringified,
// mirroring `savedWordCountRounds.data` — a result's payload is a handful of
// short fields, so `GET /api/tournament-results` returns every record in one
// call, no separate summary/label split.
export const savedTournamentResults = sqliteTable(
  "saved_tournament_results",
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
    userIdIdx: index("idx_saved_tournament_results_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_tournament_results_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedTournamentResultRow = typeof savedTournamentResults.$inferSelect;

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

// Account-linked Speech Documents send-log sync — closes the standing "docs"
// gap in the flow-tools-menu and user-settings feature docs: CardMirror's
// speech-send history (`packages/debate-editor/src/editor/
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

// Account-linked Quick Cards library sync — closes the same standing "docs"
// gap as `savedSpeechSendLog` above: the Quick Cards reusable-snippet library
// (`packages/debate-editor/src/editor/quick-cards-store.ts`, IndexedDB on
// web) was device-local only, unlike CardMirror's own documents
// (`documents` above), which are already per-user D1 rows. Same
// one-row-per-card, upsert-by-caller-id shape as `savedSpeechSendLog` — a
// `QuickCard` is looked up/edited by its own `id` (not appended to a growing
// log), so `clientId` holds that id and `GET /api/quick-cards` returns every
// synced card in full for `quickCardsStore`'s merge-on-init.
export const savedQuickCards = sqliteTable(
  "saved_quick_cards",
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
    userIdIdx: index("idx_saved_quick_cards_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_quick_cards_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedQuickCardRow = typeof savedQuickCards.$inferSelect;

// Account-linked Learn flashcard sync — the standing follow-up TODO.md has
// flagged across several runs: CardMirror's "Learn" spaced-repetition store
// (`packages/debate-editor/src/editor/learn-store.ts`) was entirely
// device-local. That store keeps 8 sub-collections (cards, schedules,
// anchors, AI threads, notes, review log, decks, doc registry) merged in
// one localStorage/IndexedDB blob, which doesn't fit this table's
// one-row-per-record shape — so, deliberately, only `cards` (a card's
// portable CONTENT: `id`/`type`/`front`/`back`) is synced here, same split
// `savedQuickCards` above draws between a snippet's definition and any
// per-user state. A restored card starts with no schedule pressure on
// whichever device adopts it — already how `upsertCard` and the manage
// GUI's own JSON export/import treat a card with no carried schedule.
// Same one-row-per-card, upsert-by-caller-id shape as `savedQuickCards`:
// `clientId` holds the card's own `id`, and `GET /api/learn-cards` returns
// every synced card in full for `learn-cards-sync.ts`'s merge-on-init.
export const savedLearnCards = sqliteTable(
  "saved_learn_cards",
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
    userIdIdx: index("idx_saved_learn_cards_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_learn_cards_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedLearnCardRow = typeof savedLearnCards.$inferSelect;

// Account-linked Learn custom-deck sync — the same standing follow-up
// TODO.md has flagged across several runs, picking up the next of the 8
// sub-collections in `learn-store.ts`'s shared blob: custom decks
// (`CustomDeck`: `deckId`/`name`/`cardIds`/`createdAt`). Same
// one-row-per-deck, upsert-by-caller-id shape as `savedLearnCards` above:
// `clientId` holds the deck's own `deckId`, and `GET /api/learn-decks`
// returns every synced deck in full for `learn-decks-sync.ts`'s
// merge-on-init. Schedules/anchors/AI threads/notes/doc registry remain
// local-only, same reasoning as `savedLearnCards`'s comment; the review
// log gets its own table below (`savedLearnReviewLog`).
export const savedLearnDecks = sqliteTable(
  "saved_learn_decks",
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
    userIdIdx: index("idx_saved_learn_decks_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_learn_decks_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedLearnDeckRow = typeof savedLearnDecks.$inferSelect;

// Account-linked Learn review-log sync — the next of the 8 sub-collections
// in `learn-store.ts`'s shared blob after cards and decks: the grading
// history (`ReviewLogEntry`: `cardId`/`at`/`grade`/`intervalBefore`/
// `intervalAfter`) `grade()` appends to on every review. An entry has no
// id of its own — `clientId` holds `reviewLogEntryId(entry)`
// (`cardId:at`; `at` is a millisecond-precision ISO timestamp, already
// unique per card) rather than reshaping the type. Same one-row-per-entry,
// upsert-by-caller-id shape as `savedLearnCards`/`savedLearnDecks`:
// `GET /api/learn-review-log` returns every synced entry in full for
// `learn-review-log-sync.ts`'s merge-on-init. Purely informational — an
// adopted entry is never replayed into `schedules`, which stays local-only
// and per-device.
export const savedLearnReviewLog = sqliteTable(
  "saved_learn_review_log",
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
    userIdIdx: index("idx_saved_learn_review_log_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_learn_review_log_user_client").on(
      table.userId,
      table.clientId,
    ),
  }),
);

export type SavedLearnReviewLogRow = typeof savedLearnReviewLog.$inferSelect;

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

// Account-linked round-pairing sync — TODO.md idea #12 ("Pre-Round
// Intelligence Panel"), "A manual pairing/room-assignment entry form as the
// practical stand-in" follow-up (real Tabroom pairings data stays blocked
// behind a login wall — see the "Confirmed blocker" note). One row per
// (user, round) pair, keyed by the caller-typed `RoundPairingRecord.roundId`
// — a pairing is looked up/edited by round, not appended to a growing log —
// same shape as `savedWordCountRounds` above.
export const savedRoundPairings = sqliteTable(
  "saved_round_pairings",
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
    userIdIdx: index("idx_saved_round_pairings_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_round_pairings_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedRoundPairingRow = typeof savedRoundPairings.$inferSelect;

// Account-linked coach-material sync — TODO.md idea #8
// ("Video-Lecture-Training Coach AI")'s "Account sync for coach materials
// (and their version history)" follow-up. One row per (user, material) pair,
// keyed by the caller-typed `CoachMaterial.id` — a material is looked
// up/edited by its own id, not appended to a growing log — same shape as
// `savedRoundPairings` above.
export const savedCoachMaterials = sqliteTable(
  "saved_coach_materials",
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
    userIdIdx: index("idx_saved_coach_materials_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_coach_materials_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedCoachMaterialRow = typeof savedCoachMaterials.$inferSelect;

// Account-linked coach-material version-history sync — the same TODO.md
// idea #8 follow-up as `savedCoachMaterials` above, applied to
// `state/coachMaterialVersions.ts`'s snapshots. Same append-only-log shape
// as `savedJudgeDecisions`/`savedCounselPanelAssessments` above (many rows
// can share a `materialId`), so `clientId` here holds the version's own
// generated `CoachMaterialVersion.id` rather than the material id itself.
// `materialId` is a plain (non-unique) indexed column so the merge hook and
// a material-delete cascade can still resolve/remove that material's full
// version history.
export const savedCoachMaterialVersions = sqliteTable(
  "saved_coach_material_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    materialId: text("material_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_coach_material_versions_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_coach_material_versions_user_client").on(
      table.userId,
      table.clientId,
    ),
    materialIdIdx: index("idx_saved_coach_material_versions_material_id").on(table.materialId),
  }),
);

export type SavedCoachMaterialVersionRow = typeof savedCoachMaterialVersions.$inferSelect;

// Account-linked Daily Best Card comment-thread sync — the "🕵️ Daily Best
// Card Challenge" bullet's "a comment thread on each day's winner"
// follow-up under Research Crowdsourcing Organizer Features in TODO.md.
// Same append-only-log shape as `savedJudgeDecisions`/
// `savedCoachMaterialVersions` above (many rows can share a `dayKey`), so
// `clientId` here holds the comment's own generated
// `DailyBestCardComment.id`. `dayKey` is a plain (non-unique) indexed
// column so `GET /api/daily-best-card-comments` and the merge hook can
// still resolve/group a day's full thread.
export const savedDailyBestCardComments = sqliteTable(
  "saved_daily_best_card_comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    dayKey: text("day_key").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_daily_best_card_comments_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_daily_best_card_comments_user_client").on(
      table.userId,
      table.clientId,
    ),
    dayKeyIdx: index("idx_saved_daily_best_card_comments_day_key").on(table.dayKey),
  }),
);

export type SavedDailyBestCardCommentRow = typeof savedDailyBestCardComments.$inferSelect;

// Account-linked strategy-recommendation-history sync — the "🧭
// Scout-to-Strategy Workflow" bullet's "a history log of past strategy
// recommendations per matchup" follow-up under Research Crowdsourcing
// Organizer Features in TODO.md. Same append-only-log shape as
// `savedJudgeDecisions`/`savedCounselPanelAssessments` above (many rows can
// share a `matchupId`), so `clientId` here holds the recommendation's own
// generated `StrategyRecommendationRecord.id`. `matchupId` is a plain
// (non-unique) indexed column so `GET /api/strategy-recommendations` and the
// merge hook can still resolve/group a matchup's full history.
export const savedStrategyRecommendations = sqliteTable(
  "saved_strategy_recommendations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    matchupId: text("matchup_id").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_strategy_recommendations_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_strategy_recommendations_user_client").on(
      table.userId,
      table.clientId,
    ),
    matchupIdIdx: index("idx_saved_strategy_recommendations_matchup_id").on(table.matchupId),
  }),
);

export type SavedStrategyRecommendationRow = typeof savedStrategyRecommendations.$inferSelect;

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

// Explicit admin removals are retained so a later YouTube resync does not
// silently make an unavailable video public again.
export const youtubeVideoExclusions = sqliteTable(
  "youtube_video_exclusions",
  {
    videoId: text("video_id").primaryKey(),
    deletedBy: text("deleted_by"),
    deletedAt: integer("deleted_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    deletedAtIdx: index("idx_youtube_video_exclusions_deleted_at").on(table.deletedAt),
  }),
);

export type YoutubeVideoExclusion = typeof youtubeVideoExclusions.$inferSelect;

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

// The YouTube channels the weekly resync scans. Admin-managed in the
// "YouTube channels" tab of /admin rather than living in
// `packages/debate-data-sync/src/youtube/channel-config.ts`, so a channel can be
// added, renamed or paused without a code change and a deploy.
//
// `id` is YouTube's channel id; `name` is the handle/username the resync hands
// to the API. It is nullable and filled in on the first successful sync — the
// admin adds a channel by name alone, and the resync resolves the id from
// YouTube rather than trusting an admin to type it. A row with
// `enabled = 0` is skipped by the scan but kept, so pausing a channel is
// reversible and its history survives.
export const youtubeChannels = sqliteTable(
  "youtube_channels",
  {
    rowId: integer("id").primaryKey({ autoIncrement: true }),
    channelId: text("channel_id"),
    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    addedBy: text("added_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    nameIdx: uniqueIndex("idx_youtube_channels_name").on(table.name),
    channelIdIdx: uniqueIndex("idx_youtube_channels_channel_id").on(table.channelId),
  }),
);

export type YoutubeChannel = typeof youtubeChannels.$inferSelect;
export type NewYoutubeChannel = typeof youtubeChannels.$inferInsert;

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

// On Page Card Reuse Search — team-wide "reuse patterns" dashboard (TODO.md
// idea #7's "a team dashboard of pages flagged as already-cut" follow-up). A
// log of every GET /api/evidence-reuse-check lookup (the web app's "Check
// this page" box, or the browser extension), not just the registered "cut"
// facts `evidenceReuseIndex` above tracks — so a coach can see which pages
// get *checked*, and how often they come back already-cut, across the whole
// team rather than just this one browser's own `reuseCheckHistory.ts` log.
// Append-only (never upserted); `checkedAt` is a plain millisecond
// timestamp stamped server-side, mirroring `flowPresenceHeartbeats.lastSeenAt`
// above rather than a drizzle `{ mode: "timestamp" }` column.
export const reuseCheckLog = sqliteTable(
  "reuse_check_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    alreadyCut: integer("already_cut", { mode: "boolean" }).notNull(),
    matchCount: integer("match_count").notNull().default(0),
    source: text("source").notNull().default("web"),
    checkedAt: integer("checked_at").notNull(),
  },
  (table) => ({
    normalizedUrlIdx: index("idx_reuse_check_log_normalized_url").on(table.normalizedUrl),
    alreadyCutIdx: index("idx_reuse_check_log_already_cut").on(table.alreadyCut),
  }),
);

export type ReuseCheckLogRow = typeof reuseCheckLog.$inferSelect;

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
    // Stacked playlists: `stack_key` is the id of the group's primary video
    // (a round, say) and is shared by every member, `stack_position` orders
    // them within it. Both are derived from the links the descriptions carry
    // — see `debate-data-sync/src/videos/video-stacks.ts` — and are kept
    // current by `lib/videos/recompute-video-stacks.ts`, which the JSON seed
    // and every round-publish path (both run over the whole table, since a
    // round and its analysis can be added weeks apart by different
    // pipelines) call after writing.
    stackKey: text("stack_key"),
    stackPosition: integer("stack_position").notNull().default(0),
    searchText: text("search_text").notNull().default(""),
    // Whether YouTube still serves this video. The weekly resync asks the
    // API for every stored id; an id the API declines to return has been
    // deleted, made private, or region-blocked, and the row is marked here
    // rather than silently left in the library pointing at a dead embed.
    // `available` until a check says otherwise, so a library seeded before
    // this existed reads as available rather than unknown.
    availability: text("availability").notNull().default("available"),
    /** When availability was last confirmed by a sync, null if never. */
    availabilityCheckedAt: integer("availability_checked_at", { mode: "timestamp" }),
    /** How many consecutive checks have failed to find the video. */
    missingChecks: integer("missing_checks").notNull().default(0),
    /** When the view count was last refreshed from YouTube. */
    viewCountSyncedAt: integer("view_count_synced_at", { mode: "timestamp" }),
    // Set by an admin edit (`updateLibraryVideo`) and never cleared. Once set,
    // `buildVideoSeedStatements` skips re-seeding this row's columns from the
    // JSON assets, so a re-run of `db:seed:videos` can't silently overwrite an
    // admin's correction with the asset's stale value.
    adminEdited: integer("admin_edited", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    publishedMsIdx: index("idx_videos_published_ms").on(table.publishedMs),
    availabilityIdx: index("idx_videos_availability").on(table.availability),
    viewCountIdx: index("idx_videos_view_count").on(table.viewCount),
    styleIdx: index("idx_videos_style").on(table.style),
    seasonYearIdx: index("idx_videos_season_year").on(table.seasonYear),
    categoryKeyIdx: index("idx_videos_category_key").on(table.categoryKey),
    sourceIdx: index("idx_videos_source").on(table.source),
    topPickIdx: index("idx_videos_is_top_pick").on(table.isTopPick),
    stackKeyIdx: index("idx_videos_stack_key").on(table.stackKey),
  }),
);

export type VideoTableRow = typeof videos.$inferSelect;
export type VideoTableInsert = typeof videos.$inferInsert;

// Transcript cache, one row per video+language. YouTube bot-checks server IPs
// at random and rate-limits them in bursts, so a transcript that was fetched
// once is worth keeping: later viewers of the same video are served from here
// instead of racing the limiter, and a video whose captions are momentarily
// unreachable still has a transcript to show. `snippets` holds the caption
// cues as fetched — `[{ text, start, duration }, …]` JSON — because the UI
// regroups them into sentences itself and the raw cues are what a re-render
// needs. Only successful fetches are stored; a miss falls through to YouTube,
// so a video that gains captions later picks them up on the next request.
export const videoTranscripts = sqliteTable(
  "video_transcripts",
  {
    videoId: text("video_id").notNull(),
    lang: text("lang").notNull().default("en"),
    snippets: text("snippets").notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.videoId, table.lang] }),
  }),
);

export type VideoTranscriptRow = typeof videoTranscripts.$inferSelect;

// Long-form, human- or AI-authored writing *about* one video, one row per
// kind. Distinct from `video_transcripts` above, which caches YouTube's own
// caption cues as fetched and is keyed by language: these are documents —
// the full speech-by-speech transcript of a round typed up or cleaned up by
// an editor, the AI summary of it, the written analysis beside it — and they
// are what the watch page's side tabs read. `body` is markdown whose `##`
// headings name the speeches (`## 1AC — Aff, 0:00`), because a round's
// transcript is only navigable if the speeches are; see
// `packages/debate-videos/src/lib/video-documents.ts` for the parser the
// panel and the admin word count share. Bodies run to tens of thousands of
// words, so nothing here is loaded by the feed — only by the one page (or
// one admin dialog) that is about this video.
export const videoDocuments = sqliteTable(
  "video_documents",
  {
    videoId: text("video_id").notNull(),
    /** `transcript`, `summary` or `analysis` — see `VIDEO_DOCUMENT_KINDS`. */
    kind: text("kind").notNull(),
    /** Heading shown on the tab's panel; falls back to the kind's label. */
    title: text("title"),
    body: text("body").notNull().default(""),
    /** Who wrote it: `editor`, `ai`, or `youtube` for a cleaned-up caption dump. */
    author: text("author").notNull().default("editor"),
    /** Model that generated an `ai` document, for the attribution line. */
    model: text("model"),
    /** Words in `body`, stored so the tab strip can say so without shipping it. */
    wordCount: integer("word_count").notNull().default(0),
    /** Admin email of the last editor, for the audit trail. */
    updatedBy: text("updated_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.videoId, table.kind] }),
  }),
);

export type VideoDocumentRow = typeof videoDocuments.$inferSelect;
export type VideoDocumentInsert = typeof videoDocuments.$inferInsert;

// Admin-curated links between two videos — the round and the analysis videos
// that dissect it, a lecture and the round it teaches from.
//
// Not to be confused with `videos.stack_key`, which is derived by the sync
// from links the YouTube descriptions happen to carry and groups videos into
// one grid slot. These are stated by an editor, survive a re-seed, and carry
// a direction: `video_id` is the video being watched and `related_video_id`
// is what is offered beside it, so a round lists its analysis rather than
// every analysis video listing every round.
export const videoRelations = sqliteTable(
  "video_relations",
  {
    videoId: text("video_id").notNull(),
    relatedVideoId: text("related_video_id").notNull(),
    /** `analysis`, `related`, `rematch` — see `VIDEO_RELATION_KINDS`. */
    relation: text("relation").notNull().default("analysis"),
    /** Editor's one-line note on why these belong together. */
    note: text("note"),
    /** Order within the relation, lowest first. */
    position: integer("position").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.videoId, table.relatedVideoId, table.relation] }),
    // The reverse lookup: "what is this analysis video about?", which is how
    // an analysis video links back to the round on its own watch page.
    relatedIdx: index("idx_video_relations_related").on(table.relatedVideoId),
  }),
);

export type VideoRelationRow = typeof videoRelations.$inferSelect;
export type VideoRelationInsert = typeof videoRelations.$inferInsert;

// Viewer-reported problems with a video. This used to be a JSON file written
// with `fs.writeFile`, which cannot work on Workers at all — the filesystem
// is read-only there, so every report from production was lost. Reports are
// rows now, and `kind` is what makes them actionable: a miscategorised video
// carries the category the reporter says it should have (`suggested_style`
// for a round's format, `suggested_category` for a lecture's topic,
// `suggested_round_level` for college vs. high school), so an admin can
// apply the correction instead of re-deriving it from prose.
export const videoIssues = sqliteTable(
  "video_issues",
  {
    id: text("id").primaryKey(),
    videoId: text("video_id").notNull(),
    /** Title as the reporter saw it, so a later retitle still reads sensibly. */
    title: text("title").notNull().default(""),
    /** `miscategorized`, `unavailable`, `quality`, `metadata` or `other`. */
    kind: text("kind").notNull().default("other"),
    /** The reporter's own words; optional once a `kind` is chosen. */
    issue: text("issue").notNull().default(""),
    /** Numeric debate style the reporter says this should be filed under. */
    suggestedStyle: integer("suggested_style"),
    /** Lecture category the reporter says this belongs to. */
    suggestedCategory: text("suggested_category"),
    /** `college`, `high-school` or an explicit round for a miscategorised round. */
    suggestedRoundLevel: text("suggested_round_level"),
    /** Account email when the reporter was signed in. */
    reportedBy: text("reported_by"),
    /** `open`, `applied` or `dismissed`. */
    status: text("status").notNull().default("open"),
    resolvedBy: text("resolved_by"),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    videoIdx: index("idx_video_issues_video").on(table.videoId),
    statusIdx: index("idx_video_issues_status").on(table.status),
  }),
);

export type VideoIssueRow = typeof videoIssues.$inferSelect;
export type VideoIssueInsert = typeof videoIssues.$inferInsert;

// Account-linked in-app notifications — backs the Create New Round dialog's
// "invite a registered user" flow (an invitee with a matching `user` row
// gets one of these instead of an email, since they can already see it
// in-app) and the dock Settings menu's "Notifications" entry/toast. Unlike
// `packages/debate-round/src/state/prepNoteNotifications.ts`'s
// localStorage-only, free-form-recipient-id notifications, these are real
// cross-account notifications — the recipient is a `user.id`, not a
// same-browser teammate label — so they live server-side. `link` is an
// app-relative path (e.g. `/debate/{slug}`) the client navigates to on
// click; `readAt` null means unread, same "absent = default" nullable
// convention as every other column in this file.
export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    readAt: integer("read_at", { mode: "timestamp" }),
  },
  (table) => ({
    userIdIdx: index("idx_notifications_user_id").on(table.userId),
    userCreatedIdx: index("idx_notifications_user_created").on(table.userId, table.createdAt),
  }),
);

export type NotificationRow = typeof notifications.$inferSelect;

// Account-linked drill-set sync — the "sharing the 'Practice tier' status
// across devices for a signed-in user" follow-up named under the "📚 AI
// Drill Generator" bullet in TODO.md's Research Crowdsourcing Organizer
// Features. One row per (user, round) pair, keyed by the caller-typed
// `DrillSetRecord.roundId` — a drill set is looked up/edited by round, not
// appended to a growing log — same shape as `savedWordCountRounds` above.
export const savedDrillSets = sqliteTable(
  "saved_drill_sets",
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
    userIdIdx: index("idx_saved_drill_sets_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_drill_sets_user_client").on(table.userId, table.clientId),
  }),
);

export type SavedDrillSetRow = typeof savedDrillSets.$inferSelect;

// Account-linked custom-opponent-persona-library sync — the "🤖 AI Practice
// Opponent" idea's "share a custom-authored persona across a team instead
// of per-user only" Next item in TODO.md's Research Crowdsourcing Organizer
// Features. One row per (user, library entry) pair, keyed by the
// caller-typed `SavedCustomOpponentPersona.id` — same shape as
// `savedDrillSets` above. `shared` is broken out of `data` into its own
// column (rather than only living inside the JSON blob) so
// `GET /api/custom-opponent-personas/shared` can filter across every user's
// rows without deserializing each one.
export const savedCustomOpponentPersonas = sqliteTable(
  "saved_custom_opponent_personas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    shared: integer("shared", { mode: "boolean" }).notNull().default(false),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_custom_opponent_personas_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_custom_opponent_personas_user_client").on(table.userId, table.clientId),
    sharedIdx: index("idx_saved_custom_opponent_personas_shared").on(table.shared),
  }),
);

export type SavedCustomOpponentPersonaRow = typeof savedCustomOpponentPersonas.$inferSelect;

// Practice vs AI rounds — the storage the ported `debate-practice-vs-ai`
// backend needs in place of the Go server's Mongo `debatevsbot` collection.
// One row per round: who owns it, which bot and topic it ran, the transcript
// so far, the phase clocks, and the outcome once judged or conceded. The
// whole `DebateVsBotRecord` shape (history and timings included) lives in the
// `data` JSON blob, matching how `saved_flows`/`saved_rounds` store their
// records; the columns alongside it are only what queries filter or sort on.
export const practiceVsAiDebates = sqliteTable(
  "practice_vs_ai_debates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** The Go schema keyed debates by email; kept so ported queries match. */
    email: text("email").notNull().default(""),
    botName: text("bot_name").notNull().default(""),
    topic: text("topic").notNull().default(""),
    /** Free-text outcome: "User conceded", or the judge's raw JSON reply. */
    outcome: text("outcome").notNull().default(""),
    /** Judged status — "win" | "loss" | "draw" | "pending". */
    result: text("result").notNull().default("pending"),
    /** The full `DebateVsBotRecord`, JSON-encoded. */
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_practice_vs_ai_debates_user_id").on(table.userId),
    userCreatedIdx: index("idx_practice_vs_ai_debates_user_created").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export type PracticeVsAiDebateRow = typeof practiceVsAiDebates.$inferSelect;

// Account-linked scheduled-sprint-session sync — the "🤝 Team Collaboration
// Mode" bullet's "Scheduled sessions ... are ... local-only (no account
// sync yet)" Known gap in TODO.md. Same add/delete-only shape as
// `savedDailyBestCardComments` above (a session is scheduled once and only
// ever cancelled, never edited): `clientId` holds the session's own
// generated `SprintSession.id`, and `topic` is a plain (non-unique) indexed
// column for a future per-topic query, mirroring `dayKey`'s role there.
export const savedSprintSessions = sqliteTable(
  "saved_sprint_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    topic: text("topic").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_saved_sprint_sessions_user_id").on(table.userId),
    userClientIdx: uniqueIndex("idx_saved_sprint_sessions_user_client").on(
      table.userId,
      table.clientId,
    ),
    topicIdx: index("idx_saved_sprint_sessions_topic").on(table.topic),
  }),
);

export type SavedSprintSessionRow = typeof savedSprintSessions.$inferSelect;

// ── Contacts, blocks, and shared collab cards ───────────────────────────
//
// The account-linked half of the CardMirror editor's real-time collaboration
// (`packages/debate-editor/src/editor/collab/*`): a session's share code +
// guest pass used to reach a partner only over the clipboard (or, on desktop,
// the cardmirror pairing mailbox, which binds to a per-browser key rather
// than to a person). These tables key everything to better-auth `user.id`s
// instead, so a signed-in user has a contacts list they can share a live
// card with directly, and a shared card shows up as available on the
// recipient's account wherever they sign in. See packages/debate-help-docs/content/docs/features/contacts.mdx.

// One row per unordered pair of users. A request is a `pending` row from
// `requester` to `addressee`; accepting flips it to `accepted` (the row is
// then symmetric — either side is "the contact" of the other); declining or
// removing deletes it. The unique index is on the directed pair, and the
// route layer checks both directions before inserting so a pair never ends
// up with two rows.
export const contacts = sqliteTable(
  "contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "pending" | "accepted". */
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pairIdx: uniqueIndex("idx_contacts_pair").on(table.requesterId, table.addresseeId),
    addresseeIdx: index("idx_contacts_addressee").on(table.addresseeId),
  }),
);

export type ContactRow = typeof contacts.$inferSelect;

// A unilateral block: `blocker` no longer receives requests, shares, or
// contact-list visibility from `blocked`. Blocking also deletes any contact
// row and revokes any card shares between the two (both directions) in the
// same request — see /api/contacts/block.
export const userBlocks = sqliteTable(
  "user_blocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    pairIdx: uniqueIndex("idx_user_blocks_pair").on(table.blockerId, table.blockedId),
    blockedIdx: index("idx_user_blocks_blocked").on(table.blockedId),
  }),
);

export type UserBlockRow = typeof userBlocks.$inferSelect;

// A live collab card (a CardMirror co-editing session) shared from one
// account to one contact. `shareCode` is the editor's `cmshare1.<roomId>.
// <key>` code and `guestPass` the relay's account-less join credential —
// together exactly what a pasted invite link carries. Storing them here is a
// deliberate trade: the room key is E2E material the relay itself never
// sees, but a share that follows a person across devices has to live
// somewhere their account can read it, and this app's own database is that
// place (the same trust the `documents` table already holds for the doc's
// full content). `roomId` is denormalized from the code so re-sharing the
// same room to the same person upserts (unique on `(room_id, recipient_id)`)
// rather than duplicating. `revokedAt` is the owner's "stop sharing";
// `openedAt` is the recipient's first open, for the "new" badge.
export const cardShares = sqliteTable(
  "card_shares",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: text("room_id").notNull(),
    shareCode: text("share_code").notNull(),
    guestPass: text("guest_pass"),
    title: text("title").notNull().default(""),
    message: text("message"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    openedAt: integer("opened_at", { mode: "timestamp" }),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
  },
  (table) => ({
    ownerIdx: index("idx_card_shares_owner").on(table.ownerId),
    recipientIdx: index("idx_card_shares_recipient").on(table.recipientId),
    roomRecipientIdx: uniqueIndex("idx_card_shares_room_recipient").on(table.roomId, table.recipientId),
  }),
);

export type CardShareRow = typeof cardShares.$inferSelect;

// Last-seen heartbeat, one row per user, bumped by the contacts poll
// (`GET /api/contacts`) — the cheapest possible "is this contact around
// right now" signal, so a contacts list can show who is online without a
// push channel (none exists in this repo; see `useAccountNotifications`'s
// polling note). Threshold lives in `debate-team-collaboration`'s
// `lib/contacts.ts` (`isPresenceOnline`).
export const userPresence = sqliteTable("user_presence", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type UserPresenceRow = typeof userPresence.$inferSelect;

// Debate card library — the searchable corpus behind /cards, loaded from the
// published Parquet shards by `debate-cards-upload` (the CLI in
// packages/debate-search-evidence/src/cli) or by the admin panel's Parquet
// uploader. Both post batches to /api/admin/debate-cards, which upserts here.
//
// `id` is the dump's own card id rather than an autoincrement, so re-importing
// a shard updates the rows it already wrote instead of duplicating the corpus
// — importing the same file twice is a no-op, and a corrected shard can be
// replayed over the old one.
//
// The three text projections are stored side by side because search hits and
// card display need different ones: `spoken` is the highlighted text as read
// aloud, `fulltext` the unhighlighted body, and `markup` the card HTML with
// its <mark>/<u> highlighting intact. `pocket`/`hat`/`block` are the dump's
// three outline levels, which the search UI shows as one argument-block path.
export const debateCards = sqliteTable(
  "debate_cards",
  {
    id: integer("id").primaryKey(),
    tag: text("tag").notNull().default(""),
    cite: text("cite").notNull().default(""),
    fullcite: text("fullcite").notNull().default(""),
    summary: text("summary").notNull().default(""),
    spoken: text("spoken").notNull().default(""),
    fulltext: text("fulltext").notNull().default(""),
    textLength: integer("text_length").notNull().default(0),
    markup: text("markup").notNull().default(""),
    pocket: text("pocket").notNull().default(""),
    hat: text("hat").notNull().default(""),
    block: text("block").notNull().default(""),
    bucketId: integer("bucket_id").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    side: text("side").notNull().default(""),
    caselistDisplayName: text("caselist_display_name").notNull().default(""),
    year: integer("year").notNull().default(0),
    event: text("event").notNull().default(""),
    level: text("level").notNull().default(""),
    /** Shard the row came from, so one file's import can be audited or replaced. */
    sourceFile: text("source_file").notNull().default(""),
    importedAt: integer("imported_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    yearIdx: index("idx_debate_cards_year").on(table.year),
    eventIdx: index("idx_debate_cards_event").on(table.event),
    levelIdx: index("idx_debate_cards_level").on(table.level),
    sideIdx: index("idx_debate_cards_side").on(table.side),
    caselistIdx: index("idx_debate_cards_caselist").on(table.caselistDisplayName),
    bucketIdx: index("idx_debate_cards_bucket").on(table.bucketId),
    sourceFileIdx: index("idx_debate_cards_source_file").on(table.sourceFile),
  }),
);

export type DebateCardRow = typeof debateCards.$inferSelect;

// One row per Parquet shard an admin has imported, so the admin panel can show
// what the library is made of and the operator can tell a re-import from a
// first import. Written by the same endpoint that upserts `debate_cards`;
// `rows_imported` accumulates across the many batches one shard arrives in.
export const debateCardImports = sqliteTable(
  "debate_card_imports",
  {
    fileName: text("file_name").primaryKey(),
    /** Cards written from this shard, summed across every batch. */
    rowsImported: integer("rows_imported").notNull().default(0),
    /** Rows the importer refused, summed the same way. */
    rowsSkipped: integer("rows_skipped").notNull().default(0),
    /** Run id shared by the batches, for correlating with the server logs. */
    lastImportId: text("last_import_id").notNull().default(""),
    /** Admin who started the most recent batch. */
    lastImportedBy: text("last_imported_by").notNull().default(""),
    firstImportedAt: integer("first_imported_at")
      .notNull()
      .default(sql`(unixepoch())`),
    lastImportedAt: integer("last_imported_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
);

export type DebateCardImportRow = typeof debateCardImports.$inferSelect;

// Account-linked sync for the sidebar's localStorage-backed tools — the
// "per-browser localStorage, not account-synced" Known gap recorded in
// packages/debate-help-docs/content/docs/internals/judge-profiles.mdx, opponent-team-profiles.md,
// flow-annotations.md, prep-notes.md, coaching-programs.md and friends, and
// the "every other localStorage-backed panel in this repo" phrasing of the
// same gap in scout-to-strategy.md.
//
// One table rather than a `saved_*` table per tool: the thirteen stores that
// still had the gap all have the same shape — a JSON array under one
// localStorage key, each record identified by one string field — so they
// share this table, keyed by (user_id, collection, client_id), and one
// `/api/tool-records/[collection]` route pair. `collection` is an allowlist
// value from `debate-data-sync`'s TOOL_RECORD_COLLECTIONS, checked by the
// route before any write, so this can't be used as a free-form per-user blob
// store. `data` holds the whole record JSON-stringified, mirroring
// `saved_drill_sets`/`saved_tournament_results`' blob-column approach — a
// record is read and written as one unit by the tool that owns it, and its
// fields are that tool's business rather than this table's.
export const savedToolRecords = sqliteTable(
  "saved_tool_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
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
    // Every read is "this user's records for this collection", so the index
    // carries both columns rather than user_id alone.
    userCollectionIdx: index("idx_saved_tool_records_user_collection").on(
      table.userId,
      table.collection,
    ),
    userCollectionClientIdx: uniqueIndex("idx_saved_tool_records_user_collection_client").on(
      table.userId,
      table.collection,
      table.clientId,
    ),
  }),
);

export type SavedToolRecordRow = typeof savedToolRecords.$inferSelect;

// Staff roles granted from the admin panel. Admins themselves come from the
// ADMIN_EMAIL / ADMIN_EMAILS env allowlist (see `lib/auth/admin.ts`); this
// table only holds the moderators an admin invited — people who can edit the
// video library, video reports and the round-video queue but not accounts,
// sync jobs or uploads. Keyed by email rather than `user.id` so a moderator
// can be invited before they have ever signed in.
export const staffRoles = sqliteTable("staff_roles", {
  email: text("email").primaryKey(),
  /** Currently always `moderator`. */
  role: text("role").notNull().default("moderator"),
  invitedBy: text("invited_by"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type StaffRoleRow = typeof staffRoles.$inferSelect;

// Stripe subscriptions, written only by the `/api/stripe/webhook` handler (see
// `lib/stripe/`). Keyed by the Stripe subscription id rather than `user.id`
// because Stripe does not order its events: `customer.subscription.created`
// can land before the `checkout.session.completed` that carries our user id
// (`client_reference_id`), so a row may briefly exist with `user_id` null
// until the checkout event links it.
export const stripeSubscriptions = sqliteTable(
  "stripe_subscriptions",
  {
    subscriptionId: text("subscription_id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    customerId: text("customer_id"),
    email: text("email"),
    priceId: text("price_id"),
    /** A `PlanId` from `lib/stripe/plans.ts`, or `unknown` for an unlisted price. */
    plan: text("plan"),
    /** Stripe's subscription status — `active`, `trialing`, `past_due`, `canceled`, … */
    status: text("status"),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdx: index("idx_stripe_subscriptions_user").on(table.userId),
    customerIdx: index("idx_stripe_subscriptions_customer").on(table.customerId),
  }),
);

export type StripeSubscriptionRow = typeof stripeSubscriptions.$inferSelect;
