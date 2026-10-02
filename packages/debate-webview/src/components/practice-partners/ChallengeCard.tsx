"use client";

/**
 * @fileoverview One practice challenge, as seen by someone in it (or a judge
 * who could pick it up): who is debating whom, the format and resolution, when,
 * who is judging, and the buttons for whatever the viewer may do next.
 *
 * The buttons come from `availableChallengeActions` — the same rules the API
 * enforces — so the card never offers something the server will refuse. Once
 * a round is accepted the card shows its webcam room code, which everyone in
 * the round pastes into the round workspace's Cameras panel.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Check, Copy, Gavel, Loader2, Video } from "lucide-react";
import { CommentAvatar } from "@debate/comments";

import { cn } from "../../lib/ui/lib/utils";
import { availableChallengeActions } from "../../lib/practice-partners/challenge-actions";
import {
  PRACTICE_FORMATS,
  optionLabel,
  type ChallengeAction,
  type ChallengeStatus,
  type PracticeChallenge,
} from "../../lib/practice-partners/types";

const ACTION_LABELS: Record<ChallengeAction, string> = {
  accept: "Accept",
  decline: "Decline",
  cancel: "Call off",
  "confirm-judge": "I'll judge",
  "decline-judge": "Can't judge",
  "volunteer-judge": "Judge this round",
  "withdraw-judge": "Step down as judge",
};

/** The actions that move a round forward get the filled button; the rest are outlined. */
const PRIMARY_ACTIONS = new Set<ChallengeAction>(["accept", "confirm-judge", "volunteer-judge"]);

const STATUS_STYLES: Record<ChallengeStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<ChallengeStatus, string> = {
  pending: "Waiting for an answer",
  accepted: "On",
  declined: "Declined",
  cancelled: "Called off",
};

/** "Sat, Oct 4, 7:00 PM" in the reader's own locale and time zone. */
export function formatProposedTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function headline(challenge: PracticeChallenge, viewerId: string): string {
  const { challenger, opponent } = challenge;
  if (challenger.id === viewerId) return `You challenged ${opponent.name}`;
  if (opponent.id === viewerId) return `${challenger.name} challenged you`;
  return `${challenger.name} vs ${opponent.name}`;
}

export interface ChallengeCardProps {
  challenge: PracticeChallenge;
  viewerId: string;
  viewerIsJudgeVolunteer: boolean;
  /** Resolves once the action is stored; rejects with a message fit to show. */
  onAction: (challengeId: string, action: ChallengeAction) => Promise<void>;
}

export function ChallengeCard({ challenge, viewerId, viewerIsJudgeVolunteer, onAction }: ChallengeCardProps) {
  const [busy, setBusy] = useState<ChallengeAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actions = availableChallengeActions(challenge, viewerId, viewerIsJudgeVolunteer);
  const other = challenge.challenger.id === viewerId ? challenge.opponent : challenge.challenger;
  const closed = challenge.status === "declined" || challenge.status === "cancelled";

  async function run(action: ChallengeAction) {
    setBusy(action);
    setError(null);
    try {
      await onAction(challenge.id, action);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update that challenge.");
    } finally {
      setBusy(null);
    }
  }

  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(challenge.roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the code is on screen to copy by hand.
    }
  }

  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border border-border bg-background p-3", closed && "opacity-70")}>
      <div className="flex items-start gap-3">
        <CommentAvatar name={other.name} imageUrl={other.imageUrl} seed={other.id} className="mt-0.5 h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{headline(challenge, viewerId)}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[challenge.status])}>
              {STATUS_LABELS[challenge.status]}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-foreground">
            <span className="font-medium">{optionLabel(PRACTICE_FORMATS, challenge.format)}</span>
            <span className="text-muted-foreground"> · </span>
            {challenge.topic}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {challenge.proposedAt ? formatProposedTime(challenge.proposedAt) : "Time to be arranged"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
              {challenge.judge
                ? `${challenge.judge.id === viewerId ? "You" : challenge.judge.name}${
                    challenge.judgeStatus === "invited" ? " (invited)" : ""
                  }`
                : "No judge yet"}
            </span>
          </div>
          {challenge.message ? (
            <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-muted/50 px-2.5 py-1.5 text-xs leading-5 text-foreground">
              {challenge.message}
            </p>
          ) : null}
        </div>
      </div>

      {challenge.status === "accepted" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 text-xs">
          <Video className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <span className="text-muted-foreground">Room code</span>
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">{challenge.roomId}</code>
          <button
            type="button"
            onClick={copyRoom}
            className="inline-flex h-6 items-center gap-1 rounded border border-border bg-background px-1.5 font-medium hover:bg-accent"
          >
            {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <Link
            href="/debate"
            className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Open round workspace
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
          <p className="basis-full text-muted-foreground">
            Everyone joins the same room from the round workspace&rsquo;s Cameras panel — debaters as Debater, the judge as Judge.
          </p>
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy !== null}
              onClick={() => run(action)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-50",
                PRIMARY_ACTIONS.has(action)
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              {busy === action ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}
