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
 * hold. It is also past what a tab can hold in one piece (`hspf26-all` was
 * 1.87 GB on 2026-10-07), so archives are read with HTTP Range requests a few
 * megabytes at a time ({@link loadRemoteCaselistArchive}) rather than
 * downloaded whole.
 *
 * Every failure — listing, discovery, opening an archive, an unreadable
 * document, a rejected card batch — goes into the import log shown under the
 * caselist rows, which survives a reload and can be copied or downloaded. Card ids are stable hashes of where each card came from, so re-running
 * a sync — or stopping one halfway and starting again — upserts rather than
 * duplicates.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FolderSync,
  StopCircle,
  Trash2,
} from "lucide-react";
import type { Caselist } from "@debate/data-sync/src/caselist/caselist-config";
import type { CaselistArchive } from "@debate/data-sync/src/caselist/downloads-page-parser";
import {
  loadCaselistArchive,
  loadRemoteCaselistArchive,
  type CaselistArchiveLoad,
  type LoadArchiveOptions,
} from "@debate/data-sync/src/caselist/caselist-archive";
import { caselistDocumentToCardRows } from "@debate/data-sync/src/caselist/caselist-cards";
import {
  CARD_UPLOAD_BATCH_ROWS,
  createCardBatchSender,
  dedupeCardsById,
  normalizeDebateCardRows,
  type DebateCardRecord,
} from "@debate/research-evidence";
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
/** Where the last run's log is kept so it survives a reload. */
const LOG_STORAGE_KEY = "caselist-sync-log";
/** Oldest entries are dropped past this, so a 3,000-doc failure storm stays renderable. */
const LOG_LIMIT = 2_000;

/** Which step of the sync an entry is about. */
type LogStage = "list" | "discovery" | "download" | "convert" | "upload";

/** One line of the import log. */
export interface CaselistLogEntry {
  /** ISO timestamp. */
  at: string;
  level: "error" | "warn" | "info";
  stage: LogStage;
  /** Caselist slug, when the entry is about one. */
  caselist?: string;
  /** Archive file name, when the entry is about one. */
  archive?: string;
  message: string;
}

/** Renders the log as plain text, one entry per line, for copy and download. */
export function formatCaselistLog(entries: readonly CaselistLogEntry[]): string {
  return entries
    .map((entry) =>
      [
        entry.at,
        entry.level.toUpperCase(),
        entry.stage,
        entry.caselist ?? "-",
        entry.archive ?? "-",
        entry.message,
      ].join("\t"),
    )
    .join("\n");
}

/** Reads the saved log; storage can be missing or blocked, which reads as empty. */
function readSavedLog(): CaselistLogEntry[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOG_STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? (saved as CaselistLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Bytes as a short human size, e.g. `1.9 GB`. */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

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
  /** Bytes of the current archive read so far, and the total to read. */
  progress?: { bytesRead: number; bytesTotal: number };
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
  const abortRef = useRef<{ aborted: boolean; controller: AbortController }>({
    aborted: false,
    controller: new AbortController(),
  });
  const [rows, setRows] = useState<CaselistRow[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [discoverOnly, setDiscoverOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<CaselistLogEntry[]>([]);
  const [errorsOnly, setErrorsOnly] = useState(false);

  useEffect(() => {
    setLog(readSavedLog());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
    } catch {
      // Storage full or blocked: the log still shows for this session.
    }
  }, [log]);

  const addLog = useCallback((entry: Omit<CaselistLogEntry, "at">) => {
    const full = { at: new Date().toISOString(), ...entry };
    const line = `[caselist-sync] ${full.stage} ${full.caselist ?? ""} ${full.archive ?? ""}: ${full.message}`;
    if (full.level === "error") console.error(line);
    else if (full.level === "warn") console.warn(line);
    setLog((previous) => [...previous, full].slice(-LOG_LIMIT));
  }, []);

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

      const options: LoadArchiveOptions = {
        slug: caselist.slug,
        parseCards: true,
        onDocument: async (document) => {
          if (abortRef.current.aborted) return;
          const normalized = normalizeDebateCardRows(caselistDocumentToCardRows(document, caselist));
          pending.push(...dedupeCardsById(normalized.cards, seenIds).cards);
          if (pending.length >= CARD_UPLOAD_BATCH_ROWS) await flush();
        },
      };
      const context = { caselist: caselist.slug, archive: archive.fileName };

      let load: CaselistArchiveLoad;
      try {
        load = await loadRemoteCaselistArchive(archive.url, {
          ...options,
          signal: abortRef.current.controller.signal,
          onProgress: (progress) => patchRow(caselist.slug, { progress }),
        });
      } catch (caught) {
        const message = (caught as Error).message;
        // A batch the server rejected is not a download problem; retrying
        // the whole archive another way would only fail the same batch again.
        if (/^Batch \d+ of /.test(message)) throw caught;
        if (cards > 0 || abortRef.current.aborted) throw caught;
        addLog({
          level: "warn",
          stage: "download",
          ...context,
          message: `Reading by byte range failed (${message}); downloading the whole file instead.`,
        });
        const response = await fetch(archive.url).catch((fetchError: Error) => {
          throw new Error(`Downloading ${archive.fileName} failed: ${fetchError.message}`);
        });
        if (!response.ok) {
          throw new Error(
            `Downloading ${archive.fileName} failed: HTTP ${response.status} ${response.statusText}`.trim(),
          );
        }
        const bytes = await response.arrayBuffer().catch((readError: Error) => {
          throw new Error(
            `Downloading ${archive.fileName} failed while reading the body: ${readError.message}`,
          );
        });
        load = await loadCaselistArchive(bytes, options);
      }
      if (!abortRef.current.aborted) await flush();

      for (const failure of load.failures) {
        addLog({
          level: "warn",
          stage: "convert",
          ...context,
          message: `${failure.path}: ${failure.reason} (${failure.code})`,
        });
      }

      return { documents: load.importedCount, failures: load.failures.length, cards };
    },
    [addLog, patchRow],
  );

  const syncAll = useCallback(async () => {
    if (isSyncing) return;
    abortRef.current = { aborted: false, controller: new AbortController() };
    setIsSyncing(true);
    setError(null);
    addLog({
      level: "info",
      stage: "list",
      message: discoverOnly ? "Checking for new archives." : "Sync started.",
    });

    let caselists: Caselist[];
    try {
      caselists = (await getJson<{ caselists: Caselist[] }>(DISCOVERY_ENDPOINT)).caselists;
    } catch (caught) {
      setError((caught as Error).message);
      addLog({ level: "error", stage: "list", message: (caught as Error).message });
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
        addLog({ level: "error", stage: "discovery", caselist: slug, message: (caught as Error).message });
        continue;
      }
      patchRow(slug, { plan, status: discoverOnly ? "done" : "syncing" });
      for (const note of plan.notes) {
        addLog({
          level: plan.source === "none" ? "error" : "info",
          stage: "discovery",
          caselist: slug,
          message: note,
        });
      }
      addLog({
        level: "info",
        stage: "discovery",
        caselist: slug,
        message:
          plan.pending.length === 0
            ? `Up to date (${plan.archives.length} archive(s) via ${plan.source}).`
            : `${plan.pending.length} archive(s) to import: ${plan.pending.map((a) => a.fileName).join(", ")}.`,
      });
      if (discoverOnly) continue;

      const totals = { archivesDone: 0, documents: 0, cards: 0, failures: 0 };
      let failed: string | undefined;
      for (const archive of plan.pending) {
        if (abortRef.current.aborted) break;
        patchRow(slug, { current: archive.fileName, progress: undefined });
        try {
          const result = await syncArchive(caselist, archive, send, seenIds);
          totals.archivesDone += 1;
          totals.documents += result.documents;
          totals.cards += result.cards;
          totals.failures += result.failures;
          patchRow(slug, { ...totals });
          addLog({
            level: "info",
            stage: "upload",
            caselist: slug,
            archive: archive.fileName,
            message: `Imported ${result.documents} doc(s), ${result.cards} card(s), ${result.failures} unreadable.`,
          });
        } catch (caught) {
          // Later archives are only meaningful on top of this one, so stop the
          // caselist here; the next run's plan starts again from it.
          failed = (caught as Error).message;
          addLog({
            level: "error",
            stage: /^Batch \d+ of /.test(failed) ? "upload" : "download",
            caselist: slug,
            archive: archive.fileName,
            message: failed,
          });
          break;
        }
      }

      patchRow(slug, {
        ...totals,
        current: undefined,
        progress: undefined,
        status: failed ? "failed" : abortRef.current.aborted ? "cancelled" : "done",
        error: failed,
      });
    }

    addLog({ level: "info", stage: "list", message: "Run finished." });
    setIsSyncing(false);
  }, [isSyncing, discoverOnly, patchRow, syncArchive, addLog]);

  const errorCount = log.filter((entry) => entry.level === "error").length;
  const warnCount = log.filter((entry) => entry.level === "warn").length;
  const shownLog = (errorsOnly ? log.filter((entry) => entry.level !== "info") : log).slice(-500);

  const downloadLog = useCallback(() => {
    const blob = new Blob([formatCaselistLog(log)], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `caselist-sync-log-${new Date().toISOString().slice(0, 19)}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  }, [log]);

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
                abortRef.current.controller.abort();
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
                    {row.current && row.progress
                      ? `${formatBytes(row.progress.bytesRead)} of ${formatBytes(row.progress.bytesTotal)} read · `
                      : ""}
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

        {log.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Import log">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Import log</span>
              <span className={errorCount > 0 ? "text-destructive text-xs" : "text-xs text-muted-foreground"}>
                {errorCount} error(s) · {warnCount} warning(s) · {log.length} entries
              </span>
              <label className="ml-auto flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={errorsOnly}
                  onChange={(event) => setErrorsOnly(event.target.checked)}
                />
                Errors and warnings only
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(formatCaselistLog(log));
                }}
              >
                <ClipboardCopy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadLog}>
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Download
              </Button>
              <Button variant="outline" size="sm" disabled={isSyncing} onClick={() => setLog([])}>
                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </Button>
            </div>
            <ol className="max-h-80 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-xs">
              {shownLog.map((entry, index) => (
                <li
                  key={`${entry.at}-${index}`}
                  className={
                    entry.level === "error"
                      ? "text-destructive"
                      : entry.level === "warn"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                  }
                >
                  <span className="opacity-70">{entry.at.slice(11, 19)}</span>{" "}
                  <span className="uppercase">{entry.level}</span> {entry.stage}
                  {entry.caselist ? ` ${entry.caselist}` : ""}
                  {entry.archive ? ` ${entry.archive}` : ""}: {entry.message}
                </li>
              ))}
            </ol>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
