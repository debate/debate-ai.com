/** Competitive sides. */
export type Side = "aff" | "neg";

/** One debater's name. */
export interface Debater {
  /** Given name. */
  first: string;
  /** Family name. */
  last: string;
}

/**
 * Round result as recorded for scouting.
 *
 * `rfd` is this machine owner's own notes and nothing else. A partner's
 * reasoning arrives under their EndpointId in `peerNotes`, so there is exactly
 * one writer per field and the two can never overwrite each other. The two
 * files are asymmetric by design: on your disk `rfd` is yours, on theirs it is
 * theirs.
 */
export interface Decision {
  /** The side the judge voted for. */
  vote?: "aff" | "neg";
  /** The reason for decision, in the machine owner's own words. */
  rfd?: string;
  /** EndpointId to that peer's own reasoning. Additive and optional. */
  peerNotes?: Record<string, string>;
}

/** Scouting / Info-sheet data, mirroring the Excel Info sheet. */
export interface Scouting {
  /** Affirmative team's school. */
  affSchool?: string;
  /** Negative team's school. */
  negSchool?: string;
  /** Aff debaters: first = 1A, second = 2A. */
  aff: { first: Debater; second: Debater };
  /** Neg debaters: first = 1N, second = 2N. */
  neg: { first: Debater; second: Debater };
  /** Tournament name. */
  tournament?: string;
  /** Round label, e.g. "Round 4" or "Finals". */
  round?: string;
  /** Flight within the round (e.g. "1"/"2"), for events that split a round into flights. */
  flight?: string;
  /** Date of the round, as the user typed it. */
  date?: string;
  /** Name of the judge. */
  judge?: string;
  /** How the round was decided. */
  decision?: Decision;
}
