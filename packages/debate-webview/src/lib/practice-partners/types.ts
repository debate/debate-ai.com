/**
 * @fileoverview The Practice Partners wire format — what `/api/practice-partners`
 * sends and what the practice board reads.
 *
 * ## What the feature is made of
 *
 * Two things, each its own table:
 *
 * - A **practice profile**, one per account: whether the debater is open to
 *   being challenged (as a competitor), whether they volunteer to judge, and
 *   the preferences a partner should know before asking — formats, styles,
 *   speed, level, availability. A profile with both roles off is hidden from
 *   the board; it is kept rather than deleted so switching back on does not
 *   cost the debater their preferences.
 * - A **challenge**: one debater asking another to a virtual practice round,
 *   optionally with a volunteer judge invited, and moving through
 *   {@link ChallengeStatus}. An accepted round without a judge is listed for
 *   every judge volunteer to pick up.
 *
 * ## Why the vocabulary lives here
 *
 * The option lists and limits are read by the UI (chips, selects, counters) and
 * by the app's `lib/practice-partners/validation.ts` (which refuses anything
 * off the list). Keeping one copy is what stops the API from accepting a style
 * the form cannot show, or the form from offering one the API rejects — the
 * same reason `lib/forums/types.ts` owns the forum limits.
 *
 * @module lib/practice-partners/types
 */

/** Formats a practice round can be run in. Ids are stored; labels are shown. */
export const PRACTICE_FORMATS = [
  { id: "pf", label: "Public Forum" },
  { id: "ld", label: "Lincoln-Douglas" },
  { id: "policy", label: "Policy" },
  { id: "parli", label: "Parliamentary" },
  { id: "worlds", label: "Worlds / BP" },
  { id: "congress", label: "Congress" },
] as const;

/**
 * Argument styles a debater is comfortable debating (or, for a judge,
 * comfortable evaluating). Deliberately coarse: these are the categories a
 * paradigm or a pre-round conversation actually uses, not a taxonomy.
 */
export const PRACTICE_STYLES = [
  { id: "traditional", label: "Traditional / lay" },
  { id: "progressive", label: "Progressive / tech" },
  { id: "policy-args", label: "Plans, CPs & DAs" },
  { id: "critiques", label: "Critiques" },
  { id: "theory", label: "Theory & T" },
  { id: "phil", label: "Philosophy / framework" },
  { id: "truth-testing", label: "Truth-testing" },
] as const;

/** Delivery speed, slowest first — the order {@link speedsCompatible} relies on. */
export const PRACTICE_SPEEDS = [
  { id: "conversational", label: "Conversational" },
  { id: "moderate", label: "Moderate" },
  { id: "fast", label: "Fast / spreading" },
] as const;

/** Experience level, least experienced first. */
export const PRACTICE_LEVELS = [
  { id: "novice", label: "Novice" },
  { id: "jv", label: "JV" },
  { id: "varsity", label: "Varsity" },
  { id: "college", label: "College" },
  { id: "coach", label: "Coach / alum" },
] as const;

export type PracticeFormat = (typeof PRACTICE_FORMATS)[number]["id"];
export type PracticeStyle = (typeof PRACTICE_STYLES)[number]["id"];
export type PracticeSpeed = (typeof PRACTICE_SPEEDS)[number]["id"];
export type PracticeLevel = (typeof PRACTICE_LEVELS)[number]["id"];

/** The longest a profile's availability line may be, in characters. */
export const MAX_AVAILABILITY_LENGTH = 140;
/** The longest a profile's free-text note may be, in characters. */
export const MAX_PROFILE_NOTE_LENGTH = 500;
/** The longest a challenge's resolution/topic line may be, in characters. */
export const MAX_TOPIC_LENGTH = 200;
/** The longest a challenge's message may be, in characters. */
export const MAX_CHALLENGE_MESSAGE_LENGTH = 500;
/**
 * How many challenges one debater may have waiting on an answer at once.
 *
 * The board lists people who asked to be challenged, and a notification lands
 * with every challenge — a cap is what keeps "open to challenges" from also
 * meaning "open to being flooded". Ten is more than anyone schedules in a week.
 */
export const MAX_PENDING_OUTGOING = 10;

/** The preferences half of a profile — everything but who owns it and which roles are on. */
export interface PracticePreferences {
  formats: PracticeFormat[];
  styles: PracticeStyle[];
  speed: PracticeSpeed;
  level: PracticeLevel;
  /** Free text: "weeknights after 7pm ET", "weekends". */
  availability: string;
  /** Free text: what the debater wants to work on, or anything a partner should know. */
  note: string;
}

/** A profile as its owner edits it. */
export interface PracticeProfileInput extends PracticePreferences {
  /** Open to being challenged to a practice round. */
  asCompetitor: boolean;
  /** Volunteering to judge other people's practice rounds. */
  asJudge: boolean;
}

/** Public fields of an account — never an email. */
export interface PracticePerson {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** One volunteer on the board. */
export interface PracticeVolunteer extends PracticeProfileInput {
  person: PracticePerson;
  /** Unix seconds — when the profile was last saved, as a freshness hint. */
  updatedAt: number;
}

/** The profile a debater starts from before they have saved one. */
export const DEFAULT_PRACTICE_PROFILE: PracticeProfileInput = {
  asCompetitor: false,
  asJudge: false,
  formats: [],
  styles: [],
  speed: "moderate",
  level: "novice",
  availability: "",
  note: "",
};

/**
 * Where a challenge is in its life.
 *
 * `pending` → `accepted` | `declined` by the opponent, or `cancelled` by the
 * challenger. An `accepted` round can still be `cancelled` by either debater
 * (plans change); `declined` and `cancelled` are final.
 */
export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled";

/**
 * Where the judge seat is. `null` with no judge; `invited` when the challenger
 * named one and they have not answered; `confirmed` once a judge has agreed —
 * either by answering the invitation or by picking up an unjudged round.
 */
export type JudgeStatus = "invited" | "confirmed" | null;

/** A challenge as the board shows it to one of the people in it (or a prospective judge). */
export interface PracticeChallenge {
  id: string;
  status: ChallengeStatus;
  challenger: PracticePerson;
  opponent: PracticePerson;
  judge: PracticePerson | null;
  judgeStatus: JudgeStatus;
  format: PracticeFormat;
  topic: string;
  message: string;
  /** Proposed start, Unix seconds, or `null` for "let's work it out". */
  proposedAt: number | null;
  /**
   * The webcam room everyone in the round joins from the round workspace's
   * Cameras panel. Minted with the challenge so both sides (and the judge)
   * already agree on it the moment the round is accepted.
   */
  roomId: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. */
  updatedAt: number;
}

/**
 * Everything one person can do to a challenge. Which of these a given viewer
 * may take is decided by `./challenge-actions.ts`, which the API enforces and
 * the board reads to decide which buttons to show.
 */
export type ChallengeAction =
  | "accept"
  | "decline"
  | "cancel"
  | "confirm-judge"
  | "decline-judge"
  | "volunteer-judge"
  | "withdraw-judge";

/** What `GET /api/practice-partners` returns. */
export interface PracticeBoardResponse {
  viewer: PracticePerson;
  /** The viewer's own profile, or `null` before they have saved one. */
  profile: PracticeProfileInput | null;
  /** Challenges the viewer is in — as challenger, opponent or judge — newest first. */
  challenges: PracticeChallenge[];
  /**
   * Accepted rounds that still need a judge, shown only to judge volunteers and
   * never including rounds the viewer debates in.
   */
  openToJudge: PracticeChallenge[];
}

/**
 * One partner found by `POST /api/practice-partners/match` — what they are
 * comfortable with and how well it suits the viewer, but never who they are.
 * No name, no avatar, no account id and no free-text note (the one field a
 * debater might sign): the only handle on the person is {@link token}, an
 * opaque, short-lived reference the server alone can read, which is what a
 * request to them is sent with.
 */
export interface AnonymousPracticeMatch {
  /** Opaque reference to the matched debater — send it back as `matchToken`. */
  token: string;
  /** 0–100, from `lib/practice-partners/match.ts`. */
  score: number;
  /** "Great match" / "Good match", or `null`. */
  label: string | null;
  formats: PracticeFormat[];
  styles: PracticeStyle[];
  sharedFormats: PracticeFormat[];
  sharedStyles: PracticeStyle[];
  speed: PracticeSpeed;
  level: PracticeLevel;
  /** Whether they also volunteer to judge. */
  alsoJudges: boolean;
}

/** The body of `POST /api/practice-partners/match`. */
export interface FindMatchRequest {
  /** Only match debaters who list this format (or list none). */
  format?: PracticeFormat | null;
  /** Tokens already shown this session, so "Find another" skips them. */
  exclude?: string[];
}

/** What `POST /api/practice-partners/match` returns; `match` is `null` when nobody suitable is open. */
export interface FindMatchResponse {
  match: AnonymousPracticeMatch | null;
}

/** The most already-seen tokens one match request may exclude. */
export const MAX_MATCH_EXCLUDES = 25;

/**
 * Stand-in for the other debater on a challenge that has not been accepted:
 * matches are anonymous on both sides until the opponent says yes.
 */
export const ANONYMOUS_PRACTICE_PERSON: PracticePerson = {
  id: "anonymous",
  name: "Your practice match",
  imageUrl: null,
};

/** The body of `POST /api/practice-partners/challenges`. */
export interface NewChallenge {
  /** A known debater's id — or omit it and send {@link matchToken} for an anonymous match. */
  opponentId?: string;
  /** From {@link AnonymousPracticeMatch.token}; the server resolves it to the opponent. */
  matchToken?: string;
  judgeId?: string | null;
  format: PracticeFormat;
  topic: string;
  message?: string;
  /** Unix seconds, or `null`/absent for no proposed time. */
  proposedAt?: number | null;
}

/** Label for an id from one of the option lists, falling back to the id itself. */
export function optionLabel(
  options: readonly { id: string; label: string }[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

