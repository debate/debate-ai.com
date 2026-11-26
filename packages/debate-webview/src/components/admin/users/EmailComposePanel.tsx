"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMAIL_PROVIDER_LABELS,
  adminEmailApi,
  sendInBatches,
  tally,
  type BatchResponse,
  type EmailProvider,
  type SendResult,
} from "../../../lib/admin/email-campaign";
import { CURRENT_CUSTOMERS_LIST_ID } from "../../../lib/admin/email-customers";
import { cn } from "../../../ui/lib/utils";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";
import type { EmailListSummary } from "./EmailListsPanel";

interface SavedTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Starter {
  name: string;
  subject: string;
  body: string;
}

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

type ProviderInfo = Record<EmailProvider, { ready: boolean; batchSize: number }>;

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none";

const BODY_HELP = "Blank lines separate paragraphs. “# Title” is a heading, “[Label](/docs)” a link, and a line of only a link is a button.";

/**
 * Compose and send: write and save a template (subject and body, starting from
 * the Welcome email if you like, with a preview), then pick a saved list and a
 * provider. Sending asks for confirmation with the recipient count, goes out
 * in batches with progress, and ends with each address's result.
 */
export function EmailComposePanel() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [starter, setStarter] = useState<Starter | null>(null);
  const [lists, setLists] = useState<EmailListSummary[]>([]);
  const [providers, setProviders] = useState<ProviderInfo | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<Rendered | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [listId, setListId] = useState("");
  const [provider, setProvider] = useState<EmailProvider>("resend");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [refreshingCustomers, setRefreshingCustomers] = useState(false);
  const stopRef = useRef(false);

  const selected = templates.find((template) => template.id === selectedId) ?? null;
  const dirty = !selected || selected.name !== name || selected.subject !== subject || selected.body !== body;
  const list = lists.find((candidate) => candidate.id === listId) ?? null;
  const providerReady = providers?.[provider]?.ready ?? false;
  const canReview = Boolean(selected) && !dirty && Boolean(list) && providerReady && !sending;

  const load = useCallback(async () => {
    const [templateData, listData, campaignData] = await Promise.all([
      adminEmailApi<{ templates: SavedTemplate[]; starter: Starter }>("/api/admin/emails/templates"),
      adminEmailApi<{ lists: EmailListSummary[] }>("/api/admin/emails/lists"),
      adminEmailApi<{ providers: ProviderInfo }>("/api/admin/emails/campaign"),
    ]);
    setTemplates(templateData.templates);
    setStarter(templateData.starter);
    setLists(listData.lists);
    setProviders(campaignData.providers);
    setProvider((current) =>
      campaignData.providers[current].ready ? current : campaignData.providers.resend.ready ? "resend" : campaignData.providers.cloudflare.ready ? "cloudflare" : current,
    );
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const edit = (next: { name?: string; subject?: string; body?: string }) => {
    if (next.name !== undefined) setName(next.name);
    if (next.subject !== undefined) setSubject(next.subject);
    if (next.body !== undefined) setBody(next.body);
    setPreview(null);
    setNotice(null);
    setConfirming(false);
  };

  const resetSend = () => {
    setConfirming(false);
    setResults(null);
    setSendError(null);
    setProgress(null);
    setResumeFrom(null);
  };

  const open = (template: SavedTemplate | null) => {
    setSelectedId(template?.id ?? null);
    setName(template?.name ?? "");
    setSubject(template?.subject ?? "");
    setBody(template?.body ?? "");
    setPreview(null);
    setError(null);
    setNotice(null);
    resetSend();
  };

  const startFromWelcome = () => {
    if (!starter) return;
    open(null);
    setName("Welcome (copy)");
    setSubject(starter.subject);
    setBody(starter.body);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { template } = await adminEmailApi<{ template: SavedTemplate }>("/api/admin/emails/templates", {
        method: "POST",
        body: JSON.stringify({ id: selectedId ?? undefined, name, subject, body }),
      });
      setTemplates((current) =>
        selectedId ? current.map((entry) => (entry.id === template.id ? template : entry)) : [...current, template],
      );
      setSelectedId(template.id);
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
      setNotice("Template saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm(`Delete the template "${name}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminEmailApi(`/api/admin/emails/templates?id=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      setTemplates((current) => current.filter((entry) => entry.id !== selectedId));
      open(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await adminEmailApi<Rendered>("/api/admin/emails/templates", {
          method: "POST",
          body: JSON.stringify({ action: "preview", subject, body }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Re-imports every current customer into the customers list, picks it, and asks for confirmation with its fresh count. */
  const reviewSendToCustomers = async () => {
    setRefreshingCustomers(true);
    resetSend();
    try {
      await adminEmailApi("/api/admin/emails/lists/import", { method: "POST", body: JSON.stringify({}) });
      const { lists: fresh } = await adminEmailApi<{ lists: EmailListSummary[] }>("/api/admin/emails/lists");
      setLists(fresh);
      setListId(CURRENT_CUSTOMERS_LIST_ID);
      setConfirming(true);
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setRefreshingCustomers(false);
    }
  };

  const runSend = async (startOffset: number, previous: SendResult[]) => {
    if (!selected || !list) return;
    stopRef.current = false;
    setSending(true);
    setConfirming(false);
    setSendError(null);
    setResumeFrom(null);
    setResults(previous);
    setProgress({ done: previous.length, total: list.count });
    const run = await sendInBatches(
      (offset) =>
        adminEmailApi<BatchResponse>("/api/admin/emails/campaign", {
          method: "POST",
          body: JSON.stringify({ templateId: selected.id, listId: list.id, provider, offset }),
        }),
      {
        startOffset,
        shouldStop: () => stopRef.current,
        onBatch: (batch, all) => {
          setResults([...previous, ...all]);
          setProgress({ done: previous.length + all.length, total: batch.total });
        },
      },
    );
    setResults([...previous, ...run.results]);
    if (!run.completed) {
      setSendError(run.error);
      setResumeFrom(run.nextOffset);
    }
    setSending(false);
  };

  const totals = useMemo(() => (results ? tally(results) : null), [results]);
  const problems = results?.filter((result) => result.status !== "sent") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-2 lg:w-64 lg:shrink-0">
          <Button size="sm" variant="outline" onClick={() => open(null)}>
            New template
          </Button>
          <Button size="sm" variant="outline" onClick={startFromWelcome} disabled={!starter}>
            Start from Welcome email
          </Button>
          {templates.length === 0 && <p className="text-muted-foreground text-sm">No saved templates yet.</p>}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => open(template)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                template.id === selectedId ? "border-primary bg-muted" : "hover:bg-muted/50",
              )}
            >
              <div className="text-sm font-medium">{template.name}</div>
              <div className="text-muted-foreground mt-1 truncate text-xs">{template.subject}</div>
            </button>
          ))}
        </div>

        <Card className="min-w-0 flex-1">
          <CardHeader>
            <CardTitle>{selectedId ? "Edit template" : "New template"}</CardTitle>
            <CardDescription>{BODY_HELP} Every email ends with the Debate AI footer and an unsubscribe link.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input value={name} onChange={(e) => edit({ name: e.target.value })} placeholder="Template name" aria-label="Template name" maxLength={100} />
            <Input value={subject} onChange={(e) => edit({ subject: e.target.value })} placeholder="Subject" aria-label="Subject" maxLength={200} />
            <textarea
              value={body}
              onChange={(e) => edit({ body: e.target.value })}
              rows={12}
              placeholder={"# Hello\n\nWrite your message here."}
              aria-label="Email body"
              className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={showPreview} disabled={busy || !subject.trim() || !body.trim()}>
                Preview
              </Button>
              <div className="ml-auto flex gap-2">
                {selectedId && (
                  <Button size="sm" variant="outline" onClick={remove} disabled={busy}>
                    Delete
                  </Button>
                )}
                <Button size="sm" onClick={save} disabled={busy || !name.trim() || !subject.trim() || !body.trim() || (Boolean(selected) && !dirty)}>
                  {selectedId ? "Save changes" : "Save template"}
                </Button>
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
            {preview && (
              <>
                <p className="text-sm">
                  Subject: <span className="text-foreground">{preview.subject}</span>
                </p>
                <iframe
                  title="Template preview"
                  srcDoc={preview.html}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  className="h-[560px] w-full rounded-md border bg-white"
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send to a list</CardTitle>
          <CardDescription>
            Sends the saved template to every address in a saved list, one email each, in batches. Addresses that
            unsubscribed are skipped. "Send to all current customers" first refreshes the imported customers list from
            current accounts, then asks you to confirm the count.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Template
              <span className="border-input bg-muted/40 flex h-9 items-center truncate rounded-md border px-3">
                {selected ? selected.name : "Save or pick a template above"}
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              List
              <select
                className={selectClass}
                value={listId}
                onChange={(e) => {
                  setListId(e.target.value);
                  resetSend();
                }}
                aria-label="List"
              >
                <option value="">Choose a list…</option>
                {lists.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Send with
              <select
                className={selectClass}
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as EmailProvider);
                  resetSend();
                }}
                aria-label="Provider"
              >
                {(Object.keys(EMAIL_PROVIDER_LABELS) as EmailProvider[]).map((id) => (
                  <option key={id} value={id}>
                    {EMAIL_PROVIDER_LABELS[id]}
                    {providers && !providers[id].ready ? " (not set up)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {providers && !providerReady && (
            <p className="text-muted-foreground text-sm">
              {provider === "resend"
                ? "Resend needs an API key: add one under Settings, or set the RESEND_API_KEY secret."
                : "The Cloudflare provider needs the Worker's EMAIL send_email binding (see wrangler.jsonc)."}
            </p>
          )}
          {selected && dirty && <p className="text-muted-foreground text-sm">Save your changes to the template before sending.</p>}

          {!confirming && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setConfirming(true)} disabled={!canReview}>
                Review and send
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={reviewSendToCustomers}
                disabled={!selected || dirty || !providerReady || sending || refreshingCustomers}
              >
                {refreshingCustomers ? "Refreshing customers…" : "Send to all current customers"}
              </Button>
            </div>
          )}

          {confirming && selected && list && (
            <div className="bg-muted/40 flex flex-col gap-3 rounded-md border p-4 text-sm" role="alertdialog" aria-label="Confirm send">
              <p>
                Send <strong>{selected.subject}</strong> to <strong>{list.count}</strong>{" "}
                {list.count === 1 ? "address" : "addresses"} in <strong>{list.name}</strong> through{" "}
                {EMAIL_PROVIDER_LABELS[provider]}, in batches of {providers?.[provider].batchSize}? Unsubscribed
                addresses are skipped. This can't be undone.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => runSend(0, [])}>
                  Send to {list.count} {list.count === 1 ? "address" : "addresses"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {progress && (
            <div className="flex flex-col gap-2 text-sm" aria-live="polite">
              <div className="flex items-center gap-2">
                <span>
                  {sending ? "Sending…" : "Finished."} {progress.done} of {progress.total}
                </span>
                {sending && (
                  <Button size="sm" variant="outline" onClick={() => (stopRef.current = true)}>
                    Stop after this batch
                  </Button>
                )}
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${progress.total ? Math.min(100, (progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {sendError && (
            <div className="text-destructive flex flex-wrap items-center gap-2 text-sm">
              <span>{sendError}</span>
              {resumeFrom !== null && !sending && (
                <Button size="sm" variant="outline" onClick={() => runSend(resumeFrom, results ?? [])}>
                  Resume from address {resumeFrom + 1}
                </Button>
              )}
            </div>
          )}

          {totals && (
            <div className="flex flex-col gap-2 text-sm" data-testid="send-results">
              <p>
                Sent {totals.sent}, failed {totals.failed}, skipped {totals.skipped}.
              </p>
              {problems.length > 0 && (
                <ul className="max-h-64 overflow-auto rounded-md border p-2 text-xs">
                  {problems.map((result) => (
                    <li key={result.email} className={result.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                      {result.email} ({result.status}): {result.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
