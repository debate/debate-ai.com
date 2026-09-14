"use client";

/**
 * @fileoverview Admin-only Parquet importer for the debate-card library.
 *
 * The same import the `debate-cards-upload` CLI runs, for an operator who has
 * a shard on their laptop and no terminal: pick one or more `.parquet` files
 * and they are imported one at a time, in order, with live per-file progress.
 *
 * The file is decoded in the browser and posted as batches of rows — a shard
 * is hundreds of megabytes, so uploading the file itself would exceed both
 * the request limit and what a Worker can decode. That also means the tab has
 * to stay open for the duration, which the UI says plainly rather than
 * letting a half-finished import look finished.
 *
 * Reading, normalizing and batching are the shared functions from
 * `debate-research-evidence`, so this panel and the CLI accept and skip
 * exactly the same rows.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, StopCircle, Upload } from "lucide-react";
import {
  cardImportPercent,
  createCardBatchSender,
  emptyCardImportProgress,
  formatCardImportSummary,
  uploadDebateCardShard,
  type CardImportProgress,
  type DebateCardRowFailure,
  type ParquetSource,
} from "debate-research-evidence";
import { Button } from "../../lib/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";
import { Input } from "../../lib/ui/primitives/input";

/** One shard's row in the queue, and what has happened to it so far. */
interface QueuedShard {
  file: File;
  status: "queued" | "importing" | "done" | "failed" | "cancelled";
  progress: CardImportProgress;
  summary?: string;
  error?: string;
  failures: DebateCardRowFailure[];
}

/** A shard already in the library, as reported by the ingest endpoint. */
interface ImportedFile {
  fileName: string;
  rowsImported: number;
  rowsSkipped: number;
  lastImportedBy: string;
  lastImportedAt: number;
}

/** Where the library stands right now. */
interface LibraryStats {
  cards: number;
  caselists: number;
  files: ImportedFile[];
}

const ENDPOINT = "/api/admin/debate-cards";

/** Wraps a picked `File` as the random-access source the decoder reads. */
function fileAsParquetSource(file: File): ParquetSource {
  return {
    byteLength: file.size,
    slice: (start: number, end?: number) => file.slice(start, end).arrayBuffer(),
  };
}

/** Formats a unix-second timestamp for the imported-files table. */
function formatImportedAt(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString();
}

/** Admin-only Parquet importer for the card-search library. */
export function DebateCardParquetUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [shards, setShards] = useState<QueuedShard[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(ENDPOINT);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setStats((await response.json()) as LibraryStats);
      setStatsError(null);
    } catch (error) {
      setStatsError((error as Error).message);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /** Updates one queued shard in place. */
  const patchShard = useCallback((index: number, patch: Partial<QueuedShard>) => {
    setShards((previous) =>
      previous.map((shard, position) => (position === index ? { ...shard, ...patch } : shard)),
    );
  }, []);

  const importAll = useCallback(async () => {
    if (shards.length === 0 || isImporting) return;

    abortRef.current = { aborted: false };
    setIsImporting(true);

    // One run id ties every batch of every file to the same server-side log
    // entry, and re-imports of a file reset its counters rather than doubling
    // them.
    const importId = `web_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const send = createCardBatchSender({ endpoint: ENDPOINT, importId });
    // Shared across the run so a card that appears in two shards is written
    // once, matching the CLI's default.
    const seenIds = new Set<number>();

    for (let index = 0; index < shards.length; index++) {
      const shard = shards[index];
      if (shard.status === "done") continue;
      if (abortRef.current.aborted) {
        patchShard(index, { status: "cancelled" });
        continue;
      }

      patchShard(index, { status: "importing", progress: emptyCardImportProgress(), error: undefined });

      try {
        const outcome = await uploadDebateCardShard({
          source: fileAsParquetSource(shard.file),
          fileName: shard.file.name,
          send,
          seenIds,
          signal: abortRef.current,
          onProgress: (progress) => patchShard(index, { progress }),
        });

        patchShard(index, {
          status: abortRef.current.aborted ? "cancelled" : "done",
          progress: outcome.progress,
          failures: outcome.failures,
          summary: formatCardImportSummary(shard.file.name, outcome.progress),
        });
      } catch (error) {
        patchShard(index, { status: "failed", error: (error as Error).message });
      }

      await loadStats();
    }

    setIsImporting(false);
  }, [shards, isImporting, patchShard, loadStats]);

  const pickFiles = (files: FileList | null) => {
    const picked = Array.from(files ?? []);
    setShards(
      picked.map((file) => ({
        file,
        status: "queued" as const,
        progress: emptyCardImportProgress(),
        failures: [],
      })),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4" aria-hidden="true" />
          Card library import
        </CardTitle>
        <CardDescription>
          Import debate-card Parquet shards into the /cards search library. Files are read in the
          browser and uploaded one at a time as batches of rows, so a multi-hundred-megabyte shard
          imports without an upload limit — keep this tab open until it finishes. Cards are upserted
          by id, so re-importing a shard corrects it rather than duplicating it. The same import
          runs headlessly as <span className="font-mono">debate-cards-upload</span>.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            Parquet shards
            <Input
              ref={inputRef}
              type="file"
              multiple
              accept=".parquet"
              disabled={isImporting}
              onChange={(event) => pickFiles(event.target.files)}
            />
          </label>
          <Button onClick={importAll} disabled={shards.length === 0 || isImporting}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {isImporting
              ? "Importing…"
              : shards.length === 0
                ? "Import files"
                : `Import ${shards.length} file${shards.length === 1 ? "" : "s"}`}
          </Button>
          {isImporting && (
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
        </div>

        {shards.length > 0 && (
          <ul className="flex flex-col gap-3" aria-live="polite">
            {shards.map((shard, index) => {
              const percent = cardImportPercent(shard.progress);
              return (
                <li
                  key={`${shard.file.name}-${index}`}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">{shard.file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {shard.status === "done" && (
                        <CheckCircle2 className="inline h-3.5 w-3.5 text-green-600" aria-hidden="true" />
                      )}
                      {shard.status === "failed" && (
                        <AlertTriangle className="inline h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                      )}{" "}
                      {shard.status}
                    </span>
                  </div>

                  <div
                    className="h-1.5 w-full overflow-hidden rounded bg-muted"
                    role="progressbar"
                    aria-valuenow={percent ?? undefined}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${shard.file.name} import progress`}
                  >
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${percent ?? (shard.status === "done" ? 100 : 0)}%` }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {shard.summary ??
                      `${shard.progress.imported.toLocaleString()} imported · ${shard.progress.read.toLocaleString()} rows read${
                        percent === null ? "" : ` · ${percent}%`
                      }`}
                  </p>

                  {shard.error && <p className="text-xs text-destructive">{shard.error}</p>}

                  {shard.failures.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer opacity-80">
                        {shard.failures.length} skipped row{shard.failures.length === 1 ? "" : "s"}
                      </summary>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {shard.failures.slice(0, 20).map((failure) => (
                          <li key={`${failure.rowIndex}-${failure.code}`} className="opacity-80">
                            row {failure.rowIndex}: {failure.code} — {failure.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium">
            Library:{" "}
            {stats
              ? `${stats.cards.toLocaleString()} cards from ${stats.files.length.toLocaleString()} file${stats.files.length === 1 ? "" : "s"}, ${stats.caselists.toLocaleString()} caselists`
              : statsError
                ? `unavailable — ${statsError}`
                : "loading…"}
          </p>

          {stats && stats.files.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {stats.files.slice(0, 20).map((file) => (
                <li key={file.fileName} className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono">{file.fileName}</span>
                  <span>
                    {file.rowsImported.toLocaleString()} cards
                    {file.rowsSkipped > 0 ? `, ${file.rowsSkipped.toLocaleString()} skipped` : ""} ·{" "}
                    {formatImportedAt(file.lastImportedAt)}
                    {file.lastImportedBy ? ` · ${file.lastImportedBy}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
