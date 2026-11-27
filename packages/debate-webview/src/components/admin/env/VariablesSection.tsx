"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";
import { Label } from "../../../ui/primitives/label";
import { type Change, type DiffEntry, type Plan, type RebuildResult, type VarKind, type VarsResponse, api } from "./api";
import { parseEnvText } from "./parse-env";

const KIND_LABEL: Record<VarKind, string> = { plain_text: "Text", secret_text: "Secret", json: "JSON" };
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

const selectClass = "border-input bg-background h-9 rounded-md border px-2 text-sm";

function DiffLine({ entry }: { entry: DiffEntry }) {
  const secret = entry.kind === "secret_text" || (entry.action === "delete" && entry.previousKind === "secret_text");
  const symbol = entry.action === "add" ? "+" : entry.action === "delete" ? "−" : entry.action === "update" ? "~" : "=";
  return (
    <li className="flex flex-col gap-0.5" data-testid={`diff-${entry.name}`}>
      <span className="font-mono">
        <span aria-hidden>{symbol} </span>
        <span className="font-semibold">{entry.name}</span>{" "}
        <span className="text-muted-foreground">
          {entry.action}
          {entry.kind ? ` · ${KIND_LABEL[entry.kind]}` : ""}
          {entry.action === "update" && entry.previousKind && entry.previousKind !== entry.kind ? ` (was ${KIND_LABEL[entry.previousKind]})` : ""}
        </span>
        {entry.protected && <Badge variant="destructive" className="ml-2">protected</Badge>}
      </span>
      {secret ? (
        <span className="text-muted-foreground pl-4">value hidden</span>
      ) : entry.action === "delete" ? (
        entry.before !== null && <span className="text-muted-foreground pl-4 font-mono break-all">was {entry.before}</span>
      ) : (
        <span className="pl-4 font-mono break-all">
          {entry.before !== null && entry.action === "update" && <span className="text-muted-foreground line-through">{entry.before} </span>}
          {entry.after}
        </span>
      )}
      {entry.missing && <span className="text-muted-foreground pl-4">Not present on the Worker; nothing to delete.</span>}
      {entry.warnings.map((warning) => (
        <span key={warning} className="text-destructive pl-4" role="alert">
          {warning}
        </span>
      ))}
    </li>
  );
}

/**
 * The Worker's variables and secrets with staged edits. Nothing reaches
 * Cloudflare until "Review changes" shows the diff and the admin applies it.
 */
export function VariablesSection({
  enabled,
  canRebuild,
  onRebuild,
  onApplied,
}: {
  enabled: boolean;
  canRebuild: boolean;
  onRebuild: (result: RebuildResult) => void;
  onApplied: () => void;
}) {
  const [data, setData] = useState<VarsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staged, setStaged] = useState<Record<string, Change>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmProtected, setConfirmProtected] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draft, setDraft] = useState({ name: "", kind: "plain_text" as VarKind, value: "" });
  const [bulk, setBulk] = useState({ text: "", secret: false });

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api<VarsResponse>("/vars"));
    } catch (caught) {
      setData(null);
      setError((caught as Error).message);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
    else setData(null);
  }, [enabled, load]);

  const stagedList = useMemo(() => Object.values(staged), [staged]);
  const current = useMemo(() => new Map((data?.vars ?? []).map((v) => [v.name, v])), [data]);
  const protectedNames = data?.protectedVars ?? {};

  const stage = (change: Change) => {
    setPlan(null);
    setNotice(null);
    setStaged((s) => ({ ...s, [change.name]: change }));
  };
  const unstage = (name: string) => {
    setPlan(null);
    setStaged((s) => {
      const { [name]: _removed, ...rest } = s;
      return rest;
    });
  };

  const addDraft = () => {
    if (!NAME.test(draft.name)) return setNotice(`"${draft.name}" is not a valid name (letters, digits and underscores; no leading digit).`);
    if (draft.kind !== "secret_text" || draft.value) stage({ op: "set", name: draft.name, kind: draft.kind, value: draft.value });
    else return setNotice("A secret needs a value.");
    setDraft({ name: "", kind: "plain_text", value: "" });
  };

  const stageBulk = () => {
    const { entries, errors } = parseEnvText(bulk.text);
    const next: Record<string, Change> = {};
    for (const entry of entries) {
      const existing = current.get(entry.name);
      const kind: VarKind = bulk.secret ? "secret_text" : existing?.kind === "secret_text" ? "secret_text" : "plain_text";
      next[entry.name] = { op: "set", name: entry.name, kind, value: entry.value };
    }
    setPlan(null);
    setStaged((s) => ({ ...s, ...next }));
    setBulk((b) => ({ ...b, text: "" }));
    setNotice(`Staged ${entries.length} ${entries.length === 1 ? "entry" : "entries"}${errors.length ? `. Skipped: ${errors.join(" ")}` : "."}`);
  };

  const review = async () => {
    setBusy("review");
    setNotice(null);
    try {
      const res = await api<{ plan: Plan }>("/apply", { method: "POST", body: JSON.stringify({ changes: stagedList, dryRun: true }) });
      setPlan(res.plan);
      setConfirmDelete(false);
      setConfirmProtected(false);
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const apply = async (rebuild: boolean) => {
    setBusy(rebuild ? "rebuild" : "apply");
    setNotice(null);
    try {
      const res = await api<{ applied: number; rebuild: RebuildResult | null }>("/apply", {
        method: "POST",
        body: JSON.stringify({ changes: stagedList, confirmDelete, confirmProtected, rebuild }),
      });
      setStaged({});
      setPlan(null);
      setNotice(res.applied === 0 ? "Nothing to change: the Worker already has these values." : `Applied ${res.applied} ${res.applied === 1 ? "change" : "changes"} to the Worker.`);
      if (res.rebuild) onRebuild(res.rebuild);
      onApplied();
      await load();
    } catch (caught) {
      setNotice((caught as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const canApply = plan !== null && (!plan.hasDeletes || confirmDelete) && (!plan.hasProtected || confirmProtected) && busy === null;

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Variables and secrets</CardTitle>
          <CardDescription>Save the Cloudflare token and account ID above to load the Worker's variables.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="env-vars">
      <CardHeader>
        <CardTitle>Variables and secrets{data ? ` · ${data.script}` : ""}</CardTitle>
        <CardDescription>
          Plain-text variables show their value; secrets show only their name. Changes are staged here and sent to Cloudflare only after you review the diff. Other bindings (D1, R2, KV, Durable Objects, AI) are never touched.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}
        {data?.warnings.map((warning) => (
          <p key={warning} className="text-destructive" role="alert">
            {warning}
          </p>
        ))}
        {data?.wranglerError && <p className="text-muted-foreground">Could not read wrangler.jsonc, so config-owned variables are not flagged: {data.wranglerError}</p>}
        {!data && !error && <p className="text-muted-foreground">Loading…</p>}

        {data && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left" aria-label="Worker variables">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Name</th>
                    <th className="py-1 pr-3 font-medium">Type</th>
                    <th className="py-1 pr-3 font-medium">Value</th>
                    <th className="py-1 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.vars.map((v) => {
                    const change = staged[v.name];
                    const deleted = change?.op === "delete";
                    return (
                      <tr key={v.name} className="border-t align-top" data-testid={`row-${v.name}`}>
                        <td className="py-1.5 pr-3 font-mono">
                          <span className={deleted ? "line-through" : undefined}>{v.name}</span>
                          {v.protected && <Badge variant="destructive" className="ml-2">protected</Badge>}
                          {v.inWrangler && <Badge variant="outline" className="ml-2" title="Defined in wrangler.jsonc vars: a deploy overwrites changes made here">in wrangler.jsonc</Badge>}
                        </td>
                        <td className="py-1.5 pr-3">{KIND_LABEL[v.kind]}</td>
                        <td className="py-1.5 pr-3 font-mono break-all">
                          {editing === v.name ? (
                            <Input aria-label={`New value for ${v.name}`} type={v.kind === "secret_text" ? "password" : "text"} value={editValue} onChange={(e) => setEditValue(e.target.value)} autoComplete="off" />
                          ) : v.kind === "secret_text" ? (
                            <span className="text-muted-foreground">•••••• hidden</span>
                          ) : (
                            v.value
                          )}
                          {change?.op === "set" && editing !== v.name && (
                            <span className="text-primary block">→ {change.kind === "secret_text" ? "new secret value (hidden)" : change.value}</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap">
                          {editing === v.name ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (v.kind !== "secret_text" || editValue) stage({ op: "set", name: v.name, kind: v.kind, value: editValue });
                                  setEditing(null);
                                }}
                              >
                                Stage
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : change ? (
                            <Button size="sm" variant="ghost" aria-label={`Undo ${v.name}`} onClick={() => unstage(v.name)}>
                              Undo
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`Edit ${v.name}`}
                                onClick={() => {
                                  setEditing(v.name);
                                  setEditValue(v.kind === "secret_text" ? "" : (v.value ?? ""));
                                }}
                              >
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" aria-label={`Delete ${v.name}`} onClick={() => stage({ op: "delete", name: v.name })}>
                                Delete
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {data.vars.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground py-2">
                        This Worker has no variables or secrets yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data.bindings.length > 0 && (
              <p className="text-muted-foreground">
                Other bindings, managed in wrangler.jsonc and left alone:{" "}
                {data.bindings.map((b) => `${b.name} (${b.type})`).join(", ")}.
              </p>
            )}

            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addDraft();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="env-new-name">Name</Label>
                <Input id="env-new-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="MY_VARIABLE" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="env-new-kind">Type</Label>
                <select id="env-new-kind" className={selectClass} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as VarKind })}>
                  <option value="plain_text">Plain text</option>
                  <option value="secret_text">Secret</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor="env-new-value">Value</Label>
                <Input id="env-new-value" type={draft.kind === "secret_text" ? "password" : "text"} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} autoComplete="off" />
              </div>
              <Button type="submit" variant="outline" disabled={!draft.name}>
                Stage variable
              </Button>
            </form>

            <details>
              <summary className="cursor-pointer font-medium">Bulk paste .env</summary>
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  aria-label="Bulk .env entries"
                  className="border-input bg-background min-h-28 w-full rounded-md border p-2 font-mono text-xs"
                  placeholder={"API_KEY=abc123\nexport FEATURE_FLAG=true"}
                  value={bulk.text}
                  onChange={(e) => setBulk({ ...bulk, text: e.target.value })}
                  spellCheck={false}
                />
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bulk.secret} onChange={(e) => setBulk({ ...bulk, secret: e.target.checked })} />
                  Store every pasted entry as a secret (names that are already secrets stay secrets)
                </label>
                <div>
                  <Button type="button" variant="outline" disabled={!bulk.text.trim()} onClick={stageBulk}>
                    Stage pasted entries
                  </Button>
                </div>
              </div>
            </details>

            {notice && <p role="status">{notice}</p>}

            {stagedList.length > 0 && (
              <div className="flex flex-col gap-3 rounded-md border p-3" data-testid="staged">
                <p className="font-medium">
                  {stagedList.length} staged {stagedList.length === 1 ? "change" : "changes"}
                </p>
                <ul className="flex flex-col gap-1">
                  {stagedList.map((change) => (
                    <li key={change.name} className="flex items-center justify-between gap-2">
                      <span className="font-mono">
                        {change.op === "delete" ? "delete" : current.has(change.name) ? "update" : "add"} {change.name}
                        {change.op === "set" && ` (${KIND_LABEL[change.kind]})`}
                        {Object.hasOwn(protectedNames, change.name) && <Badge variant="destructive" className="ml-2">protected</Badge>}
                      </span>
                      <Button size="sm" variant="ghost" aria-label={`Unstage ${change.name}`} onClick={() => unstage(change.name)}>
                        Unstage
                      </Button>
                    </li>
                  ))}
                </ul>
                {!plan && (
                  <div>
                    <Button onClick={() => void review()} disabled={busy !== null}>
                      {busy === "review" ? "Checking…" : "Review changes"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {plan && (
              <div className="flex flex-col gap-3 rounded-md border p-3" data-testid="plan">
                <p className="font-medium">Review before applying (secret values are never shown)</p>
                <ul className="flex flex-col gap-2">
                  {plan.entries.map((entry) => (
                    <DiffLine key={entry.name} entry={entry} />
                  ))}
                </ul>
                {plan.warnings.map((warning) => (
                  <p key={warning} className="text-destructive" role="alert">
                    {warning}
                  </p>
                ))}
                {plan.needsRebuild.length > 0 && (
                  <p className="text-muted-foreground">
                    {plan.needsRebuild.join(", ")} {plan.needsRebuild.length === 1 ? "is" : "are"} inlined into the browser bundle at build time: use Apply and rebuild for {plan.needsRebuild.length === 1 ? "it" : "them"} to take effect.
                  </p>
                )}
                {plan.hasProtected && (
                  <div className="border-destructive text-destructive flex flex-col gap-2 rounded-md border p-2" role="alert">
                    <p className="font-medium">Protected variables are in this change</p>
                    <ul className="list-disc pl-5">
                      {plan.entries
                        .filter((entry) => entry.protected && entry.action !== "unchanged")
                        .map((entry) => (
                          <li key={entry.name}>
                            <span className="font-mono">{entry.name}</span>: {protectedNames[entry.name]}
                          </li>
                        ))}
                    </ul>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={confirmProtected} onChange={(e) => setConfirmProtected(e.target.checked)} />I understand the risk of changing these
                    </label>
                  </div>
                )}
                {plan.hasDeletes && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={confirmDelete} onChange={(e) => setConfirmDelete(e.target.checked)} />
                    Yes, delete {plan.entries.filter((entry) => entry.action === "delete" && !entry.missing).map((entry) => entry.name).join(", ")}: the Worker loses {plan.entries.filter((e) => e.action === "delete" && !e.missing).length === 1 ? "it" : "them"} immediately and this cannot be undone here
                  </label>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!canApply} onClick={() => void apply(false)}>
                    {busy === "apply" ? "Applying…" : "Apply"}
                  </Button>
                  <Button disabled={!canApply || !canRebuild} onClick={() => void apply(true)} title={canRebuild ? undefined : "Save the GitHub token to rebuild"}>
                    {busy === "rebuild" ? "Applying and rebuilding…" : "Apply and rebuild"}
                  </Button>
                  <Button variant="ghost" disabled={busy !== null} onClick={() => setPlan(null)}>
                    Back
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  Apply updates the running Worker right away. Apply and rebuild also redeploys it from {" "}
                  the repository, which is what makes build-time (NEXT_PUBLIC_*) variables take effect.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
