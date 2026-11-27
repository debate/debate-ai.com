"use client";

import { useEffect, useState } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { type AuditEntry, type RebuildResult, type WorkflowRun, api, when } from "./api";

export const POLL_MS = 5000;

function runLabel(run: WorkflowRun) {
  if (run.status === "completed") return run.conclusion === "success" ? "Deployed" : `Finished: ${run.conclusion ?? "unknown"}`;
  return run.status === "in_progress" ? "Building and deploying…" : "Queued…";
}

/** The deploy run triggered from this panel: status polled every few seconds, with a link to it. */
export function BuildSection({ canRebuild, result, onResult }: { canRebuild: boolean; result: RebuildResult | null; onResult: (next: RebuildResult | null) => void }) {
  const [run, setRun] = useState<WorkflowRun | null>(result?.run ?? null);
  const [error, setError] = useState<string | null>(result?.error ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRun(result?.run ?? null);
    setError(result?.error ?? null);
  }, [result]);

  const dispatchedAt = result?.dispatchedAt ?? null;
  const finished = run?.status === "completed";
  useEffect(() => {
    if (!result || result.error || finished) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await api<{ run: WorkflowRun | null }>(run ? `/rebuild?runId=${run.id}` : `/rebuild?since=${dispatchedAt}`);
        if (cancelled) return;
        if (res.run) setRun(res.run);
        if (res.run?.status === "completed") return;
      } catch (caught) {
        if (!cancelled) setError((caught as Error).message);
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, run ? POLL_MS : 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, run?.id, finished]);

  const rebuild = async () => {
    setBusy(true);
    setError(null);
    try {
      onResult(await api<RebuildResult>("/rebuild", { method: "POST" }));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="env-build">
      <CardHeader>
        <CardTitle>Rebuild</CardTitle>
        <CardDescription>
          Triggers the deploy workflow on the configured branch (GitHub Actions workflow_dispatch). It runs the tests, applies D1 migrations and runs wrangler deploy; variables saved here are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div>
          <Button variant="outline" disabled={!canRebuild || busy} onClick={() => void rebuild()} title={canRebuild ? undefined : "Save the GitHub token first"}>
            {busy ? "Dispatching…" : "Rebuild without changes"}
          </Button>
        </div>
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
        {result?.variables.map((v) => (
          <p key={v.name} className={v.ok ? "text-muted-foreground" : "text-destructive"}>
            {v.name}: {v.ok ? "GitHub Actions variable updated for the build." : `GitHub variable not updated: ${v.error}`}
          </p>
        ))}
        {result && !result.error && (
          <div className="flex flex-wrap items-center gap-2" data-testid="run">
            <Badge variant={run?.status === "completed" && run.conclusion !== "success" ? "destructive" : "secondary"}>{run ? runLabel(run) : "Dispatched, waiting for GitHub to start the run…"}</Badge>
            {run?.url && (
              <a className="underline" href={run.url} target="_blank" rel="noreferrer">
                Open run #{run.id}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AuditSection({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<{ entries: AuditEntry[] }>("/audit")
      .then((res) => !cancelled && setEntries(res.entries))
      .catch((caught: Error) => !cancelled && setError(caught.message));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return (
    <Card id="env-audit">
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Who changed which variable names and when. Values are never recorded.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {error && <p className="text-destructive">{error}</p>}
        {entries && entries.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
        <ul className="flex flex-col gap-1">
          {entries?.map((entry) => (
            <li key={entry.id}>
              <span className="text-muted-foreground">{when(entry.at)}</span> <span className="font-medium">{entry.actor ?? "unknown"}</span> {entry.action}
              {entry.names.length > 0 && <span className="font-mono"> {entry.names.join(", ")}</span>}
              {entry.detail && <span className="text-muted-foreground"> — {entry.detail}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
