"use client";

import { useCallback, useEffect, useState } from "react";
import { adminEmailApi } from "../../../lib/admin/email-campaign";
import { Badge } from "../../../ui/primitives/badge";
import { Button } from "../../../ui/primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/primitives/card";
import { Input } from "../../../ui/primitives/input";

/** What GET /api/admin/emails/resend-key returns. The key itself never leaves the server. */
export interface ResendKeyStatus {
  saved: boolean;
  endsIn: string;
  unreadable: boolean;
  envFallback: boolean;
  source: "saved" | "env" | null;
}

/**
 * The Resend API key for bulk sends. The server stores it encrypted and only
 * ever reports whether one is saved and its last four characters; the box
 * below is write-only, so replacing a key means typing the new one.
 */
export function EmailSettingsPanel({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<ResendKeyStatus | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await adminEmailApi<{ status: ResendKeyStatus }>("/api/admin/emails/resend-key");
    setStatus(data.status);
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await adminEmailApi<{ status: ResendKeyStatus }>("/api/admin/emails/resend-key", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setStatus(data.status);
      setKey("");
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove the saved Resend API key?")) return;
    setBusy(true);
    setError(null);
    try {
      const data = await adminEmailApi<{ status: ResendKeyStatus }>("/api/admin/emails/resend-key", { method: "DELETE" });
      setStatus(data.status);
      onChanged?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resend API key</CardTitle>
        <CardDescription>
          Used to send email to saved lists through Resend. It is stored encrypted on the server and never shown
          again; only its last four characters are. Without a saved key, the <code>RESEND_API_KEY</code> secret is
          used.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="resend-key-status">
          {!status ? (
            <span className="text-muted-foreground">Loading…</span>
          ) : status.saved ? (
            <>
              <Badge variant="secondary">Saved</Badge>
              <span>
                Saved, ends in <code>{status.endsIn || "••••"}</code>
              </span>
            </>
          ) : (
            <>
              <Badge variant="outline">{status.envFallback ? "Using env secret" : "Not set"}</Badge>
              <span className="text-muted-foreground">
                {status.unreadable
                  ? "The saved key can't be decrypted (the server secret changed). Enter it again."
                  : status.envFallback
                    ? "No key saved here; sends use the RESEND_API_KEY secret."
                    : "No key saved, and RESEND_API_KEY is not set."}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder={status?.saved ? "Paste a new key to replace it" : "re_…"}
            aria-label="Resend API key"
            className="max-w-sm"
          />
          <Button size="sm" onClick={save} disabled={busy || !key.trim()}>
            {status?.saved ? "Replace key" : "Save key"}
          </Button>
          {status?.saved && (
            <Button size="sm" variant="outline" onClick={remove} disabled={busy}>
              Remove key
            </Button>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
