"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MAX_LIST_RECIPIENTS, parseRecipientList } from "../../../lib/admin/email-recipients";
import { adminEmailApi } from "../../../lib/admin/email-campaign";
import { cn } from "../../../ui/lib/utils";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";
import { EmailImportPanel } from "./EmailImportPanel";

export interface EmailListSummary {
  id: string;
  name: string;
  count: number;
}

interface EmailList extends EmailListSummary {
  emails: string[];
}

/**
 * The admin Emails section's saved lists: paste addresses (commas, semicolons
 * or one per line), see how many are valid and how many repeats were dropped,
 * and save them under a name. Lists can be edited and deleted; sending picks
 * one of them.
 */
export function EmailListsPanel({ onChanged }: { onChanged?: () => void }) {
  const [lists, setLists] = useState<EmailListSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const parsed = useMemo(() => parseRecipientList(input), [input]);
  const tooMany = parsed.valid.length > MAX_LIST_RECIPIENTS;
  const canSave = !busy && name.trim().length > 0 && parsed.valid.length > 0 && parsed.invalid.length === 0 && !tooMany;

  const refresh = useCallback(async () => {
    const data = await adminEmailApi<{ lists: EmailListSummary[] }>("/api/admin/emails/lists");
    setLists(data.lists);
    return data.lists;
  }, []);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, [refresh]);

  const startNew = () => {
    setImporting(false);
    setSelectedId(null);
    setName("");
    setInput("");
    setError(null);
    setNotice(null);
  };

  const open = async (id: string) => {
    setImporting(false);
    setError(null);
    setNotice(null);
    try {
      const { list } = await adminEmailApi<{ list: EmailList }>(`/api/admin/emails/lists?id=${encodeURIComponent(id)}`);
      setSelectedId(list.id);
      setName(list.name);
      setInput(list.emails.join("\n"));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { list, duplicates } = await adminEmailApi<{ list: EmailList; duplicates: number }>("/api/admin/emails/lists", {
        method: "POST",
        body: JSON.stringify({ id: selectedId ?? undefined, name, emails: input }),
      });
      setSelectedId(list.id);
      setName(list.name);
      setInput(list.emails.join("\n"));
      setNotice(
        `Saved ${list.count} ${list.count === 1 ? "address" : "addresses"}` +
          (duplicates > 0 ? ` (${duplicates} duplicate${duplicates === 1 ? "" : "s"} removed).` : "."),
      );
      await refresh();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    if (!window.confirm(`Delete the list "${name}"? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminEmailApi(`/api/admin/emails/lists?id=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      startNew();
      await refresh();
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-col gap-2 lg:w-64 lg:shrink-0">
        <Button size="sm" variant="outline" onClick={startNew}>
          New list
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            startNew();
            setImporting(true);
          }}
        >
          Import existing emails
        </Button>
        {lists.length === 0 && <p className="text-muted-foreground text-sm">No saved lists yet.</p>}
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            onClick={() => open(list.id)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              list.id === selectedId ? "border-primary bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="text-sm font-medium">{list.name}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {list.count} {list.count === 1 ? "address" : "addresses"}
            </div>
          </button>
        ))}
      </div>

      {importing ? (
        <EmailImportPanel
          onCancel={() => setImporting(false)}
          onSaved={async (id, message) => {
            await refresh();
            await open(id);
            setNotice(message);
            onChanged?.();
          }}
        />
      ) : (
      <Card className="min-w-0 flex-1">
        <CardHeader>
          <CardTitle>{selectedId ? "Edit list" : "New list"}</CardTitle>
          <CardDescription>
            Paste addresses separated by commas, semicolons or new lines. They are validated, lowercased and
            deduplicated when saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="List name, e.g. Fall coaches"
            aria-label="List name"
            maxLength={100}
          />
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={10}
            placeholder={"alex@example.com, sam@example.org\njordan@school.edu"}
            aria-label="List addresses"
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 font-mono text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {parsed.valid.length} {parsed.valid.length === 1 ? "address" : "addresses"}
              {parsed.duplicates > 0 && ` (${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"} will be removed)`}
            </span>
            <div className="ml-auto flex gap-2">
              {selectedId && (
                <Button size="sm" variant="outline" onClick={remove} disabled={busy}>
                  Delete
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!canSave}>
                {busy ? "Saving…" : selectedId ? "Save changes" : "Save list"}
              </Button>
            </div>
          </div>
          {parsed.invalid.length > 0 && (
            <p className="text-destructive text-sm">
              Not email addresses: {parsed.invalid.slice(0, 10).join(", ")}
              {parsed.invalid.length > 10 && "…"}
            </p>
          )}
          {tooMany && <p className="text-destructive text-sm">A list holds at most {MAX_LIST_RECIPIENTS} addresses.</p>}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
