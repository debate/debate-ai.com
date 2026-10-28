"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS } from "@debate-ai/videos";
import { Button } from "../ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/primitives/card";
import { Input } from "../ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select";

type Scope = "goat" | "all";

interface SpeechAnalysisStats {
  scope: Scope;
  totalVideos: number;
  withTranscript: number;
  analyzed: number;
  aiConfigured: boolean;
}

interface VideoResult {
  videoId: string;
  title: string;
  viewCount?: number;
  status: "saved" | "preview" | "failed";
  format?: string;
  speeches?: number;
  wrote?: string[];
  error?: string;
  summary?: string;
  analysis?: string;
}

interface PageResult {
  processed: number;
  saved: number;
  results: VideoResult[];
  nextAfterId: string | null;
  done: boolean;
}

const SCOPE_LABELS: Record<Scope, string> = {
  goat: "Greatest of All-Time videos",
  all: "Every video",
};

/** The run order, which the server's `SPEECH_ANALYSIS_ORDER` follows. */
const SCOPE_ORDER: Record<Scope, string> = {
  goat: "Most viewed first.",
  all: "Greatest of All-Time videos first, then the rest by most viewed.",
};

/** The admin's prompt is kept in this browser between visits. */
const PROMPT_STORAGE_KEY = "admin:speech-analysis-prompt";

/** Pulls a YouTube id out of a pasted URL, or returns the text as is. */
function videoIdFrom(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return match ? match[1] : trimmed;
}

/**
 * Runs the speech AI pipeline: fetches each video's transcript, has the
 * model split it into speeches with start times, then runs the admin's
 * prompt over the speeches to write a summary of each and what it could have
 * done instead. The results are saved as the video's Summary and Analysis
 * documents, which the watch page turns into speech buttons under the player
 * and per-speech tabs in the sidebar.
 */
export function SpeechAnalysisPanel() {
  const [scope, setScope] = useState<Scope>("goat");
  const [stats, setStats] = useState<SpeechAnalysisStats | null>(null);
  const [instructions, setInstructions] = useState(DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS);
  const [overwrite, setOverwrite] = useState(false);
  const [singleVideo, setSingleVideo] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<VideoResult[]>([]);
  const [preview, setPreview] = useState<VideoResult | null>(null);
  const stopRequested = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROMPT_STORAGE_KEY);
      if (saved) setInstructions(saved);
    } catch {
      // Storage blocked — the default prompt stands.
    }
  }, []);

  const updateInstructions = (value: string) => {
    setInstructions(value);
    try {
      window.localStorage.setItem(PROMPT_STORAGE_KEY, value);
    } catch {
      // Not remembered; the run still uses it.
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/videos/speech-analysis?scope=${scope}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.details || body?.error || "Failed to load stats");
      setStats(body);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (payload: Record<string, unknown>): Promise<PageResult> => {
    const res = await fetch("/api/admin/videos/speech-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        overwrite,
        instructions: instructions === DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS ? undefined : instructions,
        ...payload,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.details || body?.error || "Speech analysis failed");
    return body as PageResult;
  };

  const start = () => {
    setIsRunning(true);
    setError(null);
    setNotice(null);
    setFailures([]);
    setPreview(null);
    stopRequested.current = false;
  };

  /** Processes one video, saving it or (dry run) showing what would be saved. */
  const runOne = async (dryRun: boolean) => {
    const videoId = videoIdFrom(singleVideo);
    if (!videoId) return;
    start();
    setProgress(`${dryRun ? "Previewing" : "Processing"} ${videoId}…`);
    try {
      const page = await post({ videoId, dryRun });
      const result = page.results[0];
      if (!result || result.status === "failed") {
        throw new Error(result?.error ?? "Nothing was processed.");
      }
      if (dryRun) {
        setPreview(result);
        setNotice(`Preview of ${result.title || videoId}: ${result.speeches} speeches found. Nothing was saved.`);
      } else {
        setNotice(
          `Saved ${result.wrote?.join(" and ") || "nothing (an editor wrote both documents)"} for ${result.title || videoId} — ${result.speeches} speeches.`,
        );
        await load();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
      setIsRunning(false);
    }
  };

  /** Walks every video in scope, one page per request, until done or stopped. */
  const runAll = async () => {
    start();
    let afterId: string | null = null;
    let saved = 0;
    let processed = 0;
    const failed: VideoResult[] = [];
    try {
      for (;;) {
        const page = await post({ afterId });
        processed += page.processed;
        saved += page.saved;
        failed.push(...page.results.filter((result) => result.status === "failed"));
        setFailures([...failed]);
        const last = page.results[page.results.length - 1];
        setProgress(
          `Processed ${processed.toLocaleString()} videos, saved ${saved.toLocaleString()}` +
            (last
              ? ` — last: ${last.title}` +
                (last.viewCount != null ? ` (${last.viewCount.toLocaleString()} views)` : "")
              : "") +
            "…",
        );
        if (page.done || !page.nextAfterId || stopRequested.current) break;
        afterId = page.nextAfterId;
      }
      setNotice(
        `${stopRequested.current ? "Stopped" : "Done"} — wrote speech summaries and alternatives for ${saved.toLocaleString()} of ${processed.toLocaleString()} videos.`,
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
      setIsRunning(false);
    }
  };

  const remaining = stats ? Math.max(stats.totalVideos - stats.analyzed, 0) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Speech AI</CardTitle>
        <CardDescription>
          Fetches each video&apos;s transcript, has the AI split it into speeches with their start
          times, then runs the prompt below over every speech. The result is saved as the
          video&apos;s Summary and Analysis documents: the speeches become buttons under the
          player, and each speech&apos;s summary and alternative show in the sidebar. Documents an
          editor wrote are never replaced.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SCOPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={runAll} disabled={isRunning || stats?.aiConfigured === false}>
            {isRunning ? "Processing…" : `Process ${SCOPE_LABELS[scope].toLowerCase()}`}
          </Button>
          {isRunning && (
            <Button variant="outline" onClick={() => (stopRequested.current = true)}>
              Stop after this video
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overwrite}
              disabled={isRunning}
              onChange={(event) => setOverwrite(event.target.checked)}
            />
            Redo videos the AI already analyzed
          </label>
        </div>
        <p className="text-muted-foreground text-sm">Order: {SCOPE_ORDER[scope]}</p>
        {stats && (
          <p className="text-muted-foreground text-sm">
            {stats.totalVideos.toLocaleString()} videos · {stats.withTranscript.toLocaleString()}{" "}
            with cached transcripts · {stats.analyzed.toLocaleString()} analyzed ·{" "}
            {remaining.toLocaleString()} to go
          </p>
        )}
        {stats?.aiConfigured === false && (
          <p className="text-destructive text-sm">
            No shared AI key is configured on the server (OPENROUTER_API_KEY or ANTHROPIC_API_KEY).
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="speech-analysis-prompt" className="text-sm font-medium">
              Prompt run over each round&apos;s speeches
            </label>
            {instructions !== DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isRunning}
                onClick={() => updateInstructions(DEFAULT_SPEECH_ANALYSIS_INSTRUCTIONS)}
              >
                Reset to default
              </Button>
            )}
          </div>
          <textarea
            id="speech-analysis-prompt"
            value={instructions}
            onChange={(event) => updateInstructions(event.target.value)}
            disabled={isRunning}
            rows={10}
            spellCheck={false}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:ring-[3px]"
          />
          <p className="text-muted-foreground text-xs">
            The reply format (a summary and an alternative per speech) is added after this prompt
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={singleVideo}
            onChange={(event) => setSingleVideo(event.target.value)}
            placeholder="One video: YouTube URL or ID"
            className="w-72"
            disabled={isRunning}
          />
          <Button
            variant="outline"
            onClick={() => runOne(true)}
            disabled={isRunning || !singleVideo.trim() || stats?.aiConfigured === false}
          >
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => runOne(false)}
            disabled={isRunning || !singleVideo.trim() || stats?.aiConfigured === false}
          >
            Process and save
          </Button>
        </div>

        {progress && <p className="text-muted-foreground text-sm">{progress}</p>}
        {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
        {error && <p className="text-destructive text-sm">{error}</p>}

        {preview && (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Summary document</span>
              <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                {preview.summary}
              </pre>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">Analysis document (alternatives)</span>
              <pre className="bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                {preview.analysis}
              </pre>
            </div>
          </div>
        )}

        {failures.length > 0 && (
          <details className="flex flex-col gap-1">
            <summary className="text-muted-foreground text-xs font-medium">
              {failures.length} skipped (no captions or failed)
            </summary>
            <ul className="flex flex-col gap-0.5">
              {failures.slice(0, 50).map((entry) => (
                <li key={entry.videoId} className="text-muted-foreground text-xs">
                  <span className="font-mono">{entry.videoId}</span> — {entry.error}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
