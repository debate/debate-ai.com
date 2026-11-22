import { count, eq } from "drizzle-orm";
import type { AnySQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { findToolRecordCollection } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import type { getDBFromContext } from "@/lib/database/context";
import {
  savedCoachMaterials,
  savedCounselPanelAssessments,
  savedCustomOpponentPersonas,
  savedDailyBestCardComments,
  savedLearnCards,
  savedLearnDecks,
  savedQuickCards,
  savedRoundPairings,
  savedSprintSessions,
  savedStrategyRecommendations,
  savedToolRecords,
} from "../database/schema";
import { loadUserUsage, type UsageKey } from "../admin/user-usage";

type AccountDB = Awaited<ReturnType<typeof getDBFromContext>>;

/**
 * What a signed-in user sees under Settings → "Saved to your account": the
 * work kinds that live in SQL rows linked to their user id. Order is the
 * order shown; `videosWatched` is deliberately left out (history, not work).
 * `href` is the tool page that opens and edits that kind, so each row in
 * Settings links straight to where the work lives (`saved-data.test.ts`
 * checks every one against the app's route table).
 */
export const SAVED_DATA_KINDS: ReadonlyArray<{ key: UsageKey; label: string; href: string }> = [
  { key: "docs", label: "Documents", href: "/reason-editor" },
  { key: "flows", label: "Flows", href: "/debate" },
  { key: "rounds", label: "Rounds", href: "/debate" },
  { key: "wordCountRounds", label: "Word-count rounds", href: "/word-count" },
  { key: "practiceRounds", label: "Practice debates vs AI", href: "/practice/versus-ai" },
  { key: "judgeDecisions", label: "Judge decisions", href: "/practice/judge-decision" },
  { key: "speeches", label: "Sent speeches", href: "/speech-documents" },
  { key: "drills", label: "Drill sets", href: "/practice/drills" },
];

/**
 * Per-user `saved_*` tables that tools write behind their own `/api` route but
 * that are not one of the {@link SAVED_DATA_KINDS} work kinds above. Before
 * this list they were saved under the user's id yet never shown under
 * "Saved to your account", so a user couldn't see that their briefings,
 * flashcard decks or opponent personas were in their account at all.
 * Settings shows them under "More saved work", counts only, each linked to
 * the page that opens it (labels and pages match the tools page's "My Saved
 * Items" widget, `CLOUD_LIBRARY_KIND_LABELS` in `debate-round`).
 *
 * Left out on purpose: `saved_learn_review_log` (review history, not work —
 * like watch history), `saved_coach_material_versions` (earlier versions of
 * the coach materials counted here) and `saved_tournament_results` (no page
 * opens them yet). `saved-data.test.ts` checks every `href` against the
 * app's route table.
 */
export const SAVED_SQL_TOOLS: ReadonlyArray<{ key: string; label: string; href: string; table: SQLiteTable; userId: AnySQLiteColumn }> = [
  { key: "roundPairings", label: "Briefings", href: "/practice/prep?section=briefings", table: savedRoundPairings, userId: savedRoundPairings.userId },
  { key: "strategyRecommendations", label: "Strategies", href: "/practice/prep?section=strategy", table: savedStrategyRecommendations, userId: savedStrategyRecommendations.userId },
  { key: "counselPanelAssessments", label: "Outcome charts", href: "/coaching/outcomes", table: savedCounselPanelAssessments, userId: savedCounselPanelAssessments.userId },
  { key: "customOpponentPersonas", label: "Opponent personas", href: "/practice", table: savedCustomOpponentPersonas, userId: savedCustomOpponentPersonas.userId },
  { key: "coachMaterials", label: "Coach materials", href: "/coaching?section=materials", table: savedCoachMaterials, userId: savedCoachMaterials.userId },
  { key: "sprintSessions", label: "Topic sprints", href: "/research", table: savedSprintSessions, userId: savedSprintSessions.userId },
  { key: "quickCards", label: "Quick cards", href: "/reason-editor", table: savedQuickCards, userId: savedQuickCards.userId },
  { key: "learnDecks", label: "Flashcard decks", href: "/reason-editor", table: savedLearnDecks, userId: savedLearnDecks.userId },
  { key: "learnCards", label: "Flashcards", href: "/reason-editor", table: savedLearnCards, userId: savedLearnCards.userId },
  { key: "dailyBestCardComments", label: "Best-card comments", href: "/research/cards/best-card", table: savedDailyBestCardComments, userId: savedDailyBestCardComments.userId },
];

/** One {@link SAVED_SQL_TOOLS} table with saved rows. */
export interface SavedSqlTool {
  key: string;
  label: string;
  count: number;
  /** The page that opens this kind of saved work. */
  href: string;
}

export interface SavedDataItem {
  key: UsageKey;
  label: string;
  count: number;
  /** The tool page where this kind of work is opened. */
  href: string;
}

/** One synced tool-record collection (shortcuts, pinned debates…) with saved rows. */
export interface SavedToolCollection {
  collection: string;
  label: string;
  count: number;
  /** The tool page that owns the collection (its `href` in the sync catalog); null when that page no longer exists. */
  href: string | null;
}

/**
 * Collections whose catalog `href` names a page the app no longer serves, so
 * Settings shows their count without a dead link. Empty since
 * `/coaching/outcomes` (the `vulnerabilityReports` page) was routed again.
 * `saved-data.test.ts` fails once a listed page is served again, so an entry
 * can't outlive its gap.
 */
export const UNLINKED_TOOL_COLLECTIONS: ReadonlySet<string> = new Set<string>();

export interface SavedDataSummary {
  items: SavedDataItem[];
  /** Tool-record collections that hold at least one row, largest first. */
  tools: SavedToolCollection[];
  /** {@link SAVED_SQL_TOOLS} tables that hold at least one row, largest first. */
  sqlTools: SavedSqlTool[];
  total: number;
}

/**
 * Per-collection row counts from `saved_tool_records` for one user. Rows under
 * a key no longer in the sync allowlist are dropped (nothing can open them),
 * and the watch-history collection is skipped since it is history, not work.
 */
async function loadOwnToolCollections(db: AccountDB, userId: string): Promise<SavedToolCollection[]> {
  const rows: Array<{ collection: string; count: number }> = await db
    .select({ collection: savedToolRecords.collection, count: count() })
    .from(savedToolRecords)
    .where(eq(savedToolRecords.userId, userId))
    .groupBy(savedToolRecords.collection);
  return rows
    .filter((row) => row.collection !== "debateVideoWatchHistory")
    .flatMap((row) => {
      const meta = findToolRecordCollection(row.collection);
      return meta ? [{ collection: row.collection, label: meta.label, count: Number(row.count), href: UNLINKED_TOOL_COLLECTIONS.has(row.collection) ? null : meta.href }] : [];
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Row counts of the caller's {@link SAVED_SQL_TOOLS} tables, one indexed
 * `count(*)` per table (each has a `user_id` index). Empty tables are dropped.
 */
async function loadOwnSqlTools(db: AccountDB, userId: string): Promise<SavedSqlTool[]> {
  const counts = await Promise.all(
    SAVED_SQL_TOOLS.map(async ({ table, userId: column }) => {
      const [row] = await db.select({ value: count() }).from(table).where(eq(column, userId));
      return Number(row?.value ?? 0);
    }),
  );
  return SAVED_SQL_TOOLS.map(({ key, label, href }, i) => ({ key, label, href, count: counts[i] }))
    .filter((tool) => tool.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Per-kind counts of the caller's own saved work. Reuses the admin usage
 * query (one correlated subquery per table) narrowed to a single user id, so
 * the user and admin views can never disagree. Returns zeros for an unknown id.
 */
export async function loadOwnSavedData(db: AccountDB, userId: string): Promise<SavedDataSummary> {
  const usage = await loadUserUsage(db, userId);
  const items = SAVED_DATA_KINDS.map(({ key, label, href }) => ({ key, label, count: Number(usage?.[key] ?? 0), href }));
  const [tools, sqlTools] = await Promise.all([loadOwnToolCollections(db, userId), loadOwnSqlTools(db, userId)]);
  const sum = (rows: ReadonlyArray<{ count: number }>) => rows.reduce((total, row) => total + row.count, 0);
  const total = sum(items) + sum(tools) + sum(sqlTools);
  return { items, tools, sqlTools, total };
}
