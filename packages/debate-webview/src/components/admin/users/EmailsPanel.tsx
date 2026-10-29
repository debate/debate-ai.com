"use client";

import { useEffect, useState } from "react";
import { cn } from "@debate-ai/ui/lib/utils";
import { Badge } from "@debate-ai/ui/primitives/badge";
import { Button } from "@debate-ai/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@debate-ai/ui/primitives/card";

/** One `@debate-ai/emails` template, as GET /api/admin/emails lists it. */
interface EmailTemplateSummary {
  id: string;
  name: string;
  description: string;
  sentFrom: string | null;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

type View = "html" | "text";

/**
 * The admin Emails section: every React Email template in `@debate-ai/emails`,
 * rendered on the server with its sample data (GET /api/admin/emails), shown
 * as the HTML an inbox gets — sandboxed in an iframe — or its plain-text
 * part, with a button that sends the sample to the admin's own address.
 */
export function EmailsPanel() {
  const [templates, setTemplates] = useState<EmailTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rendered, setRendered] = useState<RenderedEmail | null>(null);
  const [view, setView] = useState<View>("html");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/emails")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load email templates");
        if (cancelled) return;
        setTemplates(data.templates);
        setSelectedId((current) => current ?? data.templates[0]?.id ?? null);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setRendered(null);
    setSendResult(null);
    fetch(`/api/admin/emails?template=${encodeURIComponent(selectedId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to render the email");
        if (!cancelled) setRendered(data);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const sendTest = async () => {
    if (!selectedId) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selectedId }),
      });
      const data = await res.json();
      setSendResult(res.ok ? `Sent to ${data.to}.` : data.error || "Failed to send the test email.");
    } catch (err) {
      setSendResult((err as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  const selected = templates.find((template) => template.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-col gap-2 lg:w-64 lg:shrink-0">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setSelectedId(template.id)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              template.id === selectedId ? "border-primary bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="text-sm font-medium">{template.name}</div>
            <div className="text-muted-foreground mt-1 text-xs">{template.description}</div>
            <Badge variant={template.sentFrom ? "secondary" : "outline"} className="mt-2">
              {template.sentFrom ? `Sent by ${template.sentFrom}` : "Not sent automatically"}
            </Badge>
          </button>
        ))}
      </div>

      <Card className="min-w-0 flex-1">
        <CardHeader>
          <CardTitle>{selected?.name ?? "Emails"}</CardTitle>
          <CardDescription>
            {rendered ? (
              <>
                Subject: <span className="text-foreground">{rendered.subject}</span>
              </>
            ) : (
              "Rendered with sample data."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={view === "html" ? "default" : "outline"} onClick={() => setView("html")}>
              HTML
            </Button>
            <Button size="sm" variant={view === "text" ? "default" : "outline"} onClick={() => setView("text")}>
              Plain text
            </Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={sendTest} disabled={!rendered || isSending}>
              {isSending ? "Sending…" : "Send test to me"}
            </Button>
          </div>
          {sendResult && <p className="text-muted-foreground text-sm">{sendResult}</p>}
          {!rendered ? (
            <p className="text-muted-foreground text-sm">Rendering…</p>
          ) : view === "html" ? (
            <iframe
              title={`${selected?.name ?? "Email"} preview`}
              srcDoc={rendered.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[720px] w-full rounded-md border bg-white"
            />
          ) : (
            <pre className="bg-muted max-h-[720px] overflow-auto rounded-md p-4 text-xs whitespace-pre-wrap">
              {rendered.text}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
