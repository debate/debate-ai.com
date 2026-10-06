"use client";

/**
 * The live layer the demo tournament's pairings show (see `./demo-live`): a
 * status cell beside each room (current speech and progress), a round-level
 * badge on the pairings index, and a "tune in" panel per room that plays as a
 * stream — live captions, the speech timeline, a status feed, per-speech
 * summaries, and read-aloud of any speech through the browser's speech
 * synthesis.
 */

import { useEffect, useState } from "react";
import { Headphones, Radio, Square, X } from "lucide-react";
import { Badge, Button, Card, cn } from "../primitives";
import {
  DEMO_SPEED,
  formatClock,
  liveFeed,
  liveRoomState,
  liveRoundState,
  segmentSummary,
  segmentTranscript,
  sideName,
  spokenSoFar,
  type LiveRoomInput,
  type LiveRoomState,
  type LiveSegmentState,
} from "./demo-live";

/** The current time, ticking every `intervalMs`; null until mounted so server and client render alike. */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Reads text aloud with the Web Speech API; `playing` names what is being read. */
function useReadAloud() {
  const [playing, setPlaying] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(
    () => () => {
      if (supported) window.speechSynthesis.cancel();
    },
    [supported],
  );
  const stop = () => {
    if (supported) window.speechSynthesis.cancel();
    setPlaying(null);
  };
  const play = (key: string, text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.onend = () => setPlaying((p) => (p === key ? null : p));
    utterance.onerror = utterance.onend;
    setPlaying(key);
    window.speechSynthesis.speak(utterance);
  };
  return { supported, playing, play, stop };
}

export function ProgressBar({ percent, className, barClassName }: { percent: number; className?: string; barClassName?: string }) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className={cn("h-full rounded-full bg-primary transition-[width] duration-1000", barClassName)} style={{ width: `${percent}%` }} />
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
    </span>
  );
}

function phaseLabel(state: LiveRoomState, room: Pick<LiveRoomInput, "eventAbbr" | "entries">): string {
  if (state.phase === "check-in") return "Checking in";
  if (state.phase === "decided") {
    if (!state.decision) return "Decided";
    const code = room.entries[state.decision.winner === "aff" ? 0 : 1];
    return code ? `${code} wins ${state.decision.ballots}` : "Ballots in";
  }
  const cur = state.current;
  if (!cur) return "Live";
  return cur.side ? `${cur.name} · ${sideName(room.eventAbbr, cur.side)}` : `${cur.name} · ${cur.entryCode ?? ""}`;
}

/** The status beside one room in the pairings: current speech, progress, and the tune-in toggle. */
export function LiveStatusCell({
  room,
  roundId,
  now,
  open,
  onToggle,
}: {
  room: LiveRoomInput;
  roundId: number;
  now: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  if (now === null) return <span className="text-xs text-muted-foreground">—</span>;
  const state = liveRoomState(room, roundId, now);
  return (
    <div className="min-w-36 space-y-1.5" data-live-phase={state.phase}>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {state.phase === "live" && <LiveDot />}
        <span className={state.phase === "live" ? undefined : "text-muted-foreground"}>{phaseLabel(state, room)}</span>
        <span className="ml-auto tabular-nums text-muted-foreground">{state.percent}%</span>
      </div>
      <ProgressBar percent={state.percent} />
      <Button variant={open ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={onToggle} aria-expanded={open}>
        <Radio aria-hidden />
        {open ? "Close stream" : state.phase === "live" ? "Tune in" : "Replay"}
      </Button>
    </div>
  );
}

/** The round's typical room, for the pairings index. */
export function LiveRoundBadge({
  roundId,
  eventAbbr,
  eventType,
  now,
}: {
  roundId: number;
  eventAbbr: string;
  eventType: string;
  now: number | null;
}) {
  if (now === null) return null;
  const state = liveRoundState(roundId, eventAbbr, eventType, now);
  const label =
    state.phase === "live" ? `${state.current?.name ?? "Live"} · ${state.percent}%` : state.phase === "check-in" ? "Checking in" : "Decisions in";
  return (
    <span className="mt-1 flex w-full flex-col gap-1 text-[11px] font-normal text-muted-foreground" data-live-phase={state.phase}>
      <span className="flex items-center gap-1">
        {state.phase === "live" && <LiveDot />}
        {label}
      </span>
      <ProgressBar percent={state.percent} className="h-1" />
    </span>
  );
}

/** A room's stream: captions, timeline, read-aloud, summaries and the status feed. */
export function LiveRoomPanel({ room, roundId, now, onClose }: { room: LiveRoomInput; roundId: number; now: number | null; onClose: () => void }) {
  const voice = useReadAloud();
  const [follow, setFollow] = useState(false);
  const state = now === null ? null : liveRoomState(room, roundId, now);
  const current = state?.current ?? null;
  const currentKey = current ? `${current.index}` : null;

  // "Listen live" reads each new segment as it starts.
  useEffect(() => {
    if (!follow || !current || current.kind === "prep" || voice.playing === currentKey) return;
    voice.play(currentKey!, spokenSoFar(segmentTranscript(room, current), current.progress).join(" "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, currentKey]);

  if (!state) return null;
  const debate = room.eventType !== "speech" && room.eventType !== "congress";
  const said = current ? spokenSoFar(segmentTranscript(room, current), current.progress) : [];
  const finished = state.segments.filter((s) => s.status === "done" && s.kind !== "prep");
  const feed = liveFeed(room, state);

  return (
    <Card className="gap-0 overflow-hidden border-primary/30 py-0" aria-label={`Live stream: ${room.entries.join(" vs ")}`}>
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2">
        {state.phase === "live" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
            <LiveDot /> LIVE
          </span>
        ) : (
          <Badge variant="outline">{state.phase === "check-in" ? "Starting soon" : "Ended"}</Badge>
        )}
        <span className="text-sm font-medium">{debate ? room.entries.join(" vs ") : `${room.entries.length} speakers`}</span>
        {state.phase === "live" && <span className="text-xs text-muted-foreground">{state.viewers} watching</span>}
        <span className="text-xs text-muted-foreground">Simulated demo · {DEMO_SPEED}× speed</span>
        <Button variant="ghost" className="ml-auto h-7 px-2" onClick={onClose} aria-label="Close stream">
          <X aria-hidden />
        </Button>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <div className="rounded-lg bg-zinc-950 p-4 text-zinc-50" aria-live="polite">
            <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
              <span>{phaseLabel(state, room)}</span>
              {current && <span className="ml-auto tabular-nums">{formatClock(state.remainingMs)} left</span>}
            </div>
            {current ? (
              <p className="min-h-16 text-sm leading-relaxed">{said.join(" ")}</p>
            ) : (
              <p className="min-h-16 text-sm text-zinc-400">
                {state.phase === "check-in"
                  ? "The judges are checking in. The first speech starts shortly."
                  : "The round is over. Replay any speech below."}
              </p>
            )}
            <ProgressBar percent={state.percent} className="mt-3 bg-zinc-800" barClassName="bg-red-500" />
            <div className="mt-3 flex flex-wrap gap-2">
              {voice.supported ? (
                <Button
                  variant="outline"
                  className="h-7 border-zinc-700 bg-transparent px-2 text-xs text-zinc-50 hover:bg-zinc-800"
                  onClick={() => {
                    if (follow) {
                      setFollow(false);
                      voice.stop();
                    } else setFollow(true);
                  }}
                  disabled={state.phase !== "live"}
                >
                  {follow ? <Square aria-hidden /> : <Headphones aria-hidden />}
                  {follow ? "Stop listening" : "Listen live"}
                </Button>
              ) : (
                <span className="text-xs text-zinc-400">Read-aloud needs a browser with speech synthesis.</span>
              )}
            </div>
          </div>

          <Timeline segments={state.segments} eventAbbr={room.eventAbbr} />

          <div>
            <h3 className="mb-2 text-sm font-semibold">Speech summaries</h3>
            {finished.length === 0 ? (
              <p className="text-sm text-muted-foreground">Summaries post as each speech ends.</p>
            ) : (
              <ul className="space-y-2">
                {[...finished].reverse().map((s) => {
                  const key = `${s.index}`;
                  return (
                    <li key={key} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <Badge variant="outline" className="mt-0.5">
                        {s.name}
                      </Badge>
                      <span className="flex-1">{segmentSummary(room, s)}</span>
                      {voice.supported && (
                        <Button
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setFollow(false);
                            if (voice.playing === key) voice.stop();
                            else voice.play(key, segmentTranscript(room, s).join(" "));
                          }}
                          aria-label={voice.playing === key ? `Stop ${s.name}` : `Listen to ${s.name}`}
                        >
                          {voice.playing === key ? <Square aria-hidden /> : <Headphones aria-hidden />}
                          {voice.playing === key ? "Stop" : "Listen"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Live updates</h3>
          <ol className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {feed.map((item, i) => (
              <li key={`${item.at}:${i}`} className="flex gap-2">
                <span className="w-10 shrink-0 tabular-nums text-xs text-muted-foreground">{formatClock(item.at)}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}

function Timeline({ segments, eventAbbr }: { segments: LiveSegmentState[]; eventAbbr: string }) {
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Speech order">
      {segments.map((s) => (
        <li
          key={s.index}
          title={s.side ? `${s.name} (${sideName(eventAbbr, s.side)}, ${s.minutes} min)` : `${s.name}: ${s.entryCode ?? ""}`}
          className={cn(
            "relative overflow-hidden rounded-md border px-2 py-0.5 text-xs",
            s.status === "done" && "bg-muted text-muted-foreground",
            s.status === "current" && "border-primary font-semibold",
            s.status === "upcoming" && "text-muted-foreground",
          )}
        >
          {s.status === "current" && (
            <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${Math.round(s.progress * 100)}%` }} aria-hidden />
          )}
          <span className="relative">{s.name}</span>
        </li>
      ))}
    </ol>
  );
}
