"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";

/** A synced page, as `/api/admin/caselist-team-sync` lists it. */
interface SyncedTeamPage {
  id: string;
  caselist: string;
  caselistLabel: string;
  year: number;
  school: string;
  team: string;
  teamDisplayName: string;
  debaters: string[];
  pageUrl: string;
  rounds: number;
  cites: number;
  files: number;
  storedFiles: number;
  syncedAt: number;
}

interface FileProgress {
  done: number;
  total: number;
  failed: { path: string; error: string }[];
  current: string | null;
  waiting: boolean;
}

/** The rankings datasets a team can be found by, with the caselist format each maps to. */
const FORMATS = [
  { id: "cpd", label: "College Policy (NDT/CEDA)" },
  { id: "hscx", label: "HS Policy" },
  { id: "hsld", label: "HS LD" },
  { id: "hspf", label: "HS PF" },
] as const;

/** openCaselist allows ten downloads a minute per account. */
const FILE_GAP_MS = 6500;
const RATE_LIMIT_WAIT_MS = 61_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fileName = (path: string) => path.split("/").pop() ?? path;

/**
 * "Sync team from openCaselist": finds one team (by school and debater names,
 * or a pasted openCaselist page URL) in this season's caselist and every
 * earlier season's, saves its rounds, round reports and wiki cites, then
 * fetches each listed open-source `.docx` — paced under openCaselist's
 * download limit — and stores its text and original file in R2 with the
 * metadata in D1. The team profile's Caselist section then shows every
 * season from our own database. Only the team asked for is scraped.
 */
export function CaselistTeamSyncPanel() {
  const [dataset, setDataset] = useState<string>("cpd");
  const [school, setSchool] = useState("");
  const [team, setTeam] = useState("");
  const [url, setUrl] = useState("");
  const [pages, setPages] = useState<SyncedTeamPage[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<SyncedTeamPage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const stopRef = useRef(false);

  const loadPages = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/caselist-team-sync");
      if (!response.ok) return;
      const data = (await response.json()) as { configured: boolean; pages: SyncedTeamPage[] };
      setConfigured(data.configured);
      setPages(data.pages);
    } catch {
      // The list is a convenience; the sync still works without it.
    }
  }, []);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  const post = async (body: Record<string, string>) => {
    const response = await fetch("/api/admin/caselist-team-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, ok: response.ok, data };
  };

  const syncFiles = async (paths: string[]) => {
    const state: FileProgress = { done: 0, total: paths.length, failed: [], current: null, waiting: false };
    setProgress({ ...state });
    for (const [index, path] of paths.entries()) {
      if (stopRef.current) break;
      if (index > 0) await sleep(FILE_GAP_MS);
      state.current = path;
      setProgress({ ...state });
      let result = await post({ action: "file", path });
      if (result.status === 429 && !stopRef.current) {
        state.waiting = true;
        setProgress({ ...state });
        await sleep(RATE_LIMIT_WAIT_MS);
        state.waiting = false;
        result = await post({ action: "file", path });
      }
      if (!result.ok) state.failed.push({ path, error: String(result.data.error ?? `HTTP ${result.status}`) });
      state.done += 1;
      setProgress({ ...state });
    }
    state.current = null;
    setProgress({ ...state });
  };

  const run = async (query: Record<string, string>) => {
    setBusy(true);
    setError(null);
    setProgress(null);
    setLastSync(null);
    stopRef.current = false;
    try {
      const result = await post({ action: "pages", ...query });
      if (!result.ok) throw new Error(String(result.data.error ?? `HTTP ${result.status}`));
      const found = (result.data.pages ?? []) as SyncedTeamPage[];
      setLastSync(found);
      if (found.length === 0) {
        setError("No matching team page on openCaselist for that school and team.");
        return;
      }
      await syncFiles((result.data.pendingFiles ?? []) as string[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      void loadPages();
    }
  };

  const canSearch = url.trim() !== "" || (school.trim() !== "" && team.trim() !== "");

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Sync team from openCaselist</CardTitle>
        <CardDescription>
          Finds one team on openCaselist — this season and every earlier season — and saves its rounds, round
          reports, cites and open-source .docx files. Files are stored in R2 (text and original), their details
          in the database, and the team page&apos;s Caselist section shows every season. Downloads are paced
          at under ten a minute, openCaselist&apos;s limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {configured === false && (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
            openCaselist is not configured on the server. Set the <code>OPENCASELIST_API_KEY</code> secret (a
            caselist_token cookie from a signed-in openCaselist session), or <code>CASELIST_USERNAME</code> and{" "}
            <code>CASELIST_PASSWORD</code> (a Tabroom login).
          </p>
        )}
        <form
          className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSearch && !busy) void run(url.trim() ? { url: url.trim() } : { dataset, school: school.trim(), team: team.trim() });
          }}
        >
          <select
            aria-label="Format"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={dataset}
            onChange={(event) => setDataset(event.target.value)}
          >
            {FORMATS.map((format) => (
              <option key={format.id} value={format.id}>
                {format.label}
              </option>
            ))}
          </select>
          <Input aria-label="School" placeholder="School (e.g. Emory)" value={school} onChange={(event) => setSchool(event.target.value)} />
          <Input
            aria-label="Team"
            placeholder="Debaters (e.g. Gannon & Young)"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
          />
          <Button type="submit" disabled={!canSearch || busy}>
            {busy ? "Syncing…" : "Find & sync"}
          </Button>
          <Input
            aria-label="openCaselist page URL"
            className="sm:col-span-3"
            placeholder="…or paste a team page URL: https://opencaselist.com/ndtceda26/Emory/GaYo"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          {busy && (
            <Button type="button" variant="outline" onClick={() => (stopRef.current = true)}>
              Stop
            </Button>
          )}
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {lastSync && lastSync.length > 0 && (
          <p className="text-sm">
            Found {lastSync.length} season{lastSync.length === 1 ? "" : "s"}:{" "}
            {lastSync.map((page) => `${page.caselistLabel} (${page.rounds} rounds, ${page.cites} cites)`).join(" · ")}
          </p>
        )}

        {progress && (
          <div className="text-sm" aria-live="polite">
            <p>
              Files: {progress.done} / {progress.total} stored
              {progress.failed.length > 0 && `, ${progress.failed.length} failed`}
              {progress.current && ` — ${progress.waiting ? "waiting out openCaselist's limit before" : "fetching"} ${fileName(progress.current)}`}
            </p>
            {progress.failed.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {progress.failed.map((failure) => (
                  <li key={failure.path}>
                    {fileName(failure.path)}: {failure.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pages.length > 0 && (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">Team page</th>
                  <th className="px-2 py-1.5 font-medium">Season</th>
                  <th className="px-2 py-1.5 font-medium">Rounds</th>
                  <th className="px-2 py-1.5 font-medium">Cites</th>
                  <th className="px-2 py-1.5 font-medium">Files stored</th>
                  <th className="px-2 py-1.5 font-medium">Synced</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id} className="border-t">
                    <td className="px-2 py-1.5">
                      <a href={page.pageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {page.school} {page.team}
                      </a>
                      {page.debaters.length > 0 && (
                        <span className="block text-xs text-muted-foreground">{page.debaters.join(" & ")}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{page.caselistLabel}</td>
                    <td className="px-2 py-1.5">{page.rounds}</td>
                    <td className="px-2 py-1.5">{page.cites}</td>
                    <td className="px-2 py-1.5">
                      {page.storedFiles} / {page.files}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {new Date(page.syncedAt * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1.5">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run({ url: page.pageUrl })}>
                        Resync
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
