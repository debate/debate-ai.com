"use client";

import { useRef, useState } from "react";
import { Button } from "@debate-ai/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@debate-ai/ui/primitives/card";

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
 * Moves the full text and markup of cards imported before the R2 split out
 * of D1 and into the CARD_TEXT bucket, one page per request
 * (apps/debate-web/app/api/admin/debate-cards/move-text/route.ts). D1 keeps
 * each card's metadata and highlighted text. Stoppable, and safe to re-run:
 * cards already moved are skipped.
 */
export function CardTextR2Panel() {
  const [isMoving, setIsMoving] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [progress, setProgress] = useState<MoveProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read inside the loop, which a state value captured at start would not see change.
  const stopRef = useRef(false);

  const handleMove = async () => {
    setIsMoving(true);
    setError(null);
    setStopRequested(false);
    stopRef.current = false;
    setProgress({ moved: 0, charsFreed: 0, done: false });
    try {
      let afterId = 0;
      let moved = 0;
      let charsFreed = 0;
      let done = false;
      while (!done && !stopRef.current) {
        const res = await fetch("/api/admin/debate-cards/move-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ afterId, limit: 200 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.details || data?.error || "Moving card text failed");
        moved += data.moved;
        charsFreed += data.charsFreed;
        afterId = data.nextAfterId;
        done = data.done;
        setProgress({ moved, charsFreed, done });
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
        <CardTitle>Move card text to R2</CardTitle>
        <CardDescription>
          New Parquet imports store each card&apos;s full text and markup in the <code>CARD_TEXT</code> R2
          bucket, keeping only the card&apos;s metadata and highlighted text in D1 so the database stays
          small. This moves the text of cards imported before that out of D1 and into R2, filling in the
          highlighted text from the markup where a card had none. Search reads the text back from R2.
          Safe to stop and re-run — cards already moved are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleMove} disabled={isMoving} variant="outline">
            {isMoving ? "Moving…" : "Move card text to R2"}
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
          {progress && (
            <span className="text-muted-foreground text-sm">
              Moved {progress.moved.toLocaleString()} cards, {formatChars(progress.charsFreed)} of text out of D1
              {progress.done ? " (done)" : isMoving ? "…" : " (stopped)"}
            </span>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
