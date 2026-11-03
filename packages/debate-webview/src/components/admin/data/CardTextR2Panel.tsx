"use client";

import { useRef, useState } from "react";
import { Button } from "../../../ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../ui/primitives/card";

/** What the move route handles, in the order the button runs them. */
const PHASES = [
  { kind: "cards", label: "cards", limit: 200 },
  { kind: "caselist-docs", label: "caselist documents", limit: 10 },
] as const;

type PhaseKind = (typeof PHASES)[number]["kind"];

interface MoveProgress {
  moved: number;
  charsFreed: number;
  done: boolean;
}

function formatChars(chars: number): string {
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)} KB`;
  if (chars < 1024 * 1024 * 1024) return `${(chars / 1024 / 1024).toFixed(1)} MB`;
  return `${(chars / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Moves the bulky text behind card search out of D1 and into the CARD_TEXT
 * R2 bucket, one page per request
 * (apps/debate-web/app/api/admin/debate-cards/move-text/route.ts): first each
 * card's full text and markup, then the HTML of the caselist speech documents
 * listed as Outlines. D1 keeps the metadata — tag, cite, highlighted text,
 * file names. Stoppable, and safe to re-run: rows already moved are skipped.
 */
export function CardTextR2Panel() {
  const [isMoving, setIsMoving] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [progress, setProgress] = useState<Partial<Record<PhaseKind, MoveProgress>>>({});
  const [error, setError] = useState<string | null>(null);
  // Read inside the loop, which a state value captured at start would not see change.
  const stopRef = useRef(false);

  const handleMove = async () => {
    setIsMoving(true);
    setError(null);
    setStopRequested(false);
    stopRef.current = false;
    setProgress({});
    try {
      for (const phase of PHASES) {
        let afterId = 0;
        let moved = 0;
        let charsFreed = 0;
        let done = false;
        setProgress((current) => ({ ...current, [phase.kind]: { moved, charsFreed, done } }));
        while (!done && !stopRef.current) {
          const res = await fetch("/api/admin/debate-cards/move-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: phase.kind, afterId, limit: phase.limit }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.details || data?.error || `Moving ${phase.label} failed`);
          moved += data.moved;
          charsFreed += data.charsFreed;
          afterId = data.nextAfterId;
          done = data.done;
          setProgress((current) => ({ ...current, [phase.kind]: { moved, charsFreed, done } }));
        }
        if (stopRef.current) break;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Move card search text to R2</CardTitle>
        <CardDescription>
          New Parquet imports store each card&apos;s full text and markup in the <code>CARD_TEXT</code> R2
          bucket, keeping only the card&apos;s metadata — tag, cite and highlighted text — in D1 so the
          database stays small. This moves what is still in D1 into R2: the text of cards imported before
          that (filling in the highlighted text from the markup where a card had none), then the HTML of
          the caselist speech documents card search lists as Outlines. Search reads it back from R2. Safe
          to stop and re-run — rows already moved are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleMove} disabled={isMoving} variant="outline">
            {isMoving ? "Moving…" : "Move card search text to R2"}
          </Button>
          {isMoving && (
            <Button
              onClick={() => {
                stopRef.current = true;
                setStopRequested(true);
              }}
              disabled={stopRequested}
              variant="ghost"
            >
              {stopRequested ? "Stopping…" : "Stop"}
            </Button>
          )}
        </div>
        {PHASES.map((phase) => {
          const step = progress[phase.kind];
          if (!step) return null;
          return (
            <span key={phase.kind} className="text-muted-foreground text-sm">
              Moved {step.moved.toLocaleString()} {phase.label}, {formatChars(step.charsFreed)} out of D1
              {step.done ? " (done)" : isMoving ? "…" : " (stopped)"}
            </span>
          );
        })}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
