/**
 * Turns an event's elimination rounds (each round's pairings and ballots, as
 * {@link RoundSchematic}s) into a single-elimination bracket: one column per
 * round, each matchup's winner, and the order that lines every matchup up
 * beside the one its winner advanced to.
 */

import type { RoundSchematic } from "./client";
import { entrySide, type EntrySide } from "./enrichment";

/** The round types Tabroom gives elimination rounds. */
export const ELIM_ROUND_TYPES: ReadonlySet<string> = new Set(["elim", "final"]);

/** Whether a published round of `type` belongs in the bracket. */
export const isElimRound = (type: string | null | undefined): boolean => ELIM_ROUND_TYPES.has((type ?? "").toLowerCase());

/** The site's names for elimination rounds, by how many debates the round has. */
const ELIM_BY_SIZE: Record<number, string> = { 1: "Final", 2: "Semis", 4: "Quarters", 8: "Octas", 16: "Doubles", 32: "Triples" };

/**
 * A round's display name: the site's standard elim names (Triples, Doubles,
 * Octas, Quarters, Semis, Final) for any spelling Tabroom uses, `R<n>` for an
 * unlabeled prelim, and the tournament's own label otherwise.
 */
export function roundDisplayLabel(label: string | null | undefined, name: number, sectionCount?: number): string {
  const raw = (label ?? "").trim();
  const text = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (/^(grand)?finals?$/.test(text) || text === "f") return "Final";
  if (/^semi/.test(text)) return "Semis";
  if (/^quarter/.test(text) || text === "qf" || text === "qtrs") return "Quarters";
  if (/^oct/.test(text)) return "Octas";
  if (/^double/.test(text)) return "Doubles";
  if (/^triple/.test(text)) return "Triples";
  if (raw) return raw;
  if (sectionCount !== undefined && ELIM_BY_SIZE[sectionCount]) return ELIM_BY_SIZE[sectionCount];
  return `R${name}`;
}

type Section = RoundSchematic["Sections"][string];
type SectionEntry = NonNullable<Section["Entries"]>[string];
type SectionJudge = NonNullable<Section["Judges"]>[string];

/** One judge's ballot in a matchup. */
export interface BracketBallot {
  judge: SectionJudge;
  /** The entry this judge voted for, if they posted a decision. */
  winnerId: number | null;
  /** Speaker points (or ranks) by entry id, as posted. */
  points: Map<number, number>;
}

export interface BracketEntry {
  id: number;
  code: string;
  name: string | null;
  school: string | null;
  side: EntrySide | null;
  /** Ballots this entry won. */
  wins: number;
}

export interface BracketMatchup {
  sectionId: number;
  letter: string | null;
  room: string | null;
  bye: boolean;
  entries: BracketEntry[];
  judges: SectionJudge[];
  ballots: BracketBallot[];
  /** The entry that won (by ballots, or by turning up in the next round), or `null` when not yet known. */
  winnerId: number | null;
  /** `"ballots"` when the posted ballots decide it, `"advanced"` when only the next round's pairings show who went through. */
  decidedBy: "ballots" | "advanced" | null;
}

export interface BracketColumn {
  roundId: number;
  /** Tabroom's round number, used for the round's own page. */
  roundName: number;
  label: string;
  /** Matchups in bracket order; `null` is an empty slot (an entry that skipped this round). */
  slots: Array<BracketMatchup | null>;
}

const sectionOrder = (a: Section, b: Section) =>
  (Number(a.letter) || 0) - (Number(b.letter) || 0) || String(a.letter ?? "").localeCompare(String(b.letter ?? "")) || a.id - b.id;

/** An entry's place in its section: aff before neg (Tabroom's 1/2 or "Aff"/"Neg"), else speaker order. */
export const entryOrder = (entry: Pick<SectionEntry, "side" | "speakerorder">): number => {
  const side = entrySide(entry.side);
  return side === "aff" ? 1 : side === "neg" ? 2 : (entry.speakerorder ?? 0);
};

function toMatchup(section: Section, nextRoundEntries: ReadonlySet<number> | null): BracketMatchup {
  const raw = Object.values(section.Entries ?? {}).sort((a, b) => entryOrder(a) - entryOrder(b));
  const judgeIds = Object.keys(section.Judges ?? {});
  const ballots: BracketBallot[] = judgeIds.map((judgeId) => {
    const points = new Map<number, number>();
    let winnerId: number | null = null;
    for (const entry of raw) {
      const ballot = entry.Ballots?.[judgeId];
      if (!ballot) continue;
      if (/^w/i.test(String(ballot.winloss ?? ""))) winnerId = entry.id;
      const score = typeof ballot.point === "number" ? ballot.point : typeof ballot.rank === "number" ? ballot.rank : null;
      if (score !== null) points.set(entry.id, score);
    }
    return { judge: section.Judges![judgeId], winnerId, points };
  });
  const entries: BracketEntry[] = raw.map((entry) => ({
    id: entry.id,
    code: entry.code,
    name: entry.name?.trim() || null,
    school: entry.schoolName?.trim() || null,
    side: entrySide(entry.side),
    wins: ballots.filter((ballot) => ballot.winnerId === entry.id).length,
  }));
  let winnerId: number | null = null;
  let decidedBy: BracketMatchup["decidedBy"] = null;
  const [top, second] = [...entries].sort((a, b) => b.wins - a.wins);
  if (top && top.wins > 0 && top.wins > (second?.wins ?? 0)) {
    winnerId = top.id;
    decidedBy = "ballots";
  } else if (nextRoundEntries) {
    const through = entries.filter((entry) => nextRoundEntries.has(entry.id));
    if (through.length === 1) {
      winnerId = through[0].id;
      decidedBy = "advanced";
    }
  }
  if (!winnerId && section.bye && entries.length === 1) {
    winnerId = entries[0].id;
    decidedBy = "advanced";
  }
  return {
    sectionId: section.id,
    letter: section.letter ?? null,
    room: section.Room?.name ?? null,
    bye: Boolean(section.bye),
    entries,
    judges: Object.values(section.Judges ?? {}),
    ballots,
    winnerId,
    decidedBy,
  };
}

const entryIds = (round: RoundSchematic) =>
  new Set(Object.values(round.Sections ?? {}).flatMap((section) => Object.values(section.Entries ?? {}).map((entry) => entry.id)));

/**
 * Builds the bracket from an event's elim rounds, in any order. The last
 * round keeps its section order; each earlier round is laid out so the two
 * matchups feeding a later one sit in the two slots beside it (slot `2p` and
 * `2p + 1` feed slot `p`), with an empty slot where an entry skipped the
 * round. Matchups that feed nothing (a later round not posted yet) follow.
 */
export function buildBracket(rounds: readonly RoundSchematic[]): BracketColumn[] {
  const sorted = rounds.filter((round) => Object.keys(round.Sections ?? {}).length > 0).sort((a, b) => a.name - b.name);
  const matchups = sorted.map((round, index) => {
    const next = sorted[index + 1];
    const nextEntries = next ? entryIds(next) : null;
    return Object.values(round.Sections).sort(sectionOrder).map((section) => toMatchup(section, nextEntries));
  });
  const columns: BracketColumn[] = sorted.map((round, index) => ({
    roundId: round.id,
    roundName: round.name,
    label: roundDisplayLabel(round.label, round.name, Object.keys(round.Sections).length),
    slots: [],
  }));
  for (let index = sorted.length - 1; index >= 0; index--) {
    const own = matchups[index];
    if (index === sorted.length - 1) {
      columns[index].slots = own;
      continue;
    }
    const later = columns[index + 1].slots;
    const placed = new Set<BracketMatchup>();
    const slots: Array<BracketMatchup | null> = [];
    for (const target of later) {
      const feeders = (target?.entries ?? []).map((entry) => own.find((m) => !placed.has(m) && m.entries.some((e) => e.id === entry.id)) ?? null);
      while (feeders.length < 2) feeders.push(null);
      for (const feeder of feeders.slice(0, 2)) {
        if (feeder) placed.add(feeder);
        slots.push(feeder);
      }
    }
    slots.push(...own.filter((m) => !placed.has(m)));
    columns[index].slots = slots;
  }
  // A first round with fewer slots than the next one's feeders can't line up;
  // pad each later column so every column halves the one before it.
  for (let index = 1; index < columns.length; index++) {
    const want = Math.ceil(columns[index - 1].slots.length / 2);
    while (columns[index].slots.length < want) columns[index].slots.push(null);
  }
  return columns;
}

/** `"2–1"`-style ballot count for a decided matchup, winner first. */
export function ballotScore(matchup: BracketMatchup): string | null {
  if (matchup.decidedBy !== "ballots") return null;
  const winner = matchup.entries.find((entry) => entry.id === matchup.winnerId);
  const others = matchup.entries.filter((entry) => entry.id !== matchup.winnerId);
  if (!winner) return null;
  return [winner.wins, ...others.map((entry) => entry.wins)].join("–");
}
