/**
 * The recent-flows list behind the start screen.
 *
 * Flows live wherever the user put them, so there is no directory to scan and
 * no database to sort: this list is the only memory ebb keeps of where its
 * documents are. It holds paths and nothing else. Labels are derived by reading
 * the files themselves at render time, so a flow renamed or edited outside ebb
 * is never described from a stale cache.
 *
 * The file is hand-editable and can be synced between machines, so parsing is
 * total: anything unrecognizable degrades to an empty list rather than blocking
 * the start screen.
 */

import type { FlowFs } from "./flowFs";

export interface RecentFlow {
    path: string;
    /** ms timestamp this flow was last opened by ebb. */
    openedAt: number;
}

/** Kept on disk. Deep enough to survive a tournament's worth of churn. */
export const RECENTS_KEPT = 20;

/** Shown on the start screen, each addressable by a number key. */
export const RECENTS_SHOWN = 6;

/** Move a path to the front, replacing any earlier entry for the same file. */
export function promoteRecent(
    list: readonly RecentFlow[],
    path: string,
    openedAt: number,
): RecentFlow[] {
    return [{ path, openedAt }, ...list.filter((r) => r.path !== path)].slice(0, RECENTS_KEPT);
}

export function serializeRecents(list: readonly RecentFlow[]): string {
    return JSON.stringify({ version: 1, flows: list }, null, 2) + "\n";
}

export function parseRecents(text: string | null): RecentFlow[] {
    if (!text) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return [];
    }
    if (typeof parsed !== "object" || parsed === null || !("flows" in parsed)) return [];
    if (!Array.isArray(parsed.flows)) return [];
    // Array.isArray narrows unknown to any[]; widen back so entries stay unknown.
    const flows = parsed.flows as unknown[];

    const seen = new Set<string>();
    const out: RecentFlow[] = [];
    for (const entry of flows) {
        if (typeof entry !== "object" || entry === null || !("path" in entry)) continue;
        const path = entry.path;
        if (typeof path !== "string" || !path || seen.has(path)) continue;
        const openedAt = "openedAt" in entry ? entry.openedAt : 0;
        seen.add(path);
        out.push({ path, openedAt: typeof openedAt === "number" ? openedAt : 0 });
        if (out.length === RECENTS_KEPT) break;
    }
    return out;
}

export async function loadRecents(fs: FlowFs): Promise<RecentFlow[]> {
    return parseRecents(await fs.readRecents());
}

export async function saveRecents(fs: FlowFs, list: readonly RecentFlow[]): Promise<void> {
    await fs.writeRecents(serializeRecents(list));
}
