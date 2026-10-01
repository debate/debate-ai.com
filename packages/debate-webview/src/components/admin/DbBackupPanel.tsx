"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../lib/ui/primitives/button";
import { Badge } from "../../lib/ui/primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../lib/ui/primitives/card";

interface BackupGroupInfo {
  key: string;
  label: string;
  tables: Array<{ name: string; scrubbed: string[] }>;
}

interface StoredBackup {
  key: string;
  fileName: string;
  size: number;
  uploaded: string;
  trigger: "manual" | "weekly" | "unknown";
  groups: string | null;
  url: string;
  sevenZip: { key: string; size: number; url: string } | null;
}

interface BackupStatus {
  groups: BackupGroupInfo[];
  r2Configured: boolean;
  kvConfigured: boolean;
  sevenZipMaxBytes: number;
  weeklyBackupsKept: number;
  backups: StoredBackup[];
  listError: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * SQL backups of the content tables — videos, debate cards and the
 * sync/import history, with account data left out and "who did this" columns
 * blanked (apps/debate-ai.com/lib/admin/db-backup.ts). Download a dump
 * directly as a zip (or the plain `.sql` beside it), or save one to the private
 * R2 bucket and get a link to it; a `.sql.7z` copy of each saved dump goes to
 * the DB_BACKUPS_KV namespace. A weekly cron saves one to R2 on its own.
 */
export function DbBackupPanel() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; url?: string; sevenZipUrl?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/db-backup");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load backups");
      setStatus(body);
      setSelected((current) =>
        current.size > 0 ? current : new Set((body as BackupStatus).groups.map((group) => group.key)),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = [...selected];
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/db-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Backup failed");
      const missing: string[] = body.stats?.missing ?? [];
      setNotice({
        text:
          `Saved ${body.backup.fileName} (${formatBytes(body.backup.size)}, ${body.stats.totalRows.toLocaleString()} rows)` +
          (missing.length ? ` — tables not in this database: ${missing.join(", ")}` : "") +
          (body.backup.sevenZip
            ? `; 7z copy in KV (${formatBytes(body.backup.sevenZip.size)})`
            : body.sevenZipSkipped
              ? `; no 7z copy: ${body.sevenZipSkipped}`
              : ""),
        url: body.backup.url,
        sevenZipUrl: body.backup.sevenZip?.url,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (backup: StoredBackup) => {
    if (!window.confirm(`Delete ${backup.fileName} from R2${backup.sevenZip ? " and its .7z copy from KV" : ""}? This cannot be undone.`)) return;
    setPending(backup.key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(backup.url, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Delete failed");
      setNotice({ text: `Deleted ${backup.fileName}.` });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  };

  const downloadHref = `/api/admin/db-backup/download?groups=${encodeURIComponent(groups.join(","))}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>SQL backup</CardTitle>
        <CardDescription>
          A SQLite dump of the shared content tables — no accounts, sessions or anything a user
          saved. Columns that name a person (reporter, editor or contributor) are written as blank.
          The download is a zip the worker builds on the fly, holding one <code>.sql</code> file.
          Restore by unzipping it first, then <code>sqlite3 local.db &lt; backup.sql</code> or{" "}
          <code>wrangler d1 execute debate-ai-db --remote --file=backup.sql</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {status?.groups.map((group) => (
            <label
              key={group.key}
              className="flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm"
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={selected.has(group.key)}
                  onChange={() => toggle(group.key)}
                />
                {group.label}
              </span>
              <span className="text-muted-foreground text-xs">
                {group.tables
                  .map((table) =>
                    table.scrubbed.length ? `${table.name} (no ${table.scrubbed.join(", ")})` : table.name,
                  )
                  .join(", ")}
              </span>
            </label>
          ))}
          {!status && !error && <p className="text-muted-foreground text-sm">Loading…</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <a
              href={groups.length ? downloadHref : undefined}
              aria-disabled={groups.length === 0}
              className={groups.length ? undefined : "pointer-events-none opacity-50"}
              download
            >
              Download .zip
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={groups.length ? `${downloadHref}&format=sql` : undefined}
              aria-disabled={groups.length === 0}
              className={groups.length ? undefined : "pointer-events-none opacity-50"}
              download
            >
              Download .sql
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || groups.length === 0 || !status?.r2Configured}
          >
            {isSaving ? "Saving to R2…" : "Save to R2"}
          </Button>
          {status && !status.r2Configured && (
            <span className="text-muted-foreground text-xs">
              R2 is not bound — add the <code>DB_BACKUPS</code> bucket in wrangler.jsonc.
            </span>
          )}
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {notice && (
          <p className="text-muted-foreground text-sm">
            {notice.text}
            {notice.url && (
              <>
                {" — "}
                <a className="underline" href={notice.url}>
                  download link
                </a>
              </>
            )}
            {notice.sevenZipUrl && (
              <>
                {" · "}
                <a className="underline" href={notice.sevenZipUrl}>
                  .7z
                </a>
              </>
            )}
          </p>
        )}

        {status?.r2Configured && (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              Stored in R2. A weekly backup runs every Sunday at 07:00 UTC; the newest{" "}
              {status.weeklyBackupsKept} weekly backups are kept. Links need an admin sign-in.{" "}
              {status.kvConfigured
                ? `Each also gets a .7z copy in KV when it compresses to ${formatBytes(status.sevenZipMaxBytes)} or less.`
                : "Bind a KV namespace as DB_BACKUPS_KV to keep .7z copies too."}
            </p>
            {status.listError && <p className="text-destructive text-sm">{status.listError}</p>}
            <ul className="flex flex-col divide-y rounded-md border text-sm">
              {status.backups.map((backup) => (
                <li key={backup.key} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 flex-col">
                    <a className="truncate underline" href={backup.url}>
                      {backup.fileName}
                    </a>
                    <span className="text-muted-foreground text-xs">
                      {new Date(backup.uploaded).toLocaleString()} · {formatBytes(backup.size)}
                      {backup.groups ? ` · ${backup.groups.replace(/,/g, ", ")}` : ""}
                      {backup.sevenZip && (
                        <>
                          {" · "}
                          <a className="underline" href={backup.sevenZip.url}>
                            .7z
                          </a>{" "}
                          ({formatBytes(backup.sevenZip.size)}, KV)
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={backup.trigger === "weekly" ? "secondary" : "outline"} className="font-normal">
                      {backup.trigger}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard?.writeText(new URL(backup.url, window.location.origin).href)}
                    >
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(backup)}
                      disabled={pending === backup.key}
                    >
                      {pending === backup.key ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </li>
              ))}
              {status.backups.length === 0 && (
                <li className="text-muted-foreground px-3 py-2">No backups in R2 yet.</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
