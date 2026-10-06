/**
 * Simulated live rounds for the demo tournament ({@link DEMO_TOURN_ID}).
 *
 * The demo seed posts every round's pairings and results but nothing is ever
 * really being debated, so the pairings pages fake it: each room runs through
 * its event's speech order on a compressed clock, and what is "happening" in a
 * room is a pure function of the room, its entries and the time. Every viewer
 * therefore sees the same speech at the same moment without any server state,
 * and the tests pin `now` to get a known frame.
 *
 * A room loops: a short check-in, the speeches (with cross-examination and
 * prep), then a decision that stays posted for a while before the next loop.
 * Transcripts and summaries are generated from per-event argument templates —
 * plausible, deterministic filler, not real speeches.
 */

import { DEMO_TOURN_ID } from "../../host/demo-account";

/** Debate minutes that pass per real minute. A Policy round takes ~13 real minutes. */
export const DEMO_SPEED = 6;

/** One block of a round: a speech, a cross-ex period or a side's prep. */
export interface LiveSegment {
  /** e.g. "1AC", "1AC CX", "Neg prep", "Speaker 3". */
  name: string;
  kind: "speech" | "cx" | "prep";
  /** The side speaking (the questioner's side for cross-ex). Absent for speech events. */
  side?: "aff" | "neg";
  /** The entry speaking, for speech events. */
  entryCode?: string;
  /** Debate minutes. */
  minutes: number;
}

export type LivePhase = "check-in" | "live" | "decided";

export interface LiveSegmentState extends LiveSegment {
  index: number;
  status: "done" | "current" | "upcoming";
  /** 0–1 through this segment. */
  progress: number;
  /** Debate-clock ms from the start of the round to this segment. */
  startsAt: number;
}

export interface LiveRoomState {
  phase: LivePhase;
  /** Whole-round progress, 0–100. */
  percent: number;
  segments: LiveSegmentState[];
  current: LiveSegmentState | null;
  /** Debate-clock ms into the round (0 during check-in). */
  elapsedMs: number;
  totalMs: number;
  /** Debate-clock ms left in the current segment. */
  remainingMs: number;
  /** Simulated audience in the room's stream. */
  viewers: number;
  /** Set once the room is decided. */
  decision: { winner: "aff" | "neg"; ballots: string } | null;
}

/** A room as the simulation needs it: its id and entries in speaking order. */
export interface LiveRoomInput {
  sectionId: number;
  eventAbbr: string;
  eventType: string;
  /** Entry codes: [aff, neg] for debate, speaking order for speech events. */
  entries: string[];
  judgeCount: number;
}

/** Whether `tournId` gets the simulated live layer. */
export function isLiveDemo(tournId: number): boolean {
  return tournId === DEMO_TOURN_ID;
}

const seg = (name: string, kind: LiveSegment["kind"], side: "aff" | "neg", minutes: number): LiveSegment => ({ name, kind, side, minutes });

const POLICY: LiveSegment[] = [
  seg("1AC", "speech", "aff", 8),
  seg("1AC CX", "cx", "neg", 3),
  seg("1NC", "speech", "neg", 8),
  seg("1NC CX", "cx", "aff", 3),
  seg("2AC", "speech", "aff", 8),
  seg("2AC CX", "cx", "neg", 3),
  seg("2NC", "speech", "neg", 8),
  seg("2NC CX", "cx", "aff", 3),
  seg("1NR", "speech", "neg", 5),
  seg("Aff prep", "prep", "aff", 3),
  seg("1AR", "speech", "aff", 5),
  seg("2NR", "speech", "neg", 5),
  seg("Aff prep", "prep", "aff", 2),
  seg("2AR", "speech", "aff", 5),
];

const LD: LiveSegment[] = [
  seg("AC", "speech", "aff", 6),
  seg("AC CX", "cx", "neg", 3),
  seg("NC", "speech", "neg", 7),
  seg("NC CX", "cx", "aff", 3),
  seg("Aff prep", "prep", "aff", 2),
  seg("1AR", "speech", "aff", 4),
  seg("NR", "speech", "neg", 6),
  seg("Aff prep", "prep", "aff", 2),
  seg("2AR", "speech", "aff", 3),
];

const PF: LiveSegment[] = [
  seg("Pro Constructive", "speech", "aff", 4),
  seg("Con Constructive", "speech", "neg", 4),
  seg("First Crossfire", "cx", "aff", 3),
  seg("Pro Rebuttal", "speech", "aff", 4),
  seg("Con Rebuttal", "speech", "neg", 4),
  seg("Second Crossfire", "cx", "neg", 3),
  seg("Pro Summary", "speech", "aff", 3),
  seg("Con Summary", "speech", "neg", 3),
  seg("Grand Crossfire", "cx", "aff", 3),
  seg("Pro Final Focus", "speech", "aff", 2),
  seg("Con Final Focus", "speech", "neg", 2),
];

const PARLI: LiveSegment[] = [
  seg("Motion prep", "prep", "aff", 20),
  seg("PMC", "speech", "aff", 7),
  seg("LOC", "speech", "neg", 8),
  seg("MG", "speech", "aff", 8),
  seg("MO", "speech", "neg", 8),
  seg("LOR", "speech", "neg", 4),
  seg("PMR", "speech", "aff", 5),
];

/** The blocks a room in `eventAbbr` runs through, in order. */
export function liveSchedule(eventAbbr: string, eventType: string, entries: string[] = []): LiveSegment[] {
  if (eventType === "speech" || eventType === "congress") {
    const speakers = entries.length ? entries : Array.from({ length: 6 }, (_, i) => `Speaker ${i + 1}`);
    return speakers.map((code, i) => ({ name: `Speaker ${i + 1}`, kind: "speech", entryCode: code, minutes: 10 }));
  }
  const abbr = eventAbbr.toUpperCase();
  if (abbr.includes("LD")) return LD;
  if (abbr.includes("PF")) return PF;
  if (abbr.includes("PRL") || abbr.includes("PARLI")) return PARLI;
  return POLICY;
}

/** FNV-1a, so a room's offset and filler are stable across reloads. */
export function hash(value: string | number): number {
  let h = 0x811c9dc5;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const MINUTE = 60_000;
/** Share of the loop spent checking in before the first speech. */
const CHECK_IN_SHARE = 0.06;
/** Share of the loop the decision stays posted after the last speech. */
const DECIDED_SHARE = 0.18;

/**
 * Where a room is at `now`. Rooms of one round share the round's offset plus
 * a little jitter, so a round's rooms run roughly together and
 * {@link liveRoundState} (the same clock without jitter) is a fair summary.
 */
export function liveRoomState(room: LiveRoomInput, roundId: number, now: number): LiveRoomState {
  const schedule = liveSchedule(room.eventAbbr, room.eventType, room.entries);
  const jitter = (hash(`room:${room.sectionId}`) % 1000) / 1000 - 0.5;
  return computeState(schedule, roundId, now, jitter * 0.1, room.sectionId, room.judgeCount);
}

/** The round as a whole: its typical room's phase, speech and progress. */
export function liveRoundState(roundId: number, eventAbbr: string, eventType: string, now: number): LiveRoomState {
  return computeState(liveSchedule(eventAbbr, eventType), roundId, now, 0, roundId, 1);
}

function computeState(schedule: LiveSegment[], roundId: number, now: number, jitter: number, seed: number, judgeCount: number): LiveRoomState {
  const totalMs = schedule.reduce((sum, s) => sum + s.minutes, 0) * MINUTE;
  const checkInMs = totalMs * CHECK_IN_SHARE;
  const loopMs = checkInMs + totalMs + totalMs * DECIDED_SHARE;
  const offset = ((hash(`round:${roundId}`) % 1000) / 1000 + jitter) * loopMs;
  const t = (((now * DEMO_SPEED + offset) % loopMs) + loopMs) % loopMs;
  const elapsedMs = Math.min(Math.max(t - checkInMs, 0), totalMs);
  const phase: LivePhase = t < checkInMs ? "check-in" : t - checkInMs >= totalMs ? "decided" : "live";

  let startsAt = 0;
  let current: LiveSegmentState | null = null;
  const segments = schedule.map((s, index): LiveSegmentState => {
    const length = s.minutes * MINUTE;
    const begin = startsAt;
    startsAt += length;
    let status: LiveSegmentState["status"] = "upcoming";
    let progress = 0;
    if (phase === "decided" || (phase === "live" && elapsedMs >= begin + length)) {
      status = "done";
      progress = 1;
    } else if (phase === "live" && elapsedMs >= begin) {
      status = "current";
      progress = (elapsedMs - begin) / length;
    }
    const state = { ...s, index, status, progress, startsAt: begin };
    if (status === "current") current = state;
    return state;
  });
  const cur = current as LiveSegmentState | null;
  const decided = phase === "decided";
  const h = hash(`decision:${seed}:${roundId}`);
  const panel = Math.max(1, judgeCount);
  const majority = Math.floor(panel / 2) + 1;
  const winnerVotes = panel === 1 ? 1 : majority + (h % (panel - majority + 1));
  return {
    phase,
    percent: Math.round((elapsedMs / totalMs) * 100),
    segments,
    current: cur,
    elapsedMs,
    totalMs,
    remainingMs: cur ? (1 - cur.progress) * cur.minutes * MINUTE : 0,
    viewers: phase === "live" ? 3 + (hash(`viewers:${seed}:${Math.floor(now / 20_000)}`) % 40) : 0,
    decision: decided ? { winner: h % 2 ? "neg" : "aff", ballots: `${winnerVotes}-${panel - winnerVotes}` } : null,
  };
}

/** "m:ss" for a debate-clock duration. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** What a side is called in `eventAbbr` (Pro/Con in PF, Gov/Opp in Parli). */
export function sideName(eventAbbr: string, side: "aff" | "neg"): string {
  const abbr = eventAbbr.toUpperCase();
  if (abbr.includes("PF")) return side === "aff" ? "Pro" : "Con";
  if (abbr.includes("PRL")) return side === "aff" ? "Government" : "Opposition";
  return side === "aff" ? "Aff" : "Neg";
}

interface Topic {
  resolution: string;
  aff: string[];
  neg: string[];
}

const TOPICS: Record<string, Topic> = {
  CX: {
    resolution: "the United States federal government should significantly strengthen its protection of domestic intellectual property rights",
    aff: [
      "innovation incentives in biotech",
      "counterfeit pharmaceuticals killing patients",
      "American leadership in the semiconductor race",
      "trade-secret theft draining small firms",
    ],
    neg: [
      "access to essential medicines",
      "patent trolls taxing startups",
      "a states counterplan that solves faster",
      "the politics disad and a fragile trade deal",
    ],
  },
  LD: {
    resolution: "a just government ought to recognize an unconditional right of workers to strike",
    aff: [
      "the value of justice weighed by respecting autonomy",
      "strikes as the last check on exploitation",
      "the Kantian duty not to treat workers as mere means",
      "historical gains won only through strikes",
    ],
    neg: [
      "essential services and the harm to third parties",
      "conditional rights as the just middle ground",
      "the social contract limiting unconditional claims",
      "public safety outweighing absolute labor rights",
    ],
  },
  PF: {
    resolution: "the United States federal government should substantially expand its surveillance of domestic AI development",
    aff: [
      "catching dangerous frontier models before release",
      "closing the gap with existing oversight of biotech",
      "public trust as the precondition for adoption",
      "preventing a race to the bottom on safety",
    ],
    neg: ["chilling open-source research", "pushing labs offshore", "privacy costs of compute monitoring", "regulatory capture by incumbent firms"],
  },
  PRL: {
    resolution: "this house would ban targeted political advertising",
    aff: [
      "micro-targeting fragmenting the shared public square",
      "disinformation reaching the most persuadable voters",
      "the asymmetry between campaigns and citizens",
      "restoring accountability for political messaging",
    ],
    neg: [
      "small campaigns losing their cheapest outreach",
      "free expression and the line-drawing problem",
      "enforcement that only incumbents can navigate",
      "voters receiving more relevant information",
    ],
  },
  SPEECH: {
    resolution: "the topic of this round",
    aff: [
      "a story that frames the problem",
      "evidence that the problem is growing",
      "a call to action the audience can take",
      "a memorable closing image",
    ],
    neg: [],
  },
};

function topicFor(eventAbbr: string, eventType: string): Topic {
  if (eventType === "speech" || eventType === "congress") return TOPICS.SPEECH;
  const abbr = eventAbbr.toUpperCase();
  if (abbr.includes("LD")) return TOPICS.LD;
  if (abbr.includes("PF")) return TOPICS.PF;
  if (abbr.includes("PRL")) return TOPICS.PRL;
  return TOPICS.CX;
}

/** Each side's first speech, which opens on the resolution rather than the line-by-line. */
const CONSTRUCTIVES = new Set(["1AC", "1NC", "AC", "NC", "Pro Constructive", "Con Constructive", "PMC", "LOC"]);

const pick = <T>(list: T[], seed: number, n = 0): T => list[(seed + n) % list.length];

/** A room's simulated transcript of one segment, as sentences. */
export function segmentTranscript(room: LiveRoomInput, segment: LiveSegment): string[] {
  const topic = topicFor(room.eventAbbr, room.eventType);
  const seed = hash(`${room.sectionId}:${segment.name}`);
  if (!segment.side) {
    const code = segment.entryCode ?? "The speaker";
    return [
      `${code} opens with ${pick(topic.aff, seed)}.`,
      `The speech builds through ${pick(topic.aff, seed, 1)}, citing three sources the judges will want to check.`,
      `A turn toward ${pick(topic.aff, seed, 2)} lands with the room.`,
      `${code} closes with ${pick(topic.aff, seed, 3)}, right on time.`,
    ];
  }
  const [affCode = "Aff", negCode = "Neg"] = room.entries;
  const code = segment.side === "aff" ? affCode : negCode;
  const other = segment.side === "aff" ? negCode : affCode;
  const own = segment.side === "aff" ? topic.aff : topic.neg;
  const theirs = segment.side === "aff" ? topic.neg : topic.aff;
  const side = sideName(room.eventAbbr, segment.side);
  if (segment.kind === "prep") {
    return [`${side} (${code}) is using prep time.`, `The room is quiet while ${code} writes the next speech.`];
  }
  if (segment.kind === "cx") {
    return [
      `${code} asks ${other} how their case answers ${pick(own, seed)}.`,
      `${other} says the impact is already accounted for, but concedes there is no specific evidence on it.`,
      `${code} presses on ${pick(theirs, seed, 1)}: is that unique to the resolution?`,
      `${other} holds the line and points back to their framework.`,
    ];
  }
  const early = CONSTRUCTIVES.has(segment.name);
  return [
    early
      ? `${code} begins for the ${side}: the resolution, that ${topic.resolution}, should be ${segment.side === "aff" ? "affirmed" : "rejected"}.`
      : `${code} extends their offense for the ${side} and goes straight to the line-by-line.`,
    `First, ${pick(own, seed)} — the evidence says this is the largest impact in the round.`,
    `Second, ${pick(own, seed, 1)}, which ${other} has not answered.`,
    `On ${other}'s argument about ${pick(theirs, seed)}, ${code} argues it is non-unique and turns it.`,
    `${code} closes by weighing magnitude and probability: ${pick(own, seed)} comes first.`,
  ];
}

/** One-sentence summary of a segment, for the summaries list. */
export function segmentSummary(room: LiveRoomInput, segment: LiveSegment): string {
  const topic = topicFor(room.eventAbbr, room.eventType);
  const seed = hash(`${room.sectionId}:${segment.name}`);
  if (!segment.side) return `${segment.entryCode ?? "The speaker"} argued ${pick(topic.aff, seed)} and closed with ${pick(topic.aff, seed, 3)}.`;
  const [affCode = "Aff", negCode = "Neg"] = room.entries;
  const code = segment.side === "aff" ? affCode : negCode;
  const other = segment.side === "aff" ? negCode : affCode;
  const own = segment.side === "aff" ? topic.aff : topic.neg;
  const theirs = segment.side === "aff" ? topic.neg : topic.aff;
  if (segment.kind === "prep") return `${code} took prep.`;
  if (segment.kind === "cx") return `${code} pressed ${other} on ${pick(theirs, seed, 1)}; ${other} conceded there is no specific evidence on it.`;
  return `${code} led with ${pick(own, seed)}, extended ${pick(own, seed, 1)}, and turned ${pick(theirs, seed)}.`;
}

/** The part of a segment's transcript said by `progress` (0–1). */
export function spokenSoFar(sentences: string[], progress: number): string[] {
  if (progress >= 1) return sentences;
  return sentences.slice(0, Math.max(1, Math.ceil(sentences.length * progress)));
}

export interface LiveFeedItem {
  /** Debate-clock ms into the round. */
  at: number;
  text: string;
}

/** The room's status updates so far, newest first. */
export function liveFeed(room: LiveRoomInput, state: LiveRoomState): LiveFeedItem[] {
  const items: LiveFeedItem[] = [];
  if (state.phase === "check-in") return [{ at: 0, text: "Judges checking in; the round starts shortly." }];
  items.push({ at: 0, text: "Judges checked in. The round has started." });
  for (const s of state.segments) {
    if (s.status === "upcoming") break;
    const who = s.entryCode ?? (s.side ? `${sideName(room.eventAbbr, s.side)} (${room.entries[s.side === "aff" ? 0 : 1] ?? "?"})` : "");
    items.push({ at: s.startsAt, text: s.kind === "prep" ? `${who} took prep.` : `${s.name} began — ${who}.` });
    if (s.status === "done" && s.kind === "speech") items.push({ at: s.startsAt + s.minutes * MINUTE, text: `${s.name} ended. Summary posted.` });
  }
  if (state.decision && !room.entries.length) {
    items.push({ at: state.totalMs, text: "Ballots in." });
  } else if (state.decision && (room.eventType === "speech" || room.eventType === "congress")) {
    items.push({ at: state.totalMs, text: "Ballots in; ranks will post with the results." });
  } else if (state.decision) {
    const code = room.entries[state.decision.winner === "aff" ? 0 : 1] ?? sideName(room.eventAbbr, state.decision.winner);
    items.push({
      at: state.totalMs,
      text: `Decision: ${code} (${sideName(room.eventAbbr, state.decision.winner)}) wins on a ${state.decision.ballots}.`,
    });
  }
  return items.reverse();
}
