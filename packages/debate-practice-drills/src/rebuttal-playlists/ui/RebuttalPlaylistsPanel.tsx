"use client";

/**
 * @fileoverview Rebuttal Playlists — ten curated playlists of the most-watched
 * finals, elims and style rounds (by format, level and style). For each round
 * the student redoes the Aff or Neg final rebuttal, paired with another
 * student on the other side (or the AI), with AI coach help on their draft;
 * the AI judge decides whose rebuttal was stronger. A rank ladder and a
 * per-playlist progress chart track how much of each playlist is done.
 *
 * One read (`GET /api/rebuttal-drills`) fills the page:
 *
 * 1. **Your progress** — rank, rebuttals turned in, wins, and the chart.
 * 2. **Your drills** — open drills first (write, ask the coach, turn in), then judged ones.
 * 3. **Playlists** — filterable cards; opening one lists its ten rounds with
 *    Redo Aff / Redo Neg and how many students are waiting on each side.
 *
 * Signed out, the playlists and videos still show; starting a drill asks the
 * reader to sign in.
 *
 * @module debate-practice-rounds/rebuttal-playlists/ui/RebuttalPlaylistsPanel
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bot, CheckCircle2, ChevronLeft, ListVideo, Loader2, PlayCircle, Send, Sparkles, Trophy, Users, X } from "lucide-react";

import { recordDebaterActivity } from "@debate-ai/community";
import { cn } from "@debate-ai/round/src/ui/lib/utils";
import { fetchRebuttalBoard, startRebuttalDrill, updateRebuttalDrill } from "../client";
import { PLAYLIST_LEVEL_LABELS, REBUTTAL_PLAYLISTS, findPlaylist, findPlaylistVideo } from "../playlists";
import { allPlaylistProgress, rebuttalRank, totalRebuttals } from "../progress";
import { lastRebuttalName } from "../prompts";
import {
  MAX_REBUTTAL_LENGTH,
  PARTNER_WAIT_DAYS,
  type DrillSide,
  type PlaylistLevel,
  type PlaylistVideo,
  type RebuttalBoardResponse,
  type RebuttalDrill,
  type RebuttalDrillUpdate,
  type RebuttalPlaylist,
} from "../types";
import { PlaylistProgressChart } from "./PlaylistProgressChart";

type LoadState = "loading" | "ready" | "signed-out" | "error";

/** localStorage key holding drill ids whose win already paid Debater Level XP. */
const PAID_WINS_KEY = "rebuttalDrillPaidWins";

const SIDE_LABEL: Record<DrillSide, string> = { aff: "Aff", neg: "Neg" };

function Block({ title, icon, description, children }: { title: string; icon: ReactNode; description?: string; children: ReactNode }) {
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

function readPaidWins(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(PAID_WINS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writePaidWins(ids: Set<string>): void {
  try {
    globalThis.localStorage?.setItem(PAID_WINS_KEY, JSON.stringify([...ids].slice(-500)));
  } catch {
    // Storage blocked: a win may pay twice across reloads, which is harmless.
  }
}

/** One line on where a drill stands, from the viewer's side. */
export function drillStatusLine(drill: RebuttalDrill): string {
  const mine = drill.viewerSide === "aff" ? drill.aff : drill.neg;
  const theirs = drill.viewerSide === "aff" ? drill.neg : drill.aff;
  switch (drill.status) {
    case "waiting":
      return mine.submitted
        ? "Your rebuttal is in — waiting for a partner on the other side."
        : `Waiting for a partner to take ${SIDE_LABEL[theirs.side]} — write yours meanwhile.`;
    case "writing":
      if (!mine.submitted) return `${theirs.person?.name ?? "Your partner"} ${theirs.submitted ? "has turned theirs in" : "is writing"} — your turn.`;
      return `Waiting on ${theirs.person?.name ?? "your partner"}'s rebuttal.`;
    case "judging":
      return "Both rebuttals are in — the AI judge is deciding.";
    case "complete":
      return drill.winnerSide === drill.viewerSide ? "You won this drill." : "The judge gave this one to the other side.";
    case "cancelled":
      return "Cancelled.";
  }
}

function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-muted" style={{ aspectRatio: "16 / 9" }}>
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
        title={title}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

interface DrillCardProps {
  drill: RebuttalDrill;
  onUpdate: (id: string, update: RebuttalDrillUpdate) => Promise<string | null>;
}

function DrillCard({ drill, onUpdate }: DrillCardProps) {
  const video = findPlaylistVideo(drill.playlistId, drill.videoId);
  const playlist = findPlaylist(drill.playlistId);
  const mine = drill.viewerSide === "aff" ? drill.aff : drill.neg;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const open = drill.status === "waiting" || drill.status === "writing";
  const speech = lastRebuttalName(drill.format, drill.viewerSide);

  const run = async (update: RebuttalDrillUpdate) => {
    setBusy(update.action);
    setError(null);
    try {
      const feedback = await onUpdate(drill.id, update);
      if (update.action === "coach") setCoach(feedback);
      if (update.action === "submit") setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3" data-testid="rebuttal-drill">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {playlist ? `${playlist.emoji} ${playlist.title} · ` : ""}You redo the {SIDE_LABEL[drill.viewerSide]} {speech}
            {drill.vsAi ? " · vs AI" : ""}
          </p>
          <p className="truncate text-sm font-medium">{drill.topic}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{drillStatusLine(drill)}</p>
        </div>
        <button
          type="button"
          onClick={() => setWatching((value) => !value)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> {watching ? "Hide round" : "Watch round"}
        </button>
      </div>
      {watching ? <YouTubeEmbed videoId={drill.videoId} title={video?.title ?? drill.topic} /> : null}

      {open && !mine.submitted ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" htmlFor={`rebuttal-${drill.id}`}>
            Your {SIDE_LABEL[drill.viewerSide]} {speech}
          </label>
          <textarea
            id={`rebuttal-${drill.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_REBUTTAL_LENGTH}
            rows={8}
            placeholder="Collapse to what wins, answer their best argument, and weigh. Write it as you'd say it."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {coach ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
              <p className="mb-1 flex items-center gap-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI coach
              </p>
              <p className="whitespace-pre-wrap">{coach}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || !draft.trim()}
              onClick={() => run({ action: "submit", text: draft })}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Turn in rebuttal
            </button>
            <button
              type="button"
              disabled={busy !== null || !draft.trim() || !drill.moves.includes("coach")}
              onClick={() => run({ action: "coach", text: draft })}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {busy === "coach" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Ask the AI coach ({mine.coachLeft} left)
            </button>
          </div>
        </div>
      ) : null}

      {open && mine.submitted && mine.text ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Your rebuttal</summary>
          <p className="mt-1 whitespace-pre-wrap">{mine.text}</p>
        </details>
      ) : null}

      {drill.status === "complete" ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="flex items-center gap-1 font-medium">
            <Trophy className="h-4 w-4" aria-hidden="true" /> {SIDE_LABEL[drill.winnerSide ?? "aff"]} wins
            {drill.winnerSide === drill.viewerSide ? " — that's you" : ""}
          </p>
          {drill.decision ? <p className="whitespace-pre-wrap text-muted-foreground">{drill.decision}</p> : null}
          {(["aff", "neg"] as const).map((side) => {
            const seat = drill[side];
            return seat.text ? (
              <details key={side}>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {SIDE_LABEL[side]} — {seat.person?.name ?? "Debater"}
                </summary>
                <p className="mt-1 whitespace-pre-wrap">{seat.text}</p>
              </details>
            ) : null;
          })}
        </div>
      ) : null}

      {drill.moves.includes("use_ai") || drill.moves.includes("cancel") ? (
        <div className="flex flex-wrap gap-2">
          {drill.moves.includes("use_ai") ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run({ action: "use_ai" })}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
            >
              <Bot className="h-3.5 w-3.5" aria-hidden="true" /> Don't wait — debate the AI
            </button>
          ) : null}
          {drill.moves.includes("cancel") ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run({ action: "cancel" })}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
            </button>
          ) : null}
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

interface VideoRowProps {
  playlist: RebuttalPlaylist;
  video: PlaylistVideo;
  index: number;
  done: Record<DrillSide, boolean>;
  waiting: Record<DrillSide, number>;
  canStart: boolean;
  onStart: (video: PlaylistVideo, side: DrillSide, partner: "partner" | "ai") => Promise<void>;
}

function VideoRow({ playlist, video, index, done, waiting, canStart, onStart }: VideoRowProps) {
  const [side, setSide] = useState<DrillSide | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (partner: "partner" | "ai") => {
    if (!side) return;
    setBusy(true);
    setError(null);
    try {
      await onStart(video, side, partner);
      setSide(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the drill.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center">
      <a href={`/videos/${video.videoId}`} className="shrink-0" aria-label={`Watch ${video.title}`}>
        <img
          src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-auto w-full rounded-md sm:w-32"
        />
      </a>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          #{index + 1} · {video.tournament} {video.round}
          {video.season > 0 ? ` · ${video.season}` : ""}
          {video.lastRebuttal ? ` · went for ${video.lastRebuttal}` : ""}
        </p>
        <p className="truncate text-sm font-medium">
          {video.affTeam} <span className="text-muted-foreground">vs</span> {video.negTeam}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          {(["aff", "neg"] as const).map((s) => (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                done[s] ? "border-primary/40 bg-primary/10" : "border-border text-muted-foreground",
              )}
            >
              {done[s] ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : null}
              {SIDE_LABEL[s]} {lastRebuttalName(video.format, s)}
              {waiting[s] > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-primary" title={`${waiting[s]} waiting for a ${SIDE_LABEL[s]} partner`}>
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {waiting[s]}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:items-end">
        {side === null ? (
          <div className="flex gap-1.5">
            {(["aff", "neg"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                disabled={!canStart}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Redo {SIDE_LABEL[s]}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => start("partner")}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {waiting[side] > 0 ? "Join a waiting student" : "Find a student partner"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => start("ai")}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-50"
            >
              <Bot className="h-3.5 w-3.5" aria-hidden="true" /> Vs AI
            </button>
            <button type="button" onClick={() => setSide(null)} className="px-1 text-xs text-muted-foreground" aria-label="Back">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {!canStart ? <p className="text-xs text-muted-foreground">Sign in to start</p> : null}
      </div>
      <span className="sr-only">{playlist.title}</span>
    </li>
  );
}

export interface RebuttalPlaylistsPanelProps {
  className?: string;
  /** Records Debater Level XP; defaults to `recordDebaterActivity`. */
  recordActivity?: (kind: "rebuttal_redo" | "practice_win", count: number) => void;
  /** Injected for tests; default to the `/api/rebuttal-drills` client. */
  loadBoard?: typeof fetchRebuttalBoard;
  startDrill?: typeof startRebuttalDrill;
  updateDrill?: typeof updateRebuttalDrill;
}

export function RebuttalPlaylistsPanel({
  className,
  recordActivity = recordDebaterActivity,
  loadBoard = fetchRebuttalBoard,
  startDrill = startRebuttalDrill,
  updateDrill = updateRebuttalDrill,
}: RebuttalPlaylistsPanelProps) {
  const [load, setLoad] = useState<LoadState>("loading");
  const [board, setBoard] = useState<RebuttalBoardResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [level, setLevel] = useState<PlaylistLevel | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadBoard();
      if (!next) {
        setLoad("signed-out");
        return;
      }
      setBoard(next);
      setLoad("ready");
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Could not load your drills.");
      setLoad("error");
    }
  }, [loadBoard]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const drills = useMemo(() => board?.drills ?? [], [board]);

  // Pay Debater Level XP once for each newly seen win.
  useEffect(() => {
    const wins = drills.filter((drill) => drill.status === "complete" && drill.winnerSide === drill.viewerSide);
    if (wins.length === 0) return;
    const paid = readPaidWins();
    const fresh = wins.filter((drill) => !paid.has(drill.id));
    if (fresh.length === 0) return;
    recordActivity("practice_win", fresh.length);
    fresh.forEach((drill) => paid.add(drill.id));
    writePaidWins(paid);
  }, [drills, recordActivity]);

  const progress = useMemo(() => allPlaylistProgress(REBUTTAL_PLAYLISTS, drills), [drills]);
  const rebuttals = totalRebuttals(progress);
  const { rank, next, toNext } = rebuttalRank(rebuttals);
  const wins = progress.reduce((sum, entry) => sum + entry.wins, 0);
  const completed = progress.filter((entry) => entry.done === entry.total).length;

  const replaceDrill = (drill: RebuttalDrill) =>
    setBoard((current) =>
      current ? { ...current, drills: [drill, ...current.drills.filter((entry) => entry.id !== drill.id)] } : current,
    );

  const onUpdate = async (id: string, update: RebuttalDrillUpdate): Promise<string | null> => {
    const result = await updateDrill(id, update);
    replaceDrill(result.drill);
    if (update.action === "submit") recordActivity("rebuttal_redo", 1);
    return result.coach?.feedback ?? null;
  };

  const onStart = async (video: PlaylistVideo, side: DrillSide, partner: "partner" | "ai") => {
    if (!openId) return;
    const result = await startDrill({ playlistId: openId, videoId: video.videoId, side, partner });
    replaceDrill(result.drill);
    setNotice(
      partner === "ai"
        ? "Drill started against the AI — write your rebuttal below."
        : result.joined
          ? "You're paired! Your partner is on the other side — write your rebuttal below."
          : `No one is waiting on the other side yet. Your drill is open for ${PARTNER_WAIT_DAYS} days — write your rebuttal meanwhile, or switch to the AI.`,
    );
    void refresh();
  };

  const openDrills = drills.filter((drill) => drill.status === "waiting" || drill.status === "writing" || drill.status === "judging");
  const judged = drills.filter((drill) => drill.status === "complete").slice(0, 15);
  const openPlaylist = openId ? findPlaylist(openId) : undefined;
  const openProgress = openPlaylist ? progress.find((entry) => entry.playlistId === openPlaylist.id) : undefined;
  const waitingFor = (videoId: string, side: DrillSide) =>
    board?.openSeats.find((seat) => seat.videoId === videoId && seat.side === side)?.count ?? 0;
  const shown = REBUTTAL_PLAYLISTS.filter((playlist) => level === "all" || playlist.level === level);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Block
        title="Rebuttal Playlists"
        icon={<ListVideo className="h-4 w-4" />}
        description="Watch the greatest rounds ever recorded, then redo the final rebuttal — Aff or Neg — paired with another student on the other side (or the AI). Ask the AI coach for help, and the AI judge decides whose rebuttal won."
      >
        {load === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your progress…
          </p>
        ) : null}
        {load === "signed-out" ? (
          <p className="text-sm text-muted-foreground">
            <a href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
              Sign in
            </a>{" "}
            to start drills, get paired with other students and track your progress.
          </p>
        ) : null}
        {load === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        {load === "ready" ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr]">
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your rank</p>
              <p className="text-2xl font-semibold" data-testid="rebuttal-rank">
                {rank.title}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${toNext}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {next ? `${next.min - rebuttals} more rebuttal${next.min - rebuttals === 1 ? "" : "s"} to ${next.title}` : "Top of the ladder"}
              </p>
              <dl className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">Rebuttals</dt>
                  <dd className="text-lg font-semibold tabular-nums">{rebuttals}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Wins</dt>
                  <dd className="text-lg font-semibold tabular-nums">{wins}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Playlists</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {completed}/{REBUTTAL_PLAYLISTS.length}
                  </dd>
                </div>
              </dl>
            </div>
            <PlaylistProgressChart playlists={REBUTTAL_PLAYLISTS} progress={progress} onOpen={setOpenId} />
          </div>
        ) : null}
        {notice ? (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="status">
            {notice}
          </p>
        ) : null}
      </Block>

      {openDrills.length > 0 || judged.length > 0 ? (
        <Block title="Your drills" icon={<Users className="h-4 w-4" />}>
          <ul className="flex flex-col gap-3">
            {[...openDrills, ...judged].map((drill) => (
              <DrillCard key={drill.id} drill={drill} onUpdate={onUpdate} />
            ))}
          </ul>
        </Block>
      ) : null}

      {openPlaylist ? (
        <Block
          title={`${openPlaylist.emoji} ${openPlaylist.title}`}
          icon={<PlayCircle className="h-4 w-4" />}
          description={openPlaylist.description}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> All playlists
            </button>
            {openProgress ? (
              <p className="text-xs text-muted-foreground">
                {openProgress.done}/{openProgress.total} redone · {openProgress.bothSides} on both sides · {openProgress.wins} wins
              </p>
            ) : null}
          </div>
          <ol className="flex flex-col gap-2">
            {openPlaylist.videos.map((video, index) => (
              <VideoRow
                key={video.videoId}
                playlist={openPlaylist}
                video={video}
                index={index}
                done={{
                  aff: openProgress?.doneBySide.aff.has(video.videoId) ?? false,
                  neg: openProgress?.doneBySide.neg.has(video.videoId) ?? false,
                }}
                waiting={{ aff: waitingFor(video.videoId, "aff"), neg: waitingFor(video.videoId, "neg") }}
                canStart={load === "ready"}
                onStart={onStart}
              />
            ))}
          </ol>
        </Block>
      ) : (
        <Block title="Playlists" icon={<ListVideo className="h-4 w-4" />} description="Ten rounds each, picked from the most-watched rounds in the library.">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by level">
            {(["all", "novice", "varsity", "college"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={level === entry}
                onClick={() => setLevel(entry)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  level === entry ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                )}
              >
                {entry === "all" ? "All levels" : PLAYLIST_LEVEL_LABELS[entry]}
              </button>
            ))}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((playlist) => {
              const entry = progress.find((item) => item.playlistId === playlist.id);
              return (
                <li key={playlist.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(playlist.id)}
                    className="flex h-full w-full flex-col gap-2 rounded-lg border border-border p-3 text-left hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden="true">
                        {playlist.emoji}
                      </span>
                      <span className="text-sm font-semibold">{playlist.title}</span>
                    </span>
                    <span className="flex flex-wrap gap-1 text-[11px]">
                      {[playlist.formatLabel, PLAYLIST_LEVEL_LABELS[playlist.level], playlist.style].map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{playlist.description}</span>
                    <span className="mt-auto flex items-center gap-2 text-xs">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${entry?.percent ?? 0}%` }} />
                      </span>
                      <span className="tabular-nums">
                        {entry?.done ?? 0}/{playlist.videos.length}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Block>
      )}
    </div>
  );
}

export default RebuttalPlaylistsPanel;
