"use client";

import { useCallback, useEffect, useState } from "react";

import { parseFlowFile } from "../../lib/persistence/flowFile";
import { getFlowFs } from "../../lib/persistence/flowFs";
import { displayPath } from "../../lib/persistence/flowPaths";
import { loadRecents, RECENTS_SHOWN, saveRecents } from "../../lib/persistence/recents";
import { buildSummary, recentDetail, recentLabel } from "../../lib/start/summary";

/** One row in the toolbar's recent-flows menu, already resolved for display. */
export interface RecentEntry {
    path: string;
    /** Matchup when the round is scouted, filename when it is not. */
    label: string;
    /** Tournament and round, when the flow carries them. */
    detail: string;
    /** The path with the home directory collapsed to "~". */
    display: string;
    /** Last edit per the file, falling back to when ebb last opened it. */
    updatedAt: number;
}

export interface RecentFlows {
    /** Null while loading, so the screen can hold its frame instead of flashing. */
    entries: RecentEntry[] | null;
    /** Re-read the list, after a migration has written new files. */
    refresh: () => void;
}

/**
 * The recent flows, resolved by reading each file.
 *
 * Labels come from the files themselves rather than a cached copy, so a flow
 * scouted or edited outside ebb never shows a stale description. Six small JSON
 * reads cost nothing next to being wrong about what a file contains.
 *
 * A file that has vanished is pruned on the spot, because a flow moved or
 * deleted in Finder should not linger as a dead row. A file that exists but
 * will not parse keeps its row under its filename: that one the user needs to
 * know about, and opening it will say why.
 */
export function useRecentFlows(): RecentFlows {
    const [entries, setEntries] = useState<RecentEntry[] | null>(null);
    // Bumped after a migration so the list re-reads and shows the new files.
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(() => setNonce((n) => n + 1), []);

    useEffect(() => {
        let mounted = true;

        void (async () => {
            const fs = await getFlowFs();
            const { home } = await fs.locations();
            const recents = await loadRecents(fs);
            const shown = recents.slice(0, RECENTS_SHOWN);

            const resolved: RecentEntry[] = [];
            for (const recent of shown) {
                const snapshot = await fs.readFlow(recent.path);
                if (snapshot === null) continue;

                let summary = null;
                try {
                    summary = buildSummary(parseFlowFile(snapshot.text));
                } catch {
                    // Readable file, unreadable contents. The row stays.
                }
                resolved.push({
                    path: recent.path,
                    label: recentLabel(summary, recent.path),
                    detail: recentDetail(summary),
                    display: displayPath(recent.path, home),
                    updatedAt: summary?.updatedAt ?? recent.openedAt,
                });
            }

            if (resolved.length !== shown.length) {
                // Only the entries actually checked can be pruned; everything
                // past the shown window was never read and stays put.
                const found = new Set(resolved.map((e) => e.path));
                const missing = new Set(shown.map((s) => s.path).filter((p) => !found.has(p)));
                await saveRecents(
                    fs,
                    recents.filter((r) => !missing.has(r.path)),
                );
            }

            if (mounted) setEntries(resolved);
        })();

        return () => {
            mounted = false;
        };
    }, [nonce]);

    return { entries, refresh };
}
