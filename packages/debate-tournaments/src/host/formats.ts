/**
 * Every debate format a tournament can be run in — Policy, Lincoln Douglas,
 * Public Forum, Parliamentary, British Parliamentary, World Schools, Asian
 * Parliamentary, Big Questions, IPDA and Congress — and what "customize this
 * tournament within the style" means in Tabroom's data model.
 *
 * Tabroom stores a format as a `category` (the division being run: Open,
 * Novice, JV…) holding one `event` per format, with the format-specific knobs
 * as `event_setting` rows. `event.type` is Tabroom's own coarse kind
 * (`debate`, `wudc`, `wsdc`, `congress`, … from upstream's `EventSchema`); it
 * has no declarative notion of a format beyond that, so the structure that
 * makes a Policy round different from a PF round — who speaks when, what the
 * sides are called, where cross-examination sits — lives here and is written
 * onto the event as settings when the tournament is created.
 *
 * The speech structure of Policy, LD, PF and Parli matches
 * `packages/debate-flow`'s `EVENTS` (the flow document's own format model), so
 * a card written for Policy in the app means the same thing as a Policy event
 * created here.
 */

import type { Event as TabroomEvent } from "../../vendor/tabroom/types";

/** The formats this app can host. */
export type TournamentFormatId =
  | "policy"
  | "ld"
  | "pf"
  | "parli"
  | "bp"
  | "wsdc"
  | "ap"
  | "bq"
  | "ipda"
  | "congress";

/** Tabroom's `event.type`, as upstream's `EventSchema` enumerates it. */
export type TabroomEventType = TabroomEvent["type"];

/** Which side of the round an argument belongs to. */
export type DebateSide = "aff" | "neg";

/** One speech in a side's own speaking order. */
export interface SpeechSlot {
  /** Canonical name, e.g. "1AC". */
  name: string;
  /** Short label for tables and pairings, e.g. "1AC". */
  short: string;
  side: DebateSide;
}

/** A cross-examination period, and which team takes questions first. */
export interface CrossExPeriod {
  /** e.g. "1AC CX". */
  label: string;
  q: "first" | "second";
}

export interface SideLabel {
  /** e.g. "Affirmative" / "Pro". */
  label: string;
  /** The speakers on one entry, e.g. ["First speaker", "Second speaker"]. */
  speakers: string[];
}

/** `event.level` — the division being run. */
export type EventLevel = "open" | "novice" | "jv";

/** `event.code_style` — how an entry is written in pairings and ballots. */
export type EventCodeStyle =
  | "code_name"
  | "full_initials"
  | "initials"
  | "last_names"
  | "names"
  | "names_lastfirst"
  | "numbers"
  | "prepend_school"
  | "register"
  | "school_first_names"
  | "school_last_names"
  | "school_name_only"
  | "school_names"
  | "school_number"
  | "schoolname_code";

export interface TournamentFormat {
  id: TournamentFormatId;
  /** `event.abbr` — what the invite and pairings print. */
  abbr: string;
  /** `event.name`. */
  name: string;
  /** `category.name` when a host runs a single division, e.g. "Varsity Policy". */
  category: string;
  /** One line for the creation form. */
  blurb: string;
  /** `event.type` — Tabroom's kind of event, which decides how it is paired. */
  eventType: TabroomEventType;
  /** Entries in one room: 2 for head-to-head, 4 for BP, 0 for a Congress chamber. */
  teamsPerRoom: number;
  /** `event_setting` `min_entry` / `max_entry` — competitors on one entry. */
  entrySize: { min: number; max: number };
  sideLabels: Record<DebateSide, SideLabel>;
  /** Each side's speeches, in that side's own order. */
  aff: SpeechSlot[];
  neg: SpeechSlot[];
  /** True when the flip decides who speaks first (PF). */
  variableOrder: boolean;
  crossEx?: { title: string; periods: CrossExPeriod[] };
  /** The division a tournament gets when the host does not choose one. */
  defaultLevel: EventLevel;
  /** How entries are written unless the host changes it. */
  defaultCodeStyle: EventCodeStyle;
}

const speech = (name: string, side: DebateSide): SpeechSlot => ({ name, short: name, side });

export const TOURNAMENT_FORMATS: readonly TournamentFormat[] = [
  {
    id: "policy",
    abbr: "Policy",
    name: "Policy",
    category: "Policy",
    blurb: "1AC/2AC/1AR/2AR with 1NC/2NC/1NR/2NR. Four cross-examination periods, speaker points decide.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 2, max: 2 },
    sideLabels: {
      aff: { label: "Affirmative", speakers: ["First speaker", "Second speaker"] },
      neg: { label: "Negative", speakers: ["First speaker", "Second speaker"] },
    },
    aff: [speech("1AC", "aff"), speech("2AC", "aff"), speech("1AR", "aff"), speech("2AR", "aff")],
    neg: [speech("1NC", "neg"), speech("2NC", "neg"), speech("1NR", "neg"), speech("2NR", "neg")],
    variableOrder: false,
    crossEx: {
      title: "Cross-examination",
      periods: [
        { label: "1AC CX", q: "first" },
        { label: "1NC CX", q: "first" },
        { label: "2AC CX", q: "first" },
        { label: "2NC CX", q: "first" },
      ],
    },
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
  {
    id: "ld",
    abbr: "LD",
    name: "Lincoln Douglas",
    category: "LD",
    blurb: "1AC/1NR, 1AR/2NR. No speaker points — judged on the case and the speaker.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 1, max: 1 },
    sideLabels: {
      aff: { label: "Affirmative", speakers: ["Debater"] },
      neg: { label: "Negative", speakers: ["Debater"] },
    },
    aff: [speech("1AC", "aff"), speech("1AR", "aff")],
    neg: [speech("1NC", "neg"), speech("2NR", "neg")],
    variableOrder: false,
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
  {
    id: "pf",
    abbr: "PF",
    name: "Public Forum",
    category: "PF",
    blurb: "CON/AFF/CON/NEG/NAF/NEG with a shared grand cross-examination. The flip decides who speaks first.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 2, max: 2 },
    sideLabels: {
      aff: { label: "Pro", speakers: ["First speaker", "Second speaker"] },
      neg: { label: "Con", speakers: ["First speaker", "Second speaker"] },
    },
    aff: [speech("AFF", "aff"), speech("AS", "aff"), speech("NAF", "aff")],
    neg: [speech("CON", "neg"), speech("NS", "neg"), speech("NEG", "neg")],
    variableOrder: true,
    crossEx: {
      title: "Cross-examination",
      periods: [
        { label: "First cross", q: "first" },
        { label: "Second cross", q: "second" },
        { label: "Grand cross", q: "first" },
      ],
    },
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
  {
    id: "parli",
    abbr: "Parli",
    name: "Parliamentary",
    category: "Parli",
    blurb: "PMC/LOC, MG/MO, LOR/PMR on a motion released before the round. Points of information instead of cross-examination.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 2, max: 2 },
    sideLabels: {
      aff: { label: "Government", speakers: ["Prime Minister", "Member of Government"] },
      neg: { label: "Opposition", speakers: ["Leader of Opposition", "Member of Opposition"] },
    },
    aff: [speech("PMC", "aff"), speech("MG", "aff"), speech("PMR", "aff")],
    neg: [speech("LOC", "neg"), speech("MO", "neg"), speech("LOR", "neg")],
    variableOrder: false,
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
  {
    id: "bp",
    abbr: "BP",
    name: "British Parliamentary",
    category: "BP",
    blurb: "Four teams of two in each room, opening and closing on each bench. Ranked first to fourth, with points of information.",
    eventType: "wudc",
    teamsPerRoom: 4,
    entrySize: { min: 2, max: 2 },
    sideLabels: {
      aff: { label: "Government", speakers: ["First speaker", "Second speaker"] },
      neg: { label: "Opposition", speakers: ["First speaker", "Second speaker"] },
    },
    aff: [speech("PM", "aff"), speech("DPM", "aff"), speech("MG", "aff"), speech("GW", "aff")],
    neg: [speech("LO", "neg"), speech("DLO", "neg"), speech("MO", "neg"), speech("OW", "neg")],
    variableOrder: false,
    defaultLevel: "open",
    defaultCodeStyle: "school_names",
  },
  {
    id: "wsdc",
    abbr: "WSDC",
    name: "World Schools",
    category: "World Schools",
    blurb: "Three speakers a side plus a reply speech, squads of up to five. Prepared and impromptu motions, points of information.",
    eventType: "wsdc",
    teamsPerRoom: 2,
    entrySize: { min: 3, max: 5 },
    sideLabels: {
      aff: { label: "Proposition", speakers: ["First speaker", "Second speaker", "Third speaker"] },
      neg: { label: "Opposition", speakers: ["First speaker", "Second speaker", "Third speaker"] },
    },
    aff: [speech("P1", "aff"), speech("P2", "aff"), speech("P3", "aff"), speech("PR", "aff")],
    neg: [speech("O1", "neg"), speech("O2", "neg"), speech("O3", "neg"), speech("OR", "neg")],
    variableOrder: false,
    defaultLevel: "open",
    defaultCodeStyle: "school_names",
  },
  {
    id: "ap",
    abbr: "AP",
    name: "Asian Parliamentary",
    category: "Asian Parli",
    blurb: "Three speakers a side and a reply speech from the first or second speaker. Points of information.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 3, max: 3 },
    sideLabels: {
      aff: { label: "Government", speakers: ["Prime Minister", "Deputy Prime Minister", "Government Whip"] },
      neg: { label: "Opposition", speakers: ["Leader of Opposition", "Deputy Leader", "Opposition Whip"] },
    },
    aff: [speech("PM", "aff"), speech("DPM", "aff"), speech("GW", "aff"), speech("GR", "aff")],
    neg: [speech("LO", "neg"), speech("DLO", "neg"), speech("OW", "neg"), speech("OR", "neg")],
    variableOrder: false,
    defaultLevel: "open",
    defaultCodeStyle: "school_names",
  },
  {
    id: "bq",
    abbr: "BQ",
    name: "Big Questions",
    category: "Big Questions",
    blurb: "Constructive, rebuttal, consolidation and rationale on each side, with a question segment after each constructive.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 1, max: 2 },
    sideLabels: {
      aff: { label: "Affirmative", speakers: ["First speaker", "Second speaker"] },
      neg: { label: "Negative", speakers: ["First speaker", "Second speaker"] },
    },
    aff: [speech("AC", "aff"), speech("AR", "aff"), speech("ACons", "aff"), speech("ARat", "aff")],
    neg: [speech("NC", "neg"), speech("NR", "neg"), speech("NCons", "neg"), speech("NRat", "neg")],
    variableOrder: false,
    crossEx: {
      title: "Question segments",
      periods: [
        { label: "Question segment 1", q: "second" },
        { label: "Question segment 2", q: "first" },
      ],
    },
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
  {
    id: "ipda",
    abbr: "IPDA",
    name: "IPDA",
    category: "IPDA",
    blurb: "One-on-one public debate on a resolution picked by strikes, with two cross-examination periods. Judged by lay judges.",
    eventType: "debate",
    teamsPerRoom: 2,
    entrySize: { min: 1, max: 1 },
    sideLabels: {
      aff: { label: "Affirmative", speakers: ["Debater"] },
      neg: { label: "Negative", speakers: ["Debater"] },
    },
    aff: [speech("AC", "aff"), speech("AR", "aff")],
    neg: [speech("NC", "neg"), speech("NR", "neg")],
    variableOrder: false,
    crossEx: {
      title: "Cross-examination",
      periods: [
        { label: "AC CX", q: "second" },
        { label: "NC CX", q: "first" },
      ],
    },
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
  {
    id: "congress",
    abbr: "Congress",
    name: "Congressional Debate",
    category: "Congress",
    blurb: "A chamber of legislators debating bills and resolutions: authorship, alternating pro and con speeches, and questioning, run by a presiding officer.",
    eventType: "congress",
    teamsPerRoom: 0,
    entrySize: { min: 1, max: 1 },
    sideLabels: {
      aff: { label: "Pro", speakers: ["Legislator"] },
      neg: { label: "Con", speakers: ["Legislator"] },
    },
    aff: [speech("Authorship", "aff"), speech("Pro", "aff")],
    neg: [speech("Con", "neg")],
    variableOrder: true,
    crossEx: { title: "Questioning", periods: [{ label: "Questioning", q: "second" }] },
    defaultLevel: "open",
    defaultCodeStyle: "names",
  },
];

const BY_ID = new Map(TOURNAMENT_FORMATS.map((format) => [format.id, format]));

/** The format with `id`, or `undefined` when the id is not one this app hosts. */
export function tournamentFormat(id: string): TournamentFormat | undefined {
  return BY_ID.get(id as TournamentFormatId);
}

/** Every format's speech order, flattened: each side's order, back to back. */
export function formatSpeechOrder(format: TournamentFormat): SpeechSlot[] {
  return [...format.aff, ...format.neg];
}

/** A one-line summary of how a format is run, for the create form. */
export function formatSummary(format: TournamentFormat): string {
  if (format.eventType === "congress") {
    return "Chamber: authorship, then alternating pro and con speeches, each followed by questioning; presiding officer recognizes speakers.";
  }
  const order = [format.aff.map((s) => s.short).join(" → "), format.neg.map((s) => s.short).join(" → ")].join(" vs ");
  const rooms = format.teamsPerRoom > 2 ? `; ${format.teamsPerRoom} teams a room` : "";
  const cross = format.crossEx ? `; ${format.crossEx.periods.length} CX periods` : "; no cross-examination";
  return `${order}${rooms}${cross}${format.variableOrder ? "; flip decides speaking order" : ""}.`;
}

/** Every hosted format's id, in the order the create form lists them. */
export const TOURNAMENT_FORMAT_IDS = TOURNAMENT_FORMATS.map((format) => format.id) as [
  TournamentFormatId,
  ...TournamentFormatId[],
];
