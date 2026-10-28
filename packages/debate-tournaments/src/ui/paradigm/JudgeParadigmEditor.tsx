"use client";

/**
 * @fileoverview Where a judge writes their own paradigm (`/practice/paradigm`).
 *
 * The paradigm is Markdown, with a toolbar for the common marks and a live
 * preview. It links to the judge's Tabroom account by person id or paradigm
 * link; once that link is verified — the judge puts the code shown here in
 * their Tabroom paradigm and clicks Verify, or an admin confirms them — the
 * paradigm written here replaces the Tabroom one when anyone clicks the
 * judge's name in `/tournaments` pairings.
 *
 * @module debate-tournaments/ui/paradigm/JudgeParadigmEditor
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Bold, Copy, Heading2, Italic, Link2, List, ListOrdered, Loader2, Quote, ShieldAlert } from "lucide-react";
import { Badge } from "./primitives/badge";
import { Button } from "./primitives/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./primitives/card";
import { Input } from "./primitives/input";
import { Label } from "./primitives/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./primitives/tabs";
import { cn } from "./cn";
import { fetchOwnParadigm, saveOwnParadigm, verifyOwnParadigm } from "../../judge-paradigms/client";
import { renderParadigmMarkdown } from "../../judge-paradigms/markdown";
import { MAX_PARADIGM_LENGTH, parseTabroomPersonId, type OwnParadigm } from "../../judge-paradigms/types";

/** A toolbar action: wraps the selection, or prefixes each selected line. */
interface MarkAction {
  label: string;
  icon: typeof Bold;
  wrap?: [string, string];
  linePrefix?: string | ((index: number) => string);
}

const ACTIONS: MarkAction[] = [
  { label: "Bold", icon: Bold, wrap: ["**", "**"] },
  { label: "Italic", icon: Italic, wrap: ["_", "_"] },
  { label: "Heading", icon: Heading2, linePrefix: "## " },
  { label: "Bulleted list", icon: List, linePrefix: "- " },
  { label: "Numbered list", icon: ListOrdered, linePrefix: (i) => `${i + 1}. ` },
  { label: "Quote", icon: Quote, linePrefix: "> " },
  { label: "Link", icon: Link2, wrap: ["[", "](https://)"] },
];

/** Applies `action` to `text` between `start` and `end`; returns the new text and selection. */
export function applyMark(text: string, start: number, end: number, action: MarkAction): { text: string; start: number; end: number } {
  if (action.wrap) {
    const [before, after] = action.wrap;
    const selected = text.slice(start, end) || action.label.toLowerCase();
    const next = text.slice(0, start) + before + selected + after + text.slice(end);
    return { text: next, start: start + before.length, end: start + before.length + selected.length };
  }
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lines = text.slice(lineStart, end).split("\n");
  const prefixed = lines.map((line, i) => (typeof action.linePrefix === "function" ? action.linePrefix(i) : action.linePrefix) + line).join("\n");
  const next = text.slice(0, lineStart) + prefixed + text.slice(lineStart + lines.join("\n").length);
  return { text: next, start: lineStart, end: lineStart + prefixed.length };
}

const textareaClass =
  "min-h-80 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm leading-6 shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const PLACEHOLDER = `## Overview
Tech over truth. Fine with speed if you're clear.

## Theory
- Condo is probably fine up to 2
- Disclosure theory: read it if it's real`;

export function JudgeParadigmEditor() {
  const [stored, setStored] = useState<OwnParadigm | null | undefined>(undefined);
  const [markdown, setMarkdown] = useState("");
  const [tabroom, setTabroom] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "verifying" } | { kind: "saved" | "verified" } | { kind: "error"; message: string }>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    fetchOwnParadigm().then(
      (paradigm) => {
        if (!live) return;
        setStored(paradigm);
        if (paradigm) {
          setMarkdown(paradigm.markdown);
          setTabroom(paradigm.tabroomPersonId ? String(paradigm.tabroomPersonId) : "");
        }
      },
      (error: Error) => live && (setStored(null), setStatus({ kind: "error", message: error.message })),
    );
    return () => {
      live = false;
    };
  }, []);

  const preview = useMemo(() => renderParadigmMarkdown(markdown), [markdown]);
  const tabroomId = tabroom.trim() ? parseTabroomPersonId(tabroom) : null;
  const tabroomInvalid = Boolean(tabroom.trim()) && tabroomId === null;
  const dirty = stored ? markdown !== stored.markdown || tabroomId !== stored.tabroomPersonId : false;
  const busy = status.kind === "saving" || status.kind === "verifying";

  const mark = (action: MarkAction) => {
    const el = textarea.current;
    if (!el) return;
    const result = applyMark(markdown, el.selectionStart, el.selectionEnd, action);
    setMarkdown(result.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  };

  const save = async () => {
    setStatus({ kind: "saving" });
    try {
      const saved = await saveOwnParadigm({ tabroomPersonId: tabroomId, markdown });
      setStored(saved);
      setStatus({ kind: "saved" });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };

  const verify = async () => {
    setStatus({ kind: "verifying" });
    try {
      setStored(await verifyOwnParadigm());
      setStatus({ kind: "verified" });
    } catch (error) {
      setStatus({ kind: "error", message: (error as Error).message });
    }
  };

  if (stored === undefined) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading your paradigm…
      </div>
    );
  }
  if (stored === null) {
    return (
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>Your judge paradigm</CardTitle>
          <CardDescription>
            {status.kind === "error" ? status.message : "Sign in to write your paradigm and link it to your Tabroom judge account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/login?callbackURL=%2Fpractice%2Fparadigm" className="text-sm font-medium text-primary underline underline-offset-4">
            Sign in
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Your judge paradigm</CardTitle>
            {stored.tabroomPersonId ? (
              stored.verified ? (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck className="size-3.5" aria-hidden /> Verified Tabroom judge #{stored.tabroomPersonId}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <ShieldAlert className="size-3.5" aria-hidden /> Not verified yet
                </Badge>
              )
            ) : null}
          </div>
          <CardDescription>
            Debaters see this when they click your name in tournament pairings. Until your Tabroom account is verified, they see your Tabroom paradigm
            instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tabroom-judge">Your Tabroom judge id or paradigm link</Label>
            <Input
              id="tabroom-judge"
              value={tabroom}
              onChange={(event) => setTabroom(event.target.value)}
              placeholder="https://www.tabroom.com/index/paradigm.mhtml?judge_person_id=12345"
              aria-invalid={tabroomInvalid || undefined}
            />
            {tabroomInvalid ? <p className="text-xs text-destructive">That isn&apos;t a Tabroom judge id or paradigm link.</p> : null}
          </div>

          {stored.tabroomPersonId && !stored.verified ? (
            <div className="space-y-2 rounded-lg border border-dashed p-3 text-sm">
              <p>
                To verify, add this code anywhere in your paradigm on Tabroom, save it there, then click Verify. You can remove it afterwards.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{stored.verifyCode}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard?.writeText(stored.verifyCode).then(() => setCopied(true), () => undefined);
                  }}
                >
                  <Copy aria-hidden /> {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={verify} disabled={busy || dirty}>
                  {status.kind === "verifying" ? <Loader2 className="animate-spin" aria-hidden /> : <BadgeCheck aria-hidden />}
                  Verify
                </Button>
              </div>
              {dirty ? <p className="text-xs text-muted-foreground">Save your changes before verifying.</p> : null}
            </div>
          ) : null}

          <Tabs defaultValue="write">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="write">Write</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
                {ACTIONS.map((action) => (
                  <Button key={action.label} type="button" variant="ghost" size="icon-sm" title={action.label} aria-label={action.label} onClick={() => mark(action)}>
                    <action.icon aria-hidden />
                  </Button>
                ))}
              </div>
            </div>
            <TabsContent value="write">
              <textarea
                ref={textarea}
                aria-label="Paradigm"
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                maxLength={MAX_PARADIGM_LENGTH}
                placeholder={PLACEHOLDER}
                className={textareaClass}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                Markdown · {markdown.length.toLocaleString("en-US")} / {MAX_PARADIGM_LENGTH.toLocaleString("en-US")}
              </p>
            </TabsContent>
            <TabsContent value="preview">
              {markdown.trim() ? (
                <div
                  data-paradigm-preview=""
                  className={cn(
                    "min-h-80 space-y-3 rounded-md border p-4 text-sm leading-relaxed",
                    "[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc",
                  )}
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              ) : (
                <p className="min-h-80 rounded-md border p-4 text-sm text-muted-foreground">Nothing to preview yet.</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={busy || tabroomInvalid || !dirty}>
              {status.kind === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Save paradigm
            </Button>
            <span role="status" className={cn("text-sm", status.kind === "error" ? "text-destructive" : "text-muted-foreground")}>
              {status.kind === "error"
                ? status.message
                : status.kind === "saved"
                  ? "Saved."
                  : status.kind === "verified"
                    ? "Verified — your paradigm now shows in pairings."
                    : stored.updatedAt
                      ? `Last saved ${new Date(stored.updatedAt).toLocaleString()}`
                      : null}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
