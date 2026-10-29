"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, RefreshCw, Search, Square } from "lucide-react";
import { Button } from "@debate-ai/ui/primitives/button";
import { Badge } from "@debate-ai/ui/primitives/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@debate-ai/ui/primitives/card";
import type { ParadigmSyncBatch, ParadigmSyncStatus } from "@debate-ai/tournaments/judge-paradigms/types";

const API = "/api/admin/judge-paradigms";

/** Stops a run after this many batches in a row that saved nothing, so a dead session can't spin forever. */
const MAX_IDLE_BATCHES = 3;

/**
 * Syncs every judge's Tabroom paradigm and judging record into the site's
 * paradigm cache (apps/debate-web/lib/judge-paradigms/queries.ts), and reviews
 * accounts claiming to be a Tabroom judge.
 *
 * "Discover" walks Tabroom's paradigm search — every judge with a current
 * paradigm — a page at a time and fetches the ones not cached yet; "Refresh"
 * re-fetches cached judges older than a week. Each click runs batches
 * back to back until there's nothing left, a batch fails, or Stop is pressed;
 * the server remembers where discovery got to, so a stopped run resumes.
 */
export function JudgeParadigmSyncPanel() {
  const [status, setStatus] = useState<ParadigmSyncStatus | null>(null);
  const [running, setRunning] = useState<"discover" | "refresh" | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(API);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to load paradigm sync status");
      setStatus(body as ParadigmSyncStatus);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (mode: "discover" | "refresh") => {
    stop.current = false;
    setRunning(mode);
    setError(null);
    setLog([]);
    let idle = 0;
    try {
      while (!stop.current) {
        const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
        const batch = (await res.json()) as ParadigmSyncBatch & { error?: string };
        if (!res.ok) throw new Error(batch?.error || "Sync batch failed");
        const line =
          mode === "discover"
            ? `Fetched ${batch.fetched}, saved ${batch.saved}, failed ${batch.failed} — ${batch.nextOffset === null ? "walk complete" : `next offset ${batch.nextOffset}`}`
            : `Fetched ${batch.fetched}, saved ${batch.saved}, failed ${batch.failed} — ${batch.remaining} stale left`;
        setLog((current) => [line, ...current].slice(0, 30));
        if (batch.error && batch.saved === 0) throw new Error(batch.error);
        idle = batch.saved === 0 ? idle + 1 : 0;
        const finished = mode === "discover" ? batch.nextOffset === null : batch.fetched === 0 || batch.remaining === 0;
        if (finished || idle >= MAX_IDLE_BATCHES) break;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(null);
      load();
    }
  };

  const decide = async (userId: string, verified: boolean) => {
    const res = await fetch(API, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, verified }) });
    if (!res.ok) setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error || "Could not update the claim");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="size-5" aria-hidden /> Judge paradigms
        </CardTitle>
        <CardDescription>
          Sync every judge&apos;s paradigm and voting record from Tabroom, so judges open instantly in tournament pairings. Tabroom only serves
          paradigms to a signed-in account: set <code>TABROOM_SESSION_TOKEN</code> to the site account&apos;s <code>TabroomToken</code> cookie.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status ? (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={status.credentialsConfigured ? "secondary" : "destructive"}>
              {status.credentialsConfigured ? "Tabroom session set" : "No Tabroom session"}
            </Badge>
            <Badge variant="outline">{status.cached.toLocaleString()} judges cached</Badge>
            <Badge variant="outline">{status.withParadigm.toLocaleString()} with a paradigm</Badge>
            <Badge variant="outline">{status.stale.toLocaleString()} older than a week</Badge>
            {status.failed ? <Badge variant="outline">{status.failed.toLocaleString()} failed</Badge> : null}
            <Badge variant="outline">
              Discovery {status.discoveryDone ? "complete" : `at offset ${status.discoveryOffset.toLocaleString()}`}
            </Badge>
          </div>
        ) : null}
        {status?.lastRunAt ? (
          <p className="text-xs text-muted-foreground">
            Last run {new Date(status.lastRunAt).toLocaleString()}
            {status.lastError ? ` — ${status.lastError}` : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run("discover")} disabled={running !== null || !status?.credentialsConfigured}>
            {running === "discover" ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
            Discover &amp; sync all paradigms
          </Button>
          <Button variant="outline" onClick={() => run("refresh")} disabled={running !== null || !status?.credentialsConfigured}>
            {running === "refresh" ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            Refresh stale
          </Button>
          {running ? (
            <Button variant="ghost" onClick={() => (stop.current = true)}>
              <Square aria-hidden /> Stop
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {log.length ? (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}

        {status?.claims.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Accounts claiming a Tabroom judge</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Tabroom judge</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {status.claims.map((claim) => (
                    <tr key={claim.userId} className="border-t">
                      <td className="px-3 py-2">
                        {claim.userName}
                        <div className="text-xs text-muted-foreground">{claim.userEmail}</div>
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=${claim.tabroomPersonId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2"
                        >
                          {claim.tabroomName || `#${claim.tabroomPersonId}`}
                        </a>
                      </td>
                      <td className="px-3 py-2">{claim.verified ? "Verified" : "Waiting"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant={claim.verified ? "ghost" : "outline"} onClick={() => decide(claim.userId, !claim.verified)}>
                          {claim.verified ? "Revoke" : "Verify"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
