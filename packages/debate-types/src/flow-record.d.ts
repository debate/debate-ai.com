/** Finer argument-role tag for a flowed row, beyond the plain heading/argument split. */
export type ArgumentType = "contention" | "link" | "impact" | "turn" | "answer" | "extension";

/** How well-supported a flowed row's evidence is, independent of whether it's been answered. */
export type EvidenceStatus = "cited" | "contested" | "unverified";

/** One row of a flow: a heading or an argument, with the rows nested under it. */
export type Box = {
  /** The text typed into the row. */
  content: string;
  /** Rows nested under this one, such as the answers to an argument. */
  children: Box[];
  /** Position of the row among its siblings. */
  index: number;
  /** Nesting depth; 0 is a top-level row. */
  level: number;
  /** True when the cursor is on this row. */
  focus: boolean;
  /** True for a placeholder row with no content yet. */
  empty?: boolean;
  /** Greyed-out hint shown in an empty row. */
  placeholder?: string;
  /** True when the row has been struck through, e.g. an answer the other side dropped. */
  crossed?: boolean;
  /** Marks this row as a collapsible section heading in the flow grid. */
  isHeading?: boolean;
  /** Finer argument-role tag for this row (link/impact/turn/answer/extension/...). */
  argumentType?: ArgumentType;
  /** Id of the debater/speaker who introduced this row, e.g. for outline filtering by contributor. */
  authorId?: string;
  /** How well-supported this row's evidence is. */
  evidenceStatus?: EvidenceStatus;
};

/** One saved flow sheet: a column per speech holding the rows flowed in it. */
export type Flow = {
  /** The sheet's title, e.g. "Case" or "DA: Politics". */
  content: string;
  /** Nesting depth of the sheet when sheets are grouped. */
  level: number;
  /** Column headings, one per speech. */
  columns: string[];
  /** True when the columns are shown in reverse speaking order. */
  invert: boolean;
  /** True when this sheet is the one currently open. */
  focus: boolean;
  /** Position of the sheet among its siblings. */
  index: number;
  /** Cursor path last used on this sheet, so reopening restores it. */
  lastFocus: number[];
  /** The sheet's top-level rows. */
  children: Box[];
  /** Unique id of the sheet. */
  id: number;
  /** Speech-document HTML keyed by speech name (e.g. "1AC"). */
  speechDocs?: Record<string, string>;
  /** Speeches shared with others, keyed by speech name. */
  sharedSpeeches?: Record<
    string,
    {
      /** Epoch ms the speech was shared. */
      timestamp: number;
      /** Email addresses it was shared with. */
      emails: string[];
    }
  >;
  /** True when the sheet has been archived out of the active list. */
  archived?: boolean;
  /** Id of the {@link Round} this sheet belongs to. */
  roundId?: number;
  /** Which speech the sheet was last flowing, as a number in speaking order. */
  speechNumber?: number;
  /** Who won the round this sheet was flowed in. */
  winner?: "aff" | "neg" | "undecided";
};

/** A debate round: who is in it, who judges it and which flows belong to it. */
export type Round = {
  /** Unique id of the round. */
  id: number;
  /** Name of the tournament, e.g. "Glenbrooks". */
  tournamentName: string;
  /** Round level, e.g. "Octos" or "Round 3". */
  roundLevel: string;
  /** The four debaters, two per side. */
  debaters: {
    /** Affirmative debaters. */
    aff: [string, string];
    /** Negative debaters. */
    neg: [string, string];
  };
  /** Each debater's school, in the same order as `debaters`. */
  schools?: {
    /** Affirmative schools. */
    aff: [string, string];
    /** Negative schools. */
    neg: [string, string];
  };
  /** Names of the judges on the panel. */
  judges: string[];
  /** Names of people watching the round. */
  spectators?: string[];
  /** Ids of the {@link Flow} sheets flowed in this round. */
  flowIds: number[];
  /** Epoch ms the round was created. */
  timestamp: number;
  /** Lifecycle: not started, in progress or finished. */
  status: "pending" | "active" | "completed";
  /** True when only the owner may see the round. */
  isPrivate?: boolean;
  /** The side that won, once decided. */
  winner?: "aff" | "neg";
  /** Formatted title: "2025 Glenbrooks - Octos - Lynbrook BZ vs Monta Vista EY". */
  title?: string;
  /** URL slug: "2025-glenbrooks/lynbrook-bz-monta-ey". */
  slug?: string;
};
