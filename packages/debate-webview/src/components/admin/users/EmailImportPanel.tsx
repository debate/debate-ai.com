"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CUSTOMERS_LIST_NAME,
  type CustomerImportPreview,
  type CustomerImportReport,
} from "../../../lib/admin/email-customers";
import { adminEmailApi } from "../../../lib/admin/email-campaign";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";

const addresses = (count: number) => `${count} ${count === 1 ? "address" : "addresses"}`;

/**
 * "Import existing emails": previews every address the app already holds for a
 * customer (counts by source, unsubscribed ones left out), then saves them as
 * one list. Importing again refreshes that same list in place.
 */
export function EmailImportPanel({
  onSaved,
  onCancel,
}: {
  onSaved: (listId: string, notice: string) => void;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<CustomerImportPreview | null>(null);
  const [name, setName] = useState(DEFAULT_CUSTOMERS_LIST_NAME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { preview: next } = await adminEmailApi<{ preview: CustomerImportPreview }>("/api/admin/emails/lists/import");
    setPreview(next);
    if (next.existing) setName(next.existing.name);
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const refreshing = Boolean(preview?.existing);
  const tooMany = preview ? preview.total > preview.maxRecipients : false;
  const canSave = !busy && preview !== null && preview.total > 0 && !tooMany && name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const { list, report } = await adminEmailApi<{ list: { id: string; name: string; count: number }; report: CustomerImportReport }>(
        "/api/admin/emails/lists/import",
        { method: "POST", body: JSON.stringify({ name }) },
      );
      onSaved(
        list.id,
        `${refreshing ? "Refreshed" : "Imported"} "${list.name}" with ${addresses(list.count)}` +
          (report.excludedUnsubscribed > 0 ? ` (${report.excludedUnsubscribed} unsubscribed left out).` : "."),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>Import existing emails</CardTitle>
        <CardDescription>
          Collects every email address the app already has for a customer, lowercases and deduplicates them, leaves out
          anyone who unsubscribed, and saves the result as a list you can send to.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={DEFAULT_CUSTOMERS_LIST_NAME}
          aria-label="Import list name"
          maxLength={100}
        />
        {!preview && !error && <p className="text-muted-foreground text-sm">Counting current customers…</p>}
        {preview && (
          <div className="flex flex-col gap-2 text-sm" data-testid="import-preview">
            <p>
              <strong>{addresses(preview.total)}</strong> will be saved
              {preview.excludedUnsubscribed > 0 && `, ${preview.excludedUnsubscribed} unsubscribed left out`}
              {preview.invalid > 0 && `, ${preview.invalid} invalid skipped`}.
            </p>
            <ul className="rounded-md border p-2">
              {preview.sources.map((source) => (
                <li key={source.id} className="flex justify-between gap-2 py-0.5">
                  <span>{source.label}</span>
                  <span className="text-muted-foreground">
                    {source.count} found, {source.added} new
                  </span>
                </li>
              ))}
            </ul>
            {preview.existing && (
              <p className="text-muted-foreground">
                "{preview.existing.name}" holds {addresses(preview.existing.count)} now; refreshing adds {preview.added} and
                removes {preview.removed}.
              </p>
            )}
            {preview.total === 0 && <p className="text-muted-foreground">No subscribed customer emails were found.</p>}
            {tooMany && <p className="text-destructive">A list holds at most {preview.maxRecipients} addresses.</p>}
          </div>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={!canSave}>
            {busy ? "Saving…" : refreshing ? "Refresh from current users" : "Save list"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
