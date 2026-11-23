"use client";

/**
 * @fileoverview A small microphone recorder for one rebuttal redo: record,
 * stop, listen back, record again. It shows the elapsed time against the
 * judge's speech time but never cuts the debater off — going over is part of
 * what the judge reviews.
 *
 * Kept local rather than reusing `@debate-ai/timer`'s `useSpeechRecorder`,
 * which is bound to a live round's timer state and stores clips per speech
 * name in the browser; a redo needs one blob it can upload.
 *
 * @module debate-practice-rounds/rebuttal-redos/ui/RedoRecorder
 */

import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square } from "lucide-react";

export interface RedoRecorderProps {
  timeLimitSeconds: number;
  /** Called with each finished take (or null when cleared). */
  onRecorded: (audio: Blob | null) => void;
  disabled?: boolean;
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
}

export function RedoRecorder({ timeLimitSeconds, onRecorded, disabled }: RedoRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        onRecorded(blob);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setPreviewUrl(null);
      onRecorded(null);
      setElapsed(0);
      setRecording(true);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    } catch {
      setError("Allow microphone access to record your redo — or write your outline below instead.");
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  if (!supported) {
    return <p className="text-xs text-muted-foreground">This browser can't record audio — write your outline below instead.</p>;
  }

  const over = elapsed > timeLimitSeconds;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" /> Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void start()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {previewUrl ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
            {previewUrl ? "Record again" : "Record redo"}
          </button>
        )}
        <span className={over ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"} aria-live="polite">
          {formatClock(elapsed)} / {formatClock(timeLimitSeconds)}
          {over ? " — over time" : ""}
        </span>
      </div>
      {previewUrl && !recording ? <audio controls src={previewUrl} className="h-9 w-full" aria-label="Your recorded redo" /> : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
