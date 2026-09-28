"use client";

/**
 * @fileoverview Admin-only "sync all ongoing speech docs" panel.
 *
 * One button walks every caselist of the current season (HS Policy, HS LD,
 * HS PF, NDT/CEDA, NFA LD): `/api/admin/caselist-sync?slug=` discovers what
 * openCaselist has published and which archives the card library has not
 * imported yet, then each pending archive is downloaded from the bucket,
 * unpacked and converted in this tab, and its cards are posted to the same
 * `/api/admin/debate-cards` endpoint the Parquet importer uses.
 *
 * The browser does the heavy lifting for the same reason as the Parquet
 * importer: a season dump is hundreds of megabytes, past what a Worker can
 * hold. Card ids are stable hashes of where each card came from, so re-running
 * a sync — or stopping one halfway and starting again — upserts rather than
 * duplicates.
 */

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderSync, StopCircle } from "lucide-react";
import type { Caselist } from "debate-data-sync/src/caselist/caselist-config";
import type { CaselistArchive } from "debate-data-sync/src/caselist/downloads-page-parser";
import { loadCaselistArchive } from "debate-data-sync/src/caselist/caselist-archive";
import { caselistDocumentToCardRows } from "debate-data-sync/src/caselist/caselist-cards";
import {
  CARD_UPLOAD_BATCH_ROWS,
  createCardBatchSender,
  dedupeCardsById,
  normalizeDebateCardRows,
  type DebateCardRecord,
} from "debate-research-evidence";
import { Button } from "../../lib/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";

const DISCOVERY_ENDPOINT = "/api/admin/caselist-sync";
const CARDS_ENDPOINT = "/api/admin/debate-cards";

/** What discovery reported for one caselist. */
interface CaselistPlan {
  caselist: Caselist;
  source: string;
  notes: string[];
  archives: CaselistArchive[];
  latest: string[];
  imported: string[];
  pending: CaselistArchive[];
}

/** One caselist's row in the panel. */
interface CaselistRow {
  caselist: Caselist;
  status: "queued" | "discovering" | "syncing" | "done" | "failed" | "cancelled";
  plan?: CaselistPlan;
  /** Archive being worked on right now. */
  current?: string;
  archivesDone: number;
  documents: number;
  cards: number;
  failures: number;
  error?: string;
}

/** Fetches JSON, turning a non-2xx answer into an error with its message. */
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string; details?: string };
  if (!response.ok) {
    throw new Error(body.details ?? body.error ?? `Request failed: ${response.status}`);
  }
  return body;
}

/** Admin-only one-button sync of the current season's openCaselist docs. */
export function CaselistSyncPanel() {
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [rows, setRows] = useState<CaselistRow[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [discoverOnly, setDiscoverOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchRow = useCallback((slug: string, patch: Partial<CaselistRow>) => {
    setRows((previous) =>
      previous.map((row) => (row.caselist.slug === slug ? { ...row, ...patch } : row)),
    );
  }, []);

  /** Downloads, converts and posts one archive; returns its tallies. */
  const syncArchive = useCallback(
    async (
      caselist: Caselist,
      archive: CaselistArchive,
      send: ReturnType<typeof createCardBatchSender>,
      seenIds: Set<number>,
    ) => {
      const response = await fetch(archive.url);
      if (!response.ok) {
        throw new Error(`Downloading ${archive.fileName} failed: ${response.status}`);
      }
      const bytes = await response.arrayBuffer();

      let pending: DebateCardRecord[] = [];
      let batchIndex = 0;
      let cards = 0;
      const flush = async () => {
        while (pending.length > 0) {
          const batch = pending.slice(0, CARD_UPLOAD_BATCH_ROWS);
          pending = pending.slice(CARD_UPLOAD_BATCH_ROWS);
          const result = await send(batch, { fileName: archive.fileName, batchIndex: batchIndex++ });
          cards += result.imported;
        }
      };

      const load = await loadCaselistArchive(bytes, {
        slug: caselist.slug,
        parseCards: true,
        onDocument: async (document) => {
          if (abortRef.current.aborted) return;
          const normalized = normalizeDebateCardRows(caselistDocumentToCardRows(document, caselist));
          pending.push(...dedupeCardsById(normalized.cards, seenIds).cards);
          if (pending.length >= CARD_UPLOAD_BATCH_ROWS) await flush();
        },
      });
      if (!abortRef.current.aborted) await flush();

      return { documents: load.importedCount, failures: load.failures.length, cards };
    },
    [],
  );

  const syncAll = useCallback(async () => {
    if (isSyncing) return;
    abortRef.current = { aborted: false };
    setIsSyncing(true);
    setError(null);

    let caselists: Caselist[];
    try {
      caselists = (await getJson<{ caselists: Caselist[] }>(DISCOVERY_ENDPOINT)).caselists;
    } catch (caught) {
      setError((caught as Error).message);
      setIsSyncing(false);
      return;
    }
    setRows(
      caselists.map((caselist) => ({
        caselist,
        status: "queued",
        archivesDone: 0,
        documents: 0,
        cards: 0,
        failures: 0,
      })),
    );

    const importId = `caselist_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const send = createCardBatchSender({ endpoint: CARDS_ENDPOINT, importId });
    const seenIds = new Set<number>();

    for (const caselist of caselists) {
      const slug = caselist.slug;
      if (abortRef.current.aborted) {
        patchRow(slug, { status: "cancelled" });
        continue;
      }

      patchRow(slug, { status: "discovering" });
      let plan: CaselistPlan;
      try {
        plan = await getJson<CaselistPlan>(`${DISCOVERY_ENDPOINT}?slug=${encodeURIComponent(slug)}`);
      } catch (caught) {
        patchRow(slug, { status: "failed", error: (caught as Error).message });
        continue;
      }
      patchRow(slug, { plan, status: discoverOnly ? "done" : "syncing" });
      if (discoverOnly) continue;

      const totals = { archivesDone: 0, documents: 0, cards: 0, failures: 0 };
      let failed: string | undefined;
      for (const archive of plan.pending) {
        if (abortRef.current.aborted) break;
        patchRow(slug, { current: archive.fileName });
        try {
          const result = await syncArchive(caselist, archive, send, seenIds);
          totals.archivesDone += 1;
          totals.documents += result.documents;
          totals.cards += result.cards;
          totals.failures += result.failures;
          patchRow(slug, { ...totals });
        } catch (caught) {
          // Later archives are only meaningful on top of this one, so stop the
          // caselist here; the next run's plan starts again from it.
          failed = (caught as Error).message;
          break;
        }
      }

      patchRow(slug, {
        ...totals,
        current: undefined,
        status: failed ? "failed" : abortRef.current.aborted ? "cancelled" : "done",
        error: failed,
      });
    }

    setIsSyncing(false);
  }, [isSyncing, discoverOnly, patchRow, syncArchive]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderSync className="h-4 w-4" aria-hidden="true" />
          Sync ongoing speech docs
        </CardTitle>
        <CardDescription>
          Pulls this season&apos;s openCaselist bulk archives for every caselist into the /cards
          library. A caselist that has never been synced is seeded from its newest season dump;
          after that only new weekly archives are fetched. Archives are downloaded and converted in
          this browser, so keep the tab open until it finishes. The same discovery runs from a
          terminal as <span className="font-mono">bun run grab-caselist</span>.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={syncAll} disabled={isSyncing}>
            <FolderSync className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSyncing ? "Syncing…" : discoverOnly ? "Check for new archives" : "Sync all speech docs"}
          </Button>
          {isSyncing && (
            <Button
              variant="outline"
              onClick={() => {
                abortRef.current.aborted = true;
              }}
            >
              <StopCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              Stop
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discoverOnly}
              disabled={isSyncing}
              onChange={(event) => setDiscoverOnly(event.target.checked)}
            />
            Only check what&apos;s new
          </label>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {rows.length > 0 && (
          <ul className="flex flex-col gap-2" aria-live="polite">
            {rows.map((row) => (
              <li key={row.caselist.slug} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {row.caselist.label}{" "}
                    <span className="font-mono text-xs text-muted-foreground">{row.caselist.slug}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.status === "done" && (
                      <CheckCircle2 className="inline h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                    )}
                    {row.status === "failed" && (
                      <AlertTriangle className="inline h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    )}{" "}
                    {row.status}
                  </span>
                </div>

                {row.plan && (
                  <p className="text-xs text-muted-foreground">
                    {row.plan.archives.length} archive(s) via {row.plan.source} · latest:{" "}
                    <span className="font-mono">{row.plan.latest.join(", ") || "none"}</span> ·{" "}
                    {row.plan.pending.length === 0
                      ? "up to date"
                      : `${row.plan.pending.length} to import: ${row.plan.pending
                          .map((archive) => archive.fileName)
                          .join(", ")}`}
                  </p>
                )}

                {(row.status === "syncing" || row.archivesDone > 0) && (
                  <p className="text-xs text-muted-foreground">
                    {row.current ? `Importing ${row.current} · ` : ""}
                    {row.archivesDone} archive(s) · {row.documents.toLocaleString()} docs ·{" "}
                    {row.cards.toLocaleString()} cards
                    {row.failures > 0 ? ` · ${row.failures} unreadable docs` : ""}
                  </p>
                )}

                {row.plan?.source === "none" && row.plan.notes.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer opacity-80">Why nothing was found</summary>
                    <ul className="mt-1 flex flex-col gap-0.5 opacity-80">
                      {row.plan.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {row.error && <p className="text-xs text-destructive">{row.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
