"use client";

/**
 * @fileoverview Rebuttal Redos — the Practice Drills tab panel where judges
 * hand out redos after a round and debaters turn them in.
 *
 * - **Judges** see the rounds in their round workspace where they are listed
 *   as a judge. The newest one without redos is drafted automatically when
 *   the panel opens (one AI call per round); older ones have a button. Each
 *   draft shows the AI's assignment, a comments box for the judge's own
 *   instructions, the speech time and due date; **Assign** sends it to the
 *   debater. Turned-in redos land in a review queue with the recording, the
 *   outline, a 1–5 rating and feedback.
 * - **Debaters** see what they were assigned, record the redo against the
 *   speech time, add an outline, and turn it in. Fiat points and badges are
 *   counted from their redos on the server.
 *
 * @module debate-practice-rounds/rebuttal-redos/ui/RebuttalRedosPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Award, CheckCircle2, ClipboardList, Gavel, Loader2, Send, Sparkles, Star } from "lucide-react";
import { recordDebaterActivity } from "@debate-ai/community";
import { getBulkItem, hydrateBulkStorage } from "@debate-ai/research-evidence/src/account-sync/bulk-storage";
import { cn } from "@debate-ai/round/src/ui/lib/utils";
import { fetchRedoBoard, generateRoundRedos, redoAudioUrl, updateRedo, uploadRedoAudio } from "../client";
import { buildRedoRound, isRoundJudge, redoRoundTitle, type RedoSourceFlow, type RedoSourceRound } from "../round-input";
import { MAX_JUDGE_TEXT, MAX_SUBMISSION_TEXT, type RebuttalRedo, type RedoBoardResponse, type RedoUpdate } from "../types";
import { RedoRecorder, formatClock } from "./RedoRecorder";

type LoadState = "loading" | "ready" | "signed-out" | "error";

/** sessionStorage key: round keys already auto-drafted this session, so a failure doesn't retry on every render. */
const AUTO_DRAFTED_KEY = "rebuttalRedosAutoDrafted";
/** Only rounds from the last two weeks are drafted automatically. */
const AUTO_DRAFT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const SIDE_LABEL = { aff: "Aff", neg: "Neg" } as const;

function readAutoDrafted(): string[] {
  try {
    const raw = sessionStorage.getItem(AUTO_DRAFTED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function rememberAutoDrafted(roundId: string): void {
  try {
    sessionStorage.setItem(AUTO_DRAFTED_KEY, JSON.stringify([...readAutoDrafted(), roundId].slice(-50)));
  } catch {
    // Storage blocked: at worst the round is drafted again next visit, which the API dedupes.
  }
}

export async function loadLocalRounds(): Promise<{ rounds: RedoSourceRound[]; flows: RedoSourceFlow[] }> {
  try {
    await hydrateBulkStorage();
    const rounds = JSON.parse(getBulkItem("rounds") ?? "[]") as unknown;
    const flows = JSON.parse(getBulkItem("flows") ?? "[]") as unknown;
    return {
      rounds: Array.isArray(rounds) ? (rounds as RedoSourceRound[]) : [],
      flows: Array.isArray(flows) ? (flows as RedoSourceFlow[]) : [],
    };
  } catch {
    return { rounds: [], flows: [] };
  }
}

function dueLine(redo: RebuttalRedo): string {
  if (redo.dueAt === null) return "No due date";
  const date = new Date(redo.dueAt * 1000);
  return `Due ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function Block({ id, title, icon, description, children }: { id?: string; title: string; icon: ReactNode; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
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

function Stars({ value, onChange, label }: { value: number; onChange?: (value: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : "img"} aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = <Star className={cn("h-4 w-4", star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} aria-hidden="true" />;
        return onChange ? (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onClick={() => onChange(star)}
            className="rounded p-0.5 hover:bg-muted"
          >
            {icon}
          </button>
        ) : (
          <span key={star}>{icon}</span>
        );
      })}
    </div>
  );
}

function Instructions({ redo }: { redo: RebuttalRedo }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {redo.judgeInstructions ? (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-1 flex items-center gap-1 text-xs font-medium">
            <Gavel className="h-3.5 w-3.5" aria-hidden="true" /> From {redo.judge.name}
          </p>
          <p className="whitespace-pre-wrap">{redo.judgeInstructions}</p>
        </div>
      ) : null}
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <p className="mb-1 flex items-center gap-1 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI assignment
        </p>
        <p className="whitespace-pre-wrap">{redo.aiInstructions}</p>
      </div>
    </div>
  );
}

/** The calls the panel makes; swappable in tests. */
export interface RedoPanelDeps {
  loadBoard: typeof fetchRedoBoard;
  generate: typeof generateRoundRedos;
  update: typeof updateRedo;
  upload: typeof uploadRedoAudio;
  loadRounds: typeof loadLocalRounds;
  recordActivity: (kind: "rebuttal_redo") => void;
}

const DEFAULT_DEPS: RedoPanelDeps = {
  loadBoard: fetchRedoBoard,
  generate: generateRoundRedos,
  update: updateRedo,
  upload: uploadRedoAudio,
  loadRounds: loadLocalRounds,
  recordActivity: (kind) => void recordDebaterActivity(kind),
};

function useRedoAction(onChange: (redo: RebuttalRedo) => void, deps: RedoPanelDeps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (redo: RebuttalRedo, update: RedoUpdate, before?: () => Promise<void>) => {
    setBusy(update.action);
    setError(null);
    try {
      if (before) await before();
      const next = await deps.update(redo.id, update);
      onChange(next);
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

interface CardProps {
  redo: RebuttalRedo;
  onChange: (redo: RebuttalRedo) => void;
  deps: RedoPanelDeps;
}

// ── Debater ────────────────────────────────────────────────────────────────

function AssignmentCard({ redo, onChange, deps }: CardProps) {
  const [outline, setOutline] = useState(redo.submissionText);
  const [audio, setAudio] = useState<Blob | null>(null);
  const { busy, error, run } = useRedoAction(onChange, deps);
  const canSubmit = redo.status === "assigned" || redo.status === "submitted";

  const submit = async () => {
    const firstTime = redo.status === "assigned";
    const next = await run(redo, { action: "submit", submissionText: outline }, audio ? () => deps.upload(redo.id, audio) : undefined);
    if (next && firstTime) deps.recordActivity("rebuttal_redo");
    if (next) setAudio(null);
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="rebuttal-redo-assignment">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {SIDE_LABEL[redo.side]} {redo.speech} · {formatClock(redo.timeLimitSeconds)} · {dueLine(redo)}
          </p>
          <p className="truncate text-sm font-medium">{redo.roundTitle}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {redo.status === "assigned" ? "To do" : redo.status === "submitted" ? "Waiting for review" : `Reviewed · +${redo.fiatPoints} fiat`}
        </span>
      </div>
      <Instructions redo={redo} />

      {redo.status === "reviewed" ? (
        <div className="flex flex-col gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium">Feedback from {redo.judge.name}</p>
            <Stars value={redo.rating ?? 0} label={`Rated ${redo.rating ?? 0} of 5`} />
          </div>
          <p className="whitespace-pre-wrap">{redo.feedback}</p>
        </div>
      ) : null}

      {canSubmit ? (
        <div className="flex flex-col gap-2">
          <RedoRecorder timeLimitSeconds={redo.timeLimitSeconds} onRecorded={setAudio} disabled={busy !== null} />
          {redo.hasAudio && !audio ? (
            <audio controls src={redoAudioUrl(redo.id)} className="h-9 w-full" aria-label="Your turned-in recording" />
          ) : null}
          <label className="text-xs font-medium" htmlFor={`redo-outline-${redo.id}`}>
            Outline or transcript (optional with a recording)
          </label>
          <textarea
            id={`redo-outline-${redo.id}`}
            value={outline}
            maxLength={MAX_SUBMISSION_TEXT}
            onChange={(event) => setOutline(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div>
            <button
              type="button"
              disabled={busy !== null || (!audio && !redo.hasAudio && !outline.trim())}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {redo.status === "submitted" ? "Turn in again" : "Turn in redo"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

// ── Judge ──────────────────────────────────────────────────────────────────

function DraftCard({ redo, onChange, deps }: CardProps) {
  const [comments, setComments] = useState(redo.judgeInstructions);
  const [minutes, setMinutes] = useState(Math.round(redo.timeLimitSeconds / 60));
  const [dueDays, setDueDays] = useState<number | null>(redo.dueAt === null ? null : Math.max(1, Math.round((redo.dueAt * 1000 - Date.now()) / 86_400_000)));
  const { busy, error, run } = useRedoAction(onChange, deps);

  const editFields = (): RedoUpdate => ({ action: "edit", judgeInstructions: comments, timeLimitSeconds: minutes * 60, dueInDays: dueDays });
  const save = (then?: RedoUpdate) =>
    run(redo, then ?? editFields(), then ? async () => void (await deps.update(redo.id, editFields())) : undefined);

  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", redo.status === "skipped" && "opacity-60")} data-testid="rebuttal-redo-draft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {redo.student.name} <span className="font-normal text-muted-foreground">· {SIDE_LABEL[redo.side]} {redo.speech}</span>
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {redo.status === "draft" ? "Draft" : redo.status === "assigned" ? "Assigned" : "Skipped"}
          {!redo.student.id ? " · no account yet" : ""}
        </span>
      </div>
      <details open={redo.status === "draft"}>
        <summary className="cursor-pointer text-xs text-muted-foreground">AI assignment</summary>
        <p className="mt-1 whitespace-pre-wrap text-sm">{redo.aiInstructions}</p>
      </details>
      <label className="text-xs font-medium" htmlFor={`redo-comments-${redo.id}`}>
        Your instructions for {redo.student.name}
      </label>
      <textarea
        id={`redo-comments-${redo.id}`}
        value={comments}
        maxLength={MAX_JUDGE_TEXT}
        placeholder="What to fix, what to go for, how many times to run it…"
        onChange={(event) => setComments(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          Speech time
          <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="rounded-md border border-input bg-background px-1 py-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
              <option key={value} value={value}>
                {value} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          Due in
          <select
            value={dueDays ?? 0}
            onChange={(event) => setDueDays(Number(event.target.value) || null)}
            className="rounded-md border border-input bg-background px-1 py-0.5"
          >
            {[1, 2, 3, 5, 7, 10, 14, 21, 30].map((value) => (
              <option key={value} value={value}>
                {value} day{value === 1 ? "" : "s"}
              </option>
            ))}
            <option value={0}>No due date</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {redo.status !== "assigned" ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void save({ action: "assign" })}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy === "assign" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Assign
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void save()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {busy === "edit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save changes
          </button>
        )}
        {redo.status !== "skipped" ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run(redo, { action: "skip" })}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Skip this debater
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ReviewCard({ redo, onChange, deps }: CardProps) {
  const [feedback, setFeedback] = useState(redo.feedback);
  const [rating, setRating] = useState(redo.rating ?? 0);
  const { busy, error, run } = useRedoAction(onChange, deps);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3" data-testid="rebuttal-redo-review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {redo.roundTitle} · turned in {redo.submittedAt ? new Date(redo.submittedAt * 1000).toLocaleDateString() : ""}
          </p>
          <p className="text-sm font-medium">
            {redo.student.name} <span className="font-normal text-muted-foreground">· {SIDE_LABEL[redo.side]} {redo.speech}</span>
          </p>
        </div>
        {redo.status === "reviewed" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Reviewed
          </span>
        ) : null}
      </div>
      {redo.hasAudio ? <audio controls src={redoAudioUrl(redo.id)} className="h-9 w-full" aria-label={`${redo.student.name}'s redo`} /> : null}
      {redo.submissionText ? (
        <details open={!redo.hasAudio}>
          <summary className="cursor-pointer text-xs text-muted-foreground">Outline</summary>
          <p className="mt-1 whitespace-pre-wrap text-sm">{redo.submissionText}</p>
        </details>
      ) : null}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">What you assigned</summary>
        <div className="mt-1">
          <Instructions redo={redo} />
        </div>
      </details>
      <Stars value={rating} onChange={setRating} label="Rate this redo" />
      <textarea
        aria-label={`Feedback for ${redo.student.name}`}
        value={feedback}
        maxLength={MAX_JUDGE_TEXT}
        placeholder="What improved, and what to work on next"
        onChange={(event) => setFeedback(event.target.value)}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div>
        <button
          type="button"
          disabled={busy !== null || !feedback.trim() || rating < 1}
          onClick={() => void run(redo, { action: "review", feedback, rating })}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {redo.status === "reviewed" ? "Update feedback" : "Send feedback"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

export interface RebuttalRedosPanelProps extends Partial<RedoPanelDeps> {
  className?: string;
}

export function RebuttalRedosPanel({ className, ...overrides }: RebuttalRedosPanelProps) {
  const depsRef = useRef<RedoPanelDeps>({ ...DEFAULT_DEPS, ...overrides });
  const deps = depsRef.current;
  const [state, setState] = useState<LoadState>("loading");
  const [board, setBoard] = useState<RedoBoardResponse | null>(null);
  const [local, setLocal] = useState<{ rounds: RedoSourceRound[]; flows: RedoSourceFlow[] }>({ rounds: [], flows: [] });
  const [drafting, setDrafting] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const reload = useCallback(async () => {
    try {
      const next = await deps.loadBoard();
      setBoard(next);
      setState(next ? "ready" : "signed-out");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void reload();
    void deps.loadRounds().then(setLocal);
  }, [reload]);

  const replace = useCallback((redo: RebuttalRedo) => {
    setBoard((current) => {
      if (!current) return current;
      const swap = (list: RebuttalRedo[]) => list.map((item) => (item.id === redo.id ? { ...redo, viewerRole: item.viewerRole } : item));
      return { ...current, assignments: swap(current.assignments), judging: swap(current.judging) };
    });
    // Fiat points are counted on the server.
    if (redo.viewerRole === "student") void reload();
  }, [reload]);

  const draftedRoundIds = useMemo(
    () => new Set((board?.judging ?? []).map((redo) => redo.roundKey.slice(redo.roundKey.indexOf(":") + 1))),
    [board],
  );

  const judgedRounds = useMemo(() => {
    if (!board) return [];
    return local.rounds
      .filter((round) => isRoundJudge(round, board.viewer.email))
      .filter((round) => [...(round.debaters?.aff ?? []), ...(round.debaters?.neg ?? [])].some((email) => email?.trim()))
      .sort((a, b) => Number((b as { timestamp?: number }).timestamp ?? 0) - Number((a as { timestamp?: number }).timestamp ?? 0));
  }, [board, local.rounds]);

  const draftRound = useCallback(
    async (round: RedoSourceRound) => {
      const roundId = String(round.id);
      setDrafting(roundId);
      setDraftError(null);
      try {
        await deps.generate(buildRedoRound(round, local.flows));
        await reload();
      } catch (caught) {
        setDraftError(caught instanceof Error ? caught.message : "Could not draft redos for this round.");
      } finally {
        setDrafting(null);
      }
    },
    [local.flows, reload],
  );

  // After a round: draft the newest judged round automatically, once.
  useEffect(() => {
    if (autoRan.current || state !== "ready" || judgedRounds.length === 0) return;
    autoRan.current = true;
    const tried = new Set(readAutoDrafted());
    const newest = judgedRounds.find((round) => {
      const timestamp = Number((round as { timestamp?: number }).timestamp ?? 0);
      return !draftedRoundIds.has(String(round.id)) && !tried.has(String(round.id)) && Date.now() - timestamp < AUTO_DRAFT_WINDOW_MS;
    });
    if (!newest) return;
    rememberAutoDrafted(String(newest.id));
    void draftRound(newest);
  }, [state, judgedRounds, draftedRoundIds, draftRound]);

  const undraftedRounds = judgedRounds.filter((round) => !draftedRoundIds.has(String(round.id)));
  const drafts = (board?.judging ?? []).filter((redo) => redo.status === "draft" || redo.status === "assigned" || redo.status === "skipped");
  const reviewQueue = (board?.judging ?? []).filter((redo) => redo.status === "submitted");
  const reviewed = (board?.judging ?? []).filter((redo) => redo.status === "reviewed");
  const draftsByRound = new Map<string, RebuttalRedo[]>();
  for (const redo of drafts) draftsByRound.set(redo.roundKey, [...(draftsByRound.get(redo.roundKey) ?? []), redo]);

  const assignAll = async (redos: RebuttalRedo[]) => {
    for (const redo of redos.filter((item) => item.status === "draft")) {
      try {
        replace(await deps.update(redo.id, { action: "assign" }));
      } catch (caught) {
        setDraftError(caught instanceof Error ? caught.message : "Could not assign every redo.");
        return;
      }
    }
  };

  return (
    <div id="rebuttal-redos" className={cn("flex flex-col gap-4", className)}>
      <Block
        title="Rebuttal Redos"
        icon={<ClipboardList className="h-4 w-4" />}
        description="After each round, judges send every debater an AI-drafted assignment to redo their last rebuttal, with their own instructions. Record the redo, turn it in, and get the judge's feedback — and fiat points — days later."
      >
        {state === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your redos…
          </p>
        ) : null}
        {state === "signed-out" ? <p className="text-sm text-muted-foreground">Sign in to get rebuttal redos from your judges, or to assign them.</p> : null}
        {state === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            Could not load your rebuttal redos.
          </p>
        ) : null}

        {board ? (
          <div className="flex flex-col gap-3" data-testid="fiat-summary">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-2xl font-semibold tabular-nums">
                {board.fiat.points} <span className="text-sm font-normal text-muted-foreground">fiat points</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {board.fiat.submitted} turned in · {board.fiat.reviewed} reviewed
              </p>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Fiat badges">
              {board.fiat.badges.map((badge) => (
                <li
                  key={badge.id}
                  title={`${badge.description} (${badge.progress}/${badge.target})`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
                    badge.earned ? "border-amber-400/60 bg-amber-400/10 font-medium" : "border-border text-muted-foreground",
                  )}
                  data-earned={badge.earned}
                >
                  <Award className={cn("h-3.5 w-3.5", badge.earned ? "text-amber-500" : "")} aria-hidden="true" />
                  {badge.title}
                  {!badge.earned ? <span className="tabular-nums">{badge.progress}/{badge.target}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Block>

      {board && board.assignments.length > 0 ? (
        <Block title="Your redos" icon={<Send className="h-4 w-4" />} description="Each redo is worth 10 fiat points, 5 more on time, and 5 per star the judge gives it.">
          <ul className="flex flex-col gap-3">
            {board.assignments.map((redo) => (
              <AssignmentCard key={redo.id} redo={redo} onChange={replace} deps={deps} />
            ))}
          </ul>
        </Block>
      ) : null}

      {board && (judgedRounds.length > 0 || board.judging.length > 0) ? (
        <Block
          title="Redos you assign"
          icon={<Gavel className="h-4 w-4" />}
          description="Rounds where you're listed as a judge. The newest is drafted for you; edit each assignment, add your own instructions, then assign."
        >
          {reviewQueue.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">To review ({reviewQueue.length})</h3>
              <ul className="flex flex-col gap-3">
                {reviewQueue.map((redo) => (
                  <ReviewCard key={redo.id} redo={redo} onChange={replace} deps={deps} />
                ))}
              </ul>
            </div>
          ) : null}

          {[...draftsByRound.entries()].map(([roundKey, redos]) => (
            <div key={roundKey} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{redos[0]?.roundTitle}</h3>
                {redos.some((redo) => redo.status === "draft") ? (
                  <button
                    type="button"
                    onClick={() => void assignAll(redos)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Assign all drafts
                  </button>
                ) : null}
              </div>
              <ul className="flex flex-col gap-3">
                {redos.map((redo) => (
                  <DraftCard key={redo.id} redo={redo} onChange={replace} deps={deps} />
                ))}
              </ul>
            </div>
          ))}

          {undraftedRounds.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Other rounds you judged</h3>
              <ul className="flex flex-col gap-2">
                {undraftedRounds.slice(0, 10).map((round) => (
                  <li key={String(round.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                    <span className="min-w-0 truncate">{redoRoundTitle(round)}</span>
                    <button
                      type="button"
                      disabled={drafting !== null}
                      onClick={() => void draftRound(round)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {drafting === String(round.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Draft redos
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {drafting ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Drafting rebuttal redos from your flow…
            </p>
          ) : null}
          {draftError ? (
            <p className="text-xs text-destructive" role="alert">
              {draftError}
            </p>
          ) : null}

          {reviewed.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Reviewed ({reviewed.length})</summary>
              <ul className="mt-2 flex flex-col gap-3">
                {reviewed.map((redo) => (
                  <ReviewCard key={redo.id} redo={redo} onChange={replace} deps={deps} />
                ))}
              </ul>
            </details>
          ) : null}
        </Block>
      ) : null}
    </div>
  );
}
