/**
 * Judge ballots: what a judge submits from the tournaments UI's **Ballot**
 * tab, how it is validated, and the tool definition that lets an AI agent
 * submit the same ballot through the host app's local API.
 *
 * Pure and framework-free, so the UI, the host app's route and its tests all
 * share one set of rules. The host app owns storage and the forward to
 * Tabroom (in debate-ai.com: `lib/tournaments/judge-ballots.ts`, mounted at
 * `/api/judge-ballots`).
 *
 * A ballot is only accepted when the email of the Tabroom account it is
 * submitted under matches the email the judge is signed in to the host app
 * with — see {@link emailsMatch}.
 */

/** Where a ballot goes: the host app's own API, or on to Tabroom as well. */
export type BallotDestination = "local" | "tabroom";

export const BALLOT_DESTINATIONS: readonly BallotDestination[] = ["local", "tabroom"];

export type BallotSide = "aff" | "neg";

/** One speaker's points on a ballot. */
export interface BallotSpeakerPoints {
  /** The debater's name or code as the judge writes it. */
  speaker: string;
  side: BallotSide;
  points: number;
}

/** The ballot a judge submits. */
export interface JudgeBallotInput {
  /** Tabroom tourn id. */
  tournId: number;
  tournamentName?: string;
  /** Event abbreviation, e.g. `VCX`. */
  event: string;
  /** Round name or label, e.g. `3` or `Octas`. */
  round: string;
  room?: string;
  /** Entry codes for each side. */
  aff: string;
  neg: string;
  winner: BallotSide;
  /** Low-point win: the winner was given fewer points than the loser. */
  lowPointWin?: boolean;
  speakerPoints?: BallotSpeakerPoints[];
  /** Reason for decision. */
  rfd?: string;
  /** The email of the Tabroom account the ballot is submitted under. */
  tabroomEmail: string;
  destination: BallotDestination;
}

/** A ballot as stored and returned by the host app's API. */
export interface StoredJudgeBallot extends Omit<JudgeBallotInput, "speakerPoints"> {
  id: string;
  speakerPoints: BallotSpeakerPoints[];
  judgeEmail: string;
  /** `null` for a local-only ballot; otherwise how the forward to Tabroom went. */
  tabroomStatus: "sent" | "failed" | "unavailable" | null;
  tabroomDetail: string | null;
  createdAt: string;
}

/** What `GET <ballotApiBase>/account` answers: may this judge submit? */
export interface BallotAccountCheck {
  signedIn: boolean;
  /** The email the judge is signed in to the host app with. */
  email: string | null;
  /** A Tabroom person with that email, when the host's Tabroom data has one. */
  tabroomPerson: { id: number; name: string; email: string } | null;
  /** Whether the forward to Tabroom is set up on this server. */
  tabroomForwarding: boolean;
}

export const RFD_MAX_LENGTH = 10_000;
const FIELD_MAX_LENGTH = 200;
/** The widest speaker point scale in use (0–30, with a 100-point outlier scale for some speech events). */
const POINTS_MAX = 100;

/** Lowercased, trimmed — Tabroom stores emails lowercased too. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** True when both are real emails and name the same address, ignoring case and surrounding space. */
export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEmail(a);
  return left.includes("@") && left === normalizeEmail(b);
}

export type BallotValidation = { ok: true; ballot: JudgeBallotInput } | { ok: false; errors: string[] };

const text = (value: unknown, max = FIELD_MAX_LENGTH) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * Checks a ballot from an untrusted caller (the form, or an agent's tool
 * call) and returns it trimmed, or every problem with it.
 */
export function validateJudgeBallot(raw: unknown): BallotValidation {
  const errors: string[] = [];
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const tournId = Number(input.tournId);
  if (!Number.isInteger(tournId) || tournId <= 0) errors.push("tournId must be a positive whole number.");

  const event = text(input.event);
  const round = text(input.round);
  const aff = text(input.aff);
  const neg = text(input.neg);
  if (!event) errors.push("event is required.");
  if (!round) errors.push("round is required.");
  if (!aff) errors.push("aff is required.");
  if (!neg) errors.push("neg is required.");
  if (aff && neg && aff.toLowerCase() === neg.toLowerCase()) errors.push("aff and neg must be different entries.");

  const winner = input.winner;
  if (winner !== "aff" && winner !== "neg") errors.push('winner must be "aff" or "neg".');

  const destination = input.destination ?? "local";
  if (!BALLOT_DESTINATIONS.includes(destination as BallotDestination)) errors.push('destination must be "local" or "tabroom".');

  const tabroomEmail = normalizeEmail(typeof input.tabroomEmail === "string" ? input.tabroomEmail : "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tabroomEmail)) errors.push("tabroomEmail must be the email of your Tabroom account.");

  if (typeof input.rfd === "string" && input.rfd.length > RFD_MAX_LENGTH) {
    errors.push(`rfd is limited to ${RFD_MAX_LENGTH} characters.`);
  }

  const speakerPoints: BallotSpeakerPoints[] = [];
  if (input.speakerPoints !== undefined) {
    if (!Array.isArray(input.speakerPoints)) {
      errors.push("speakerPoints must be a list.");
    } else {
      input.speakerPoints.forEach((row, i) => {
        const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
        const speaker = text(r.speaker);
        const points = Number(r.points);
        if (!speaker) errors.push(`speakerPoints[${i}].speaker is required.`);
        if (r.side !== "aff" && r.side !== "neg") errors.push(`speakerPoints[${i}].side must be "aff" or "neg".`);
        if (!Number.isFinite(points) || points < 0 || points > POINTS_MAX) {
          errors.push(`speakerPoints[${i}].points must be between 0 and ${POINTS_MAX}.`);
        }
        speakerPoints.push({ speaker, side: r.side as BallotSide, points });
      });
    }
  }

  if (errors.length) return { ok: false, errors };
  const tournamentName = text(input.tournamentName);
  const room = text(input.room);
  const rfd = typeof input.rfd === "string" ? input.rfd.trim() : "";
  return {
    ok: true,
    ballot: {
      tournId,
      ...(tournamentName ? { tournamentName } : {}),
      event,
      round,
      ...(room ? { room } : {}),
      aff,
      neg,
      winner: winner as BallotSide,
      ...(input.lowPointWin === true ? { lowPointWin: true } : {}),
      ...(speakerPoints.length ? { speakerPoints } : {}),
      ...(rfd ? { rfd } : {}),
      tabroomEmail,
      destination: destination as BallotDestination,
    },
  };
}

/**
 * The `submit_judge_ballot` tool, in the JSON-schema shape Anthropic's and
 * OpenAI's tool-calling APIs (and MCP's `tools/list`) accept. An agent acting
 * for a signed-in judge calls the host's local ballot API (`POST
 * /api/judge-ballots` in debate-ai.com) with exactly these arguments; the
 * email rule still applies, so an agent can only file a ballot for the judge
 * whose session it holds.
 */
export const SUBMIT_JUDGE_BALLOT_TOOL = {
  name: "submit_judge_ballot",
  description:
    "Submit a judge's ballot for one debate round. The ballot is stored by Debate AI and, when destination is \"tabroom\", " +
    "also sent to Tabroom. The signed-in Debate AI user's email must match tabroomEmail, or the ballot is rejected.",
  input_schema: {
    type: "object",
    properties: {
      tournId: { type: "integer", description: "Tabroom tournament id." },
      tournamentName: { type: "string" },
      event: { type: "string", description: "Event abbreviation, e.g. VCX." },
      round: { type: "string", description: "Round name or label, e.g. 3 or Octas." },
      room: { type: "string" },
      aff: { type: "string", description: "Affirmative (or Pro) entry code." },
      neg: { type: "string", description: "Negative (or Con) entry code." },
      winner: { type: "string", enum: ["aff", "neg"] },
      lowPointWin: { type: "boolean" },
      speakerPoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            speaker: { type: "string" },
            side: { type: "string", enum: ["aff", "neg"] },
            points: { type: "number", minimum: 0, maximum: POINTS_MAX },
          },
          required: ["speaker", "side", "points"],
        },
      },
      rfd: { type: "string", description: "Reason for decision.", maxLength: RFD_MAX_LENGTH },
      tabroomEmail: { type: "string", description: "Email of the judge's Tabroom account." },
      destination: { type: "string", enum: ["local", "tabroom"], default: "local" },
    },
    required: ["tournId", "event", "round", "aff", "neg", "winner", "tabroomEmail"],
  },
} as const;

/**
 * The table the host app keeps ballots in. Also shipped as
 * `migrations/0002_judge_ballots.sql`; the host runs this on first use too, so
 * a database that never ran the migration (local libSQL, a separate
 * `tabroom_db`) still works.
 */
export const JUDGE_BALLOT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "judge_ballot" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "judge_email" TEXT NOT NULL,
  "tabroom_email" TEXT NOT NULL,
  "tourn_id" INTEGER NOT NULL,
  "tournament_name" TEXT,
  "event" TEXT NOT NULL,
  "round" TEXT NOT NULL,
  "room" TEXT,
  "aff" TEXT NOT NULL,
  "neg" TEXT NOT NULL,
  "winner" TEXT NOT NULL,
  "low_point_win" INTEGER NOT NULL DEFAULT 0,
  "speaker_points" TEXT NOT NULL DEFAULT '[]',
  "rfd" TEXT,
  "destination" TEXT NOT NULL,
  "tabroom_status" TEXT,
  "tabroom_detail" TEXT,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export const JUDGE_BALLOT_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "judge_ballot__user_tourn" ON "judge_ballot" ("user_id", "tourn_id")`;
