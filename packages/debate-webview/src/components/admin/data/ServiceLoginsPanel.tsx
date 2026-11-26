"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Input } from "../../../ui/primitives/input";
import { Label } from "../../../ui/primitives/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";

/** One service's status from `GET /api/admin/service-logins`: never the password or token. */
export interface ServiceLoginStatus {
  service: "tabroom" | "opencaselist";
  label: string;
  configured: boolean;
  username: string | null;
  connected: boolean;
  lastLoginAt: number | null;
  expiresAt: number | null;
  lastError: string | null;
  lastFailureAt: number | null;
  retryAt: number | null;
  envFallback: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
}

const ENDPOINT = "/api/admin/service-logins";

const DESCRIPTIONS: Record<ServiceLoginStatus["service"], string> = {
  tabroom:
    "Signs the site's Tabroom requests in: round results for the video lookups and bulk fills, paradigms and the Tabroom proxy. Without it the TABROOM_API_KEY secret is used.",
  opencaselist:
    "Signs the site's openCaselist requests in (a Tabroom account): team pages, open-source files and archive syncs. Without it OPENCASELIST_API_KEY (or CASELIST_USERNAME + CASELIST_PASSWORD) is used.",
};

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : "—");

function StatusBadge({ status }: { status: ServiceLoginStatus }) {
  if (status.configured && status.connected) return <Badge variant="secondary">Connected</Badge>;
  if (status.configured && status.lastError) return <Badge variant="destructive">Login failing</Badge>;
  if (status.configured) return <Badge variant="outline">Not signed in yet</Badge>;
  if (status.envFallback) return <Badge variant="outline">Using env secret</Badge>;
  return <Badge variant="destructive">Not set up</Badge>;
}

function ServiceLoginCard({ status, onChange }: { status: ServiceLoginStatus; onChange: (next: ServiceLoginStatus) => void }) {
  const [username, setUsername] = useState(status.username ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"save" | "signin" | "remove" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const send = useCallback(
    async (kind: "save" | "signin" | "remove") => {
      setBusy(kind);
      setMessage(null);
      try {
        const res =
          kind === "remove"
            ? await fetch(`${ENDPOINT}?service=${status.service}`, { method: "DELETE", credentials: "include" })
            : await fetch(ENDPOINT, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  kind === "save" ? { service: status.service, username, password } : { service: status.service, action: "signin" },
                ),
              });
        const data = (await res.json().catch(() => ({}))) as { error?: string | null; status?: ServiceLoginStatus };
        if (data.status) onChange(data.status);
        if (kind === "save") setPassword("");
        if (kind === "remove") setUsername("");
        if (!res.ok) throw new Error(data.error || "The request failed.");
        setMessage({ kind: "ok", text: kind === "remove" ? "Removed." : `Signed in to ${status.label}.` });
      } catch (error) {
        setMessage({ kind: "error", text: (error as Error).message });
      } finally {
        setBusy(null);
      }
    },
    [status.service, status.label, username, password, onChange],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send("save");
  };

  return (
    <Card id={`service-login-${status.service}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{status.label}</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>{DESCRIPTIONS[status.service]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Account</dt>
          <dd>{status.username ?? "—"}</dd>
          <dt className="text-muted-foreground">Last login</dt>
          <dd>{when(status.lastLoginAt)}</dd>
          <dt className="text-muted-foreground">Expires</dt>
          <dd>{status.expiresAt ? when(status.expiresAt) : status.connected ? `When ${status.label} rejects it` : "—"}</dd>
          {status.retryAt && (
            <>
              <dt className="text-muted-foreground">Next automatic login</dt>
              <dd>{when(status.retryAt)}</dd>
            </>
          )}
        </dl>
        {status.lastError && (
          <p className="text-destructive" role="alert">
            Last login failed{status.lastFailureAt ? ` (${when(status.lastFailureAt)})` : ""}: {status.lastError}
          </p>
        )}
        <form className="flex flex-col gap-3 sm:max-w-md" onSubmit={submit} autoComplete="off">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${status.service}-username`}>Username or email</Label>
            <Input
              id={`${status.service}-username`}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${status.service}-password`}>Password</Label>
            <Input
              id={`${status.service}-password`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={status.configured ? "Saved — enter a new one to replace it" : ""}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy !== null || !username.trim() || !password}>
              {busy === "save" ? "Signing in…" : "Save and sign in"}
            </Button>
            {status.configured && (
              <>
                <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void send("signin")}>
                  {busy === "signin" ? "Signing in…" : "Sign in again"}
                </Button>
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void send("remove")}>
                  {busy === "remove" ? "Removing…" : "Remove"}
                </Button>
              </>
            )}
          </div>
        </form>
        {message && <p className={message.kind === "error" ? "text-destructive" : "text-muted-foreground"}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Admin → Service logins: the Tabroom and openCaselist accounts the site
 * signs in as (`/api/admin/service-logins`). The server logs in on save,
 * stores the session encrypted and logs in again only when the session is
 * rejected; this panel only ever sees each login's status.
 */
export function ServiceLoginsPanel() {
  const [services, setServices] = useState<ServiceLoginStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(ENDPOINT, { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { services?: ServiceLoginStatus[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Could not load the service logins.");
        if (!cancelled) setServices(data.services ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((next: ServiceLoginStatus) => {
    setServices((current) => (current ?? []).map((status) => (status.service === next.service ? next : status)));
  }, []);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!services) return <p className="text-muted-foreground text-sm">Loading…</p>;
  return (
    <>
      {services.map((status) => (
        <ServiceLoginCard key={status.service} status={status} onChange={update} />
      ))}
    </>
  );
}
