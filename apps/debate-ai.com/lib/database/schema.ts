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
