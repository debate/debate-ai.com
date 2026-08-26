/** Competitive sides. */
export type Side = "aff" | "neg";

/** One debater's name. */
export interface Debater {
    first: string;
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
    vote?: "aff" | "neg";
    rfd?: string;
    /** EndpointId to that peer's own reasoning. Additive and optional. */
    peerNotes?: Record<string, string>;
}

/** Scouting / Info-sheet data, mirroring the Excel Info sheet. */
export interface Scouting {
    affSchool?: string;
    negSchool?: string;
    /** Aff debaters: first = 1A, second = 2A. */
    aff: { first: Debater; second: Debater };
    /** Neg debaters: first = 1N, second = 2N. */
    neg: { first: Debater; second: Debater };
    tournament?: string;
    round?: string;
    /** Flight within the round (e.g. "1"/"2"), for events that split a round into flights. */
    flight?: string;
    date?: string;
    judge?: string;
    decision?: Decision;
}
