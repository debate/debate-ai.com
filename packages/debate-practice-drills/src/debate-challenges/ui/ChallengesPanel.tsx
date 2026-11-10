"use client";

/**
 * @fileoverview Online Challenges — asynchronous written debates against
 * other players or the AI, on any listed resolution in any format, with XP,
 * win-streak boosts and trophies.
 *
 * One read (`GET /api/debate-challenges`) fills the page, top to bottom:
 *
 * 1. **Your record** — wins, losses, streak, the boost the next win gets, and
 *    XP earned from challenges.
 * 2. **Trophies** — the trophy case, earned ones lit.
 * 3. **New challenge** — `NewChallengeForm`.
 * 4. **Your turn** — rounds waiting on the viewer's speech, each with its
 *    response clock.
 * 5. **Waiting on your opponent** and **Finished** rounds.
 *
 * Finished rounds pay out automatically: each uncollected reward is claimed
 * (`PATCH … { action: "claim" }`, which the server allows once per debater, so
 * a second device can't collect it again) and then recorded as Debater Level
 * activity (`rewardActivities`).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, ChevronDown, Clock, Flag, Inbox, Loader2, Medal, Send, Sparkles, Swords, Trophy, X } from "lucide-react";

import { recordDebaterActivity } from "@debate-ai/community";
import { cn } from "@debate-ai/round/src/ui/lib/utils";
import { fetchChallengeBoard, sendDebateChallenge, updateDebateChallenge } from "../client";
import { formatBoost, rewardActivities } from "../rewards";
import {
  CHALLENGE_FORMATS,
  MAX_SPEECH_LENGTH,
  RESPONSE_WINDOW_DAYS,
  SPEECH_ORDER,
  challengeOptionLabel,
  type ChallengeBoardResponse,
  type DebateChallenge,
  type DebateChallengeAction,
  type NewDebateChallenge,
} from "../types";
import { NewChallengeForm, challengeInputClass } from "./NewChallengeForm";

type LoadState = "loading" | "ready" | "signed-out" | "error";

/** How many finished rounds to list. */
const FINISHED_SHOWN = 20;

function Block({ title, icon, children, description }: { title: string; icon: ReactNode; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold leading-none">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/** "2 days 4 hours left" / "5 hours left" / "less than an hour left". */
export function timeLeft(deadlineAt: number, nowSeconds: number): string {
  const seconds = deadlineAt - nowSeconds;
  if (seconds <= 0) return "time's up";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}${hours ? ` ${hours} hour${hours === 1 ? "" : "s"}` : ""} left`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  return "less than an hour left";
}

/** One line on where a challenge stands, from the viewer's side. */
export function challengeStatusLine(challenge: DebateChallenge, viewerId: string, nowSeconds: number): string {
  const opponent = challenge.challenger.id === viewerId ? challenge.opponent : challenge.challenger;
  const clock = challenge.deadlineAt ? ` · ${timeLeft(challenge.deadlineAt, nowSeconds)}` : "";
  switch (challenge.status) {
    case "pending":
      return challenge.turnId === viewerId ? `${opponent.name} challenged you${clock}` : `Waiting for ${opponent.name} to answer${clock}`;
    case "active":
      return challenge.turnId === viewerId ? `Your speech${clock}` : `Waiting on ${opponent.name}${clock}`;
    case "judging":
      return "All speeches in — the AI judge is deciding";
    case "complete": {
      const won = challenge.winnerSide === challenge.viewerSide;
      const how =
        challenge.decisionMethod === "forfeit"
          ? won
            ? " on a forfeit"
            : " (ran out of time)"
          : challenge.decisionMethod === "concession"
            ? won
              ? " — they conceded"
              : " — you conceded"
            : "";
      return `${won ? "You won" : "You lost"}${how}`;
    }
    case "declined":
      return "Declined";
    case "cancelled":
      return "Withdrawn";
    case "expired":
      return `No answer within ${RESPONSE_WINDOW_DAYS} days`;
  }
}

function ChallengeRow({
  challenge,
  viewerId,
  nowSeconds,
  onAction,
}: {
  challenge: DebateChallenge;
  viewerId: string;
  nowSeconds: number;
  onAction: (id: string, action: DebateChallengeAction, text?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(challenge.turnId === viewerId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<DebateChallengeAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opponent = challenge.challenger.id === viewerId ? challenge.opponent : challenge.challenger;
  const nextLabel = SPEECH_ORDER[challenge.speeches.length]?.label;
  const won = challenge.status === "complete" && challenge.winnerSide === challenge.viewerSide;

  async function run(action: DebateChallengeAction, speech?: string) {
    setBusy(action);
    setError(null);
    try {
      await onAction(challenge.id, action, speech);
      if (action === "speak") setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {challenge.vsAi ? <Bot className="size-4 shrink-0" aria-hidden="true" /> : <Swords className="size-4 shrink-0" aria-hidden="true" />}
            <span className="truncate">vs {opponent.name}</span>
            {challenge.status === "complete" ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  won ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground",
                )}
              >
                {won ? "Win" : "Loss"}
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {challengeOptionLabel(CHALLENGE_FORMATS, challenge.format)} · {challenge.viewerSide === "aff" ? "Aff" : "Neg"} · {challenge.topic}
          </span>
          <span className="text-xs text-muted-foreground">{challengeStatusLine(challenge, viewerId, nowSeconds)}</span>
        </span>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
          {challenge.note ? <p className="text-sm italic text-muted-foreground">“{challenge.note}”</p> : null}
          <ol className="flex flex-col gap-3">
            {challenge.speeches.map((speech, index) => (
              <li key={index} className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {SPEECH_ORDER[index]?.label}
                  {speech.side === challenge.viewerSide ? " · you" : ""}
                </span>
                <p className="whitespace-pre-wrap text-sm">{speech.text}</p>
              </li>
            ))}
          </ol>

          {challenge.status === "complete" && challenge.decision ? (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              <span className="font-medium">Judge’s decision: </span>
              {challenge.winnerSide === "aff" ? "Affirmative" : "Negative"}. {challenge.decision}
            </div>
          ) : null}

          {challenge.reward && challenge.reward.xp > 0 ? (
            <p className="flex items-center gap-1.5 text-sm">
              <Sparkles className="size-4 text-amber-500" aria-hidden="true" />+{challenge.reward.xp} XP
              {challenge.reward.boost > 1 ? ` (win-streak boost ${formatBoost(challenge.reward.boost)})` : ""}
            </p>
          ) : null}

          {challenge.moves.includes("speak") ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                {nextLabel ? `Your ${nextLabel.toLowerCase()}` : "Your speech"}
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={MAX_SPEECH_LENGTH}
                  rows={8}
                  className={challengeInputClass}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null || !text.trim()}
                  onClick={() => void run("speak", text)}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {busy === "speak" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  {challenge.status === "pending" ? "Accept and send speech" : "Send speech"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {challenge.moves.includes("decline") ? (
              <button type="button" disabled={busy !== null} onClick={() => void run("decline")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <X className="size-4" aria-hidden="true" /> Decline
              </button>
            ) : null}
            {challenge.moves.includes("cancel") ? (
              <button type="button" disabled={busy !== null} onClick={() => void run("cancel")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <X className="size-4" aria-hidden="true" /> Withdraw
              </button>
            ) : null}
            {challenge.moves.includes("concede") ? (
              <button type="button" disabled={busy !== null} onClick={() => void run("concede")} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                <Flag className="size-4" aria-hidden="true" /> Concede
              </button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export interface ChallengesPanelProps {
  /** Injected for tests; defaults to the API. */
  loadBoard?: () => Promise<ChallengeBoardResponse | null>;
  sendChallenge?: (challenge: NewDebateChallenge) => Promise<DebateChallenge>;
  updateChallenge?: (id: string, update: { action: DebateChallengeAction; text?: string }) => Promise<DebateChallenge>;
  /** Records Debater Level XP; defaults to `recordDebaterActivity`. */
  recordActivity?: (kind: "challenge_played" | "challenge_won" | "challenge_boost", count: number) => void;
}

const defaultRecordActivity: NonNullable<ChallengesPanelProps["recordActivity"]> = (kind, count) => {
  recordDebaterActivity(kind, count);
};

export function ChallengesPanel(props: ChallengesPanelProps) {
  // The injected calls live in a ref so a parent re-render (or the defaults
  // being new functions every render) never re-runs the load effect.
  const api = useRef(props);
  api.current = props;
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [board, setBoard] = useState<ChallengeBoardResponse | null>(null);
  const [collected, setCollected] = useState<number>(0);
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  const load = useCallback(async () => {
    const { loadBoard = fetchChallengeBoard, updateChallenge = updateDebateChallenge, recordActivity = defaultRecordActivity } =
      api.current;
    try {
      const next = await loadBoard();
      if (!next) {
        setLoadState("signed-out");
        return;
      }
      setBoard(next);
      setNowSeconds(Math.floor(Date.now() / 1000));
      setLoadState("ready");

      // Collect finished rounds' XP once per debater (the server refuses a second claim).
      let gained = 0;
      for (const challenge of next.challenges) {
        if (!challenge.moves.includes("claim") || !challenge.reward) continue;
        try {
          await updateChallenge(challenge.id, { action: "claim" });
        } catch {
          continue;
        }
        for (const activity of rewardActivities(challenge.reward)) recordActivity(activity.kind, activity.count);
        gained += challenge.reward.xp;
      }
      if (gained > 0) setCollected((total) => total + gained);
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = useCallback(
    async (challenge: NewDebateChallenge) => {
      const { sendChallenge = sendDebateChallenge } = api.current;
      await sendChallenge(challenge);
      await load();
    },
    [load],
  );

  const handleAction = useCallback(
    async (id: string, action: DebateChallengeAction, text?: string) => {
      const { updateChallenge = updateDebateChallenge } = api.current;
      await updateChallenge(id, { action, ...(text !== undefined ? { text } : {}) });
      await load();
    },
    [load],
  );

  if (loadState === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading your challenges…
      </div>
    );
  }
  if (loadState === "signed-out") {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm">
        <a href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </a>{" "}
        to challenge other players or the AI, earn XP and collect trophies.
      </p>
    );
  }
  if (loadState === "error" || !board) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your challenges.{" "}
        <button type="button" onClick={() => void load()} className="font-medium underline">
          Try again
        </button>
      </p>
    );
  }

  const viewerId = board.viewer.id;
  const yourTurn = board.challenges.filter((c) => c.turnId === viewerId);
  const waiting = board.challenges.filter((c) => c.turnId !== viewerId && (c.status === "pending" || c.status === "active" || c.status === "judging"));
  const finished = board.challenges
    .filter((c) => !["pending", "active", "judging"].includes(c.status))
    .slice(0, FINISHED_SHOWN);
  const { stats } = board;

  const list = (items: DebateChallenge[], empty: string) =>
    items.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="flex flex-col gap-2">
        {items.map((challenge) => (
          <ChallengeRow key={challenge.id} challenge={challenge} viewerId={viewerId} nowSeconds={nowSeconds} onAction={handleAction} />
        ))}
      </ul>
    );

  return (
    <div className="flex flex-col gap-4">
      <Block title="Your record" icon={<Medal className="size-4" />}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Wins", stats.wins],
            ["Losses", stats.losses],
            ["Win streak", stats.currentStreak],
            ["Next win boost", formatBoost(stats.nextBoost)],
            ["Challenge XP", stats.totalXp],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {collected > 0 ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300" role="status">
            <Sparkles className="size-4" aria-hidden="true" /> +{collected} XP added to your Debater Level
          </p>
        ) : null}
      </Block>

      <Block title="Trophies" icon={<Trophy className="size-4" />} description="Win challenges and build streaks to fill the case.">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {board.trophies.map((trophy) => (
            <li
              key={trophy.id}
              title={trophy.description}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center",
                trophy.earned ? "border-amber-500/50 bg-amber-500/10" : "border-border opacity-50 grayscale",
              )}
            >
              <span className="text-2xl" aria-hidden="true">
                {trophy.emoji}
              </span>
              <span className="text-xs font-semibold">{trophy.title}</span>
              <span className="text-[11px] text-muted-foreground">{trophy.description}</span>
              <span className="sr-only">{trophy.earned ? "Earned" : "Not earned yet"}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block
        title="New challenge"
        icon={<Swords className="size-4" />}
        description={`A written round: two constructives and two rebuttals. Each side has ${RESPONSE_WINDOW_DAYS} days to answer, and an AI judge decides.`}
      >
        <NewChallengeForm onSubmit={handleSend} />
      </Block>

      <Block title="Your turn" icon={<Inbox className="size-4" />}>
        {list(yourTurn, "Nothing waiting on you.")}
      </Block>

      <Block title="Waiting on your opponent" icon={<Clock className="size-4" />}>
        {list(waiting, "No rounds in progress.")}
      </Block>

      <Block title="Finished" icon={<Flag className="size-4" />}>
        {list(finished, "No finished rounds yet.")}
      </Block>
    </div>
  );
}

export default ChallengesPanel;
