"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";
import { Label } from "../../../ui/primitives/label";
import { type ConnectionTest, type EnvStatus, type TokenStatus, api, when } from "./api";

function TokenBadge({ status }: { status: TokenStatus }) {
  if (status.unreadable) return <Badge variant="destructive">Unreadable: enter it again</Badge>;
  if (status.set) return <Badge variant="secondary">Set{status.endsIn ? ` · ends in ${status.endsIn}` : ""}</Badge>;
  return <Badge variant="outline">Not set</Badge>;
}

function TestResult({ result }: { result: ConnectionTest }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm" data-testid={`test-${result.target}`}>
      <p className={result.ok ? "font-medium" : "text-destructive font-medium"}>{result.ok ? "Connection works." : "Connection problems found."}</p>
      <ul className="flex flex-col gap-1">
        {result.checks.map((check) => (
          <li key={check.name}>
            <span aria-hidden>{check.ok === true ? "✓" : check.ok === false ? "✗" : "•"}</span> <span className="font-medium">{check.name}</span>
            <span className="text-muted-foreground"> — {check.detail}</span>
          </li>
        ))}
      </ul>
      {result.missing.length > 0 && (
        <div role="alert">
          <p className="text-destructive font-medium">Missing permissions</p>
          <ul className="list-disc pl-5">
            {result.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <details>
        <summary className="text-muted-foreground cursor-pointer">Permissions this token needs</summary>
        <ul className="list-disc pl-5">
          {result.required.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

type Side = "cloudflare" | "github";

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} autoComplete="off" {...props} />
    </div>
  );
}

/**
 * The Cloudflare and GitHub credentials. Tokens go to the server and are never
 * shown again: the panel only knows whether each is set and its last four characters.
 */
export function CredentialsSection({ status, onStatus }: { status: EnvStatus; onStatus: (next: EnvStatus) => void }) {
  const [form, setForm] = useState({
    cloudflareToken: "",
    accountId: status.cloudflare.accountId,
    script: status.cloudflare.script,
    githubToken: "",
    owner: status.github.owner,
    repo: status.github.repo,
    branch: status.github.branch,
    workflow: status.github.workflow,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Partial<Record<Side, { kind: "ok" | "error"; text: string }>>>({});
  const [tests, setTests] = useState<Partial<Record<Side, ConnectionTest>>>({});
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const run = async (side: Side, action: "save" | "test" | "remove") => {
    setBusy(`${side}-${action}`);
    setMessage((m) => ({ ...m, [side]: undefined }));
    try {
      if (action === "test") {
        setTests((t) => ({ ...t, [side]: undefined }));
        const result = await api<ConnectionTest>("/test", { method: "POST", body: JSON.stringify({ target: side }) });
        setTests((t) => ({ ...t, [side]: result }));
      } else if (action === "remove") {
        const data = await api<{ status: EnvStatus }>(`/credentials?which=${side}`, { method: "DELETE" });
        onStatus(data.status);
        setMessage((m) => ({ ...m, [side]: { kind: "ok", text: "Removed." } }));
      } else {
        const body =
          side === "cloudflare"
            ? { cloudflareToken: form.cloudflareToken, accountId: form.accountId, script: form.script }
            : { githubToken: form.githubToken, owner: form.owner, repo: form.repo, branch: form.branch, workflow: form.workflow };
        const data = await api<{ status: EnvStatus }>("/credentials", { method: "POST", body: JSON.stringify(body) });
        onStatus(data.status);
        setForm((f) => (side === "cloudflare" ? { ...f, cloudflareToken: "" } : { ...f, githubToken: "" }));
        setMessage((m) => ({ ...m, [side]: { kind: "ok", text: "Saved." } }));
      }
    } catch (error) {
      setMessage((m) => ({ ...m, [side]: { kind: "error", text: (error as Error).message } }));
    } finally {
      setBusy(null);
    }
  };

  const submit = (side: Side) => (event: FormEvent) => {
    event.preventDefault();
    void run(side, "save");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card id="env-cloudflare">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Cloudflare</CardTitle>
            <TokenBadge status={status.cloudflare} />
          </div>
          <CardDescription>
            An API token with Account · Workers Scripts · Edit, the account ID and the Worker's name. Encrypted at rest, never shown again.
            {status.cloudflare.updatedAt ? ` Updated ${when(status.cloudflare.updatedAt)}${status.cloudflare.updatedBy ? ` by ${status.cloudflare.updatedBy}` : ""}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <form className="flex flex-col gap-3" onSubmit={submit("cloudflare")} autoComplete="off">
            <Field id="cf-token" label="API token" type="password" value={form.cloudflareToken} onChange={set("cloudflareToken")} placeholder={status.cloudflare.set ? "Saved — enter a new one to replace it" : ""} autoComplete="new-password" />
            <Field id="cf-account" label="Account ID" value={form.accountId} onChange={set("accountId")} />
            <Field id="cf-script" label="Worker script name" value={form.script} onChange={set("script")} />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== null}>
                {busy === "cloudflare-save" ? "Saving…" : "Save Cloudflare"}
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null || !status.cloudflare.set} onClick={() => void run("cloudflare", "test")}>
                {busy === "cloudflare-test" ? "Testing…" : "Test connection"}
              </Button>
              {status.cloudflare.set && (
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("cloudflare", "remove")}>
                  Remove
                </Button>
              )}
            </div>
          </form>
          {message.cloudflare && <p className={message.cloudflare.kind === "error" ? "text-destructive" : "text-muted-foreground"} role={message.cloudflare.kind === "error" ? "alert" : undefined}>{message.cloudflare.text}</p>}
          {tests.cloudflare && <TestResult result={tests.cloudflare} />}
        </CardContent>
      </Card>

      <Card id="env-github">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>GitHub</CardTitle>
            <TokenBadge status={status.github} />
          </div>
          <CardDescription>
            A token that can run the deploy workflow on the repository below. Used to rebuild, to read wrangler.jsonc and to keep NEXT_PUBLIC_* build variables in step.
            {status.github.updatedAt ? ` Updated ${when(status.github.updatedAt)}${status.github.updatedBy ? ` by ${status.github.updatedBy}` : ""}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <form className="flex flex-col gap-3" onSubmit={submit("github")} autoComplete="off">
            <Field id="gh-token" label="Token" type="password" value={form.githubToken} onChange={set("githubToken")} placeholder={status.github.set ? "Saved — enter a new one to replace it" : ""} autoComplete="new-password" />
            <div className="grid grid-cols-2 gap-3">
              <Field id="gh-owner" label="Repository owner" value={form.owner} onChange={set("owner")} />
              <Field id="gh-repo" label="Repository name" value={form.repo} onChange={set("repo")} />
              <Field id="gh-branch" label="Branch" value={form.branch} onChange={set("branch")} />
              <Field id="gh-workflow" label="Deploy workflow file" value={form.workflow} onChange={set("workflow")} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== null}>
                {busy === "github-save" ? "Saving…" : "Save GitHub"}
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null || !status.github.set} onClick={() => void run("github", "test")}>
                {busy === "github-test" ? "Testing…" : "Test connection"}
              </Button>
              {status.github.set && (
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run("github", "remove")}>
                  Remove
                </Button>
              )}
            </div>
          </form>
          {message.github && <p className={message.github.kind === "error" ? "text-destructive" : "text-muted-foreground"} role={message.github.kind === "error" ? "alert" : undefined}>{message.github.text}</p>}
          {tests.github && <TestResult result={tests.github} />}
        </CardContent>
      </Card>
    </div>
  );
}
