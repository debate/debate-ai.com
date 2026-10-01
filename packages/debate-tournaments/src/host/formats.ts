/**
 * The three debate styles a tournament can be run in — Policy, Lincoln
 * Douglas and Public Forum — and what "customize this tournament within the
 * style" means in Tabroom's data model.
 *
 * Tabroom stores a format as a `category` (the division being run: Open,
 * Novice, JV…) holding one `event` per format, with the format-specific knobs
 * as `event_setting` rows. It has no declarative notion of a format, so the
 * structure that makes a Policy round different from a PF round — who speaks
 * when, what the sides are called, where cross-examination sits — lives here
 * and is written onto the event as settings when the tournament is created.
 *
 * The speech structure matches `packages/debate-flow`'s `EVENTS` (the flow
 * document's own format model), so a card written for Policy in the app means
 * the same thing as a Policy event created here.
 */

/** The formats this app can host. */
export type TournamentFormatId = "policy" | "ld" | "pf";

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
  /** The two speakers, e.g. ["First", "Second"]. */
  speakers: [string, string];
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
    sideLabels: {
      aff: { label: "Affirmative", speakers: ["First speaker", "Second speaker"] },
      neg: { label: "Negative", speakers: ["First speaker", "Second speaker"] },
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
];

const BY_ID = new Map(TOURNAMENT_FORMATS.map((format) => [format.id, format]));

/** The format with `id`, or `undefined` when the id is not one of the three. */
export function tournamentFormat(id: string): TournamentFormat | undefined {
  return BY_ID.get(id as TournamentFormatId);
}

/** Every format's speech order, flattened: each side's order, back to back. */
export function formatSpeechOrder(format: TournamentFormat): SpeechSlot[] {
  return [...format.aff, ...format.neg];
}

/** A one-line summary of how a format is run, for the create form. */
export function formatSummary(format: TournamentFormat): string {
  const order = [format.aff.map((s) => s.short).join(" → "), format.neg.map((s) => s.short).join(" → ")].join(" vs ");
  const cross = format.crossEx ? `; ${format.crossEx.periods.length} CX periods` : "; no cross-examination";
  return `${order}${cross}${format.variableOrder ? "; flip decides speaking order" : ""}.`;
}
