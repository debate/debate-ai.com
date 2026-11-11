import { count, eq } from "drizzle-orm";
import { findToolRecordCollection } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import type { getDBFromContext } from "@/lib/database/context";
import { savedToolRecords } from "../database/schema";
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
 * Settings shows their count without a dead link. `vulnerabilityReports`
 * points at `/coaching/outcomes`, whose page (and `VulnerabilityChartsPanel`
 * mount) is gone. `saved-data.test.ts` fails once such a page is served again,
 * so this list can't outlive the gap.
 */
export const UNLINKED_TOOL_COLLECTIONS: ReadonlySet<string> = new Set(["vulnerabilityReports"]);

export interface SavedDataSummary {
  items: SavedDataItem[];
  /** Tool-record collections that hold at least one row, largest first. */
  tools: SavedToolCollection[];
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
 * Per-kind counts of the caller's own saved work. Reuses the admin usage
 * query (one correlated subquery per table) narrowed to a single user id, so
 * the user and admin views can never disagree. Returns zeros for an unknown id.
 */
export async function loadOwnSavedData(db: AccountDB, userId: string): Promise<SavedDataSummary> {
  const usage = await loadUserUsage(db, userId);
  const items = SAVED_DATA_KINDS.map(({ key, label, href }) => ({ key, label, count: Number(usage?.[key] ?? 0), href }));
  const tools = await loadOwnToolCollections(db, userId);
  const total = items.reduce((sum, item) => sum + item.count, 0) + tools.reduce((sum, t) => sum + t.count, 0);
  return { items, tools, total };
}
