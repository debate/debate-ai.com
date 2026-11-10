/**
 * @fileoverview The read and write side of Online Challenges, over the
 * `debate_challenges` table. The rules (`rules.ts`), rewards (`rewards.ts`)
 * and prompts come from `debate-practice-rounds`' `debate-challenges/`; this
 * file stores what they return, runs the AI's turns and the judge, and shapes
 * rows into the board's wire format.
 *
 * Writes are compare-and-set on `updated_at`, so two requests racing on the
 * same round (a speech and a board read that runs the AI) can't both land.
 *
 * Overdue rounds are settled on read: the board, and every update, first
 * expires or forfeits whatever's past its response window. There is no cron —
 * a round nobody looks at stays as it was until one of its debaters opens the
 * board, which is the first moment the result could matter to anyone.
 *
 * @module lib/debate-challenges/store
 */

import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { debateChallenges, notifications, user, type DebateChallengeRow } from "@/lib/database/schema";
import {
  applyAiSpeech,
  applyJudgeDecision,
  availableMoves,
  isVsAi,
  settleOverdue,
  turnOf,
  type ChallengeRoundState,
} from "@debate-ai/practice-rounds/src/debate-challenges/rules";
import { summarizeChallenges, type FinishedChallenge } from "@debate-ai/practice-rounds/src/debate-challenges/rewards";
import { isAiLevel, isChallengeFormat, isChallengeSide, readStoredSpeeches } from "@debate-ai/practice-rounds/src/debate-challenges/validation";
import {
  AI_OPPONENT_ID,
  aiPerson,
  otherSide,
  type AiLevel,
  type ChallengeBoardResponse,
  type ChallengePerson,
  type ChallengeReward,
  type DebateChallenge,
  type DebateChallengeAction,
  type DecisionMethod,
} from "@debate-ai/practice-rounds/src/debate-challenges/types";
import { judgeRound, writeAiSpeech, type ChallengeTextGenerator } from "./ai";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Where every challenge notification sends its reader. */
export const CHALLENGES_LINK = "/practice/challenges";

/** The most of the viewer's challenges one board read returns. */
const CHALLENGE_LIMIT = 200;
/** The most model jobs (AI speeches, judgings) one board read runs. */
const AI_JOBS_PER_READ = 2;
/** The most AI challenges one player may start in a day; each costs a few model calls. */
export const MAX_AI_CHALLENGES_PER_DAY = 10;

const toSeconds = (value: Date | null | undefined): number | null =>
  value ? Math.floor(value.getTime() / 1000) : null;
const toDate = (seconds: number | null): Date | null => (seconds === null ? null : new Date(seconds * 1000));

/** The stored row as the rules read it. */
export function rowToState(row: DebateChallengeRow): ChallengeRoundState {
  return {
    status: row.status as ChallengeRoundState["status"],
    challengerId: row.challengerId,
    opponentId: row.opponentKind === "ai" ? AI_OPPONENT_ID : (row.opponentId ?? ""),
    challengerSide: isChallengeSide(row.challengerSide) ? row.challengerSide : "aff",
    speeches: readStoredSpeeches(row.speeches),
    deadlineAt: toSeconds(row.deadlineAt),
    winnerSide: isChallengeSide(row.winnerSide) ? row.winnerSide : null,
    decisionMethod: (row.decisionMethod as DecisionMethod | null) ?? null,
    completedAt: toSeconds(row.completedAt),
  };
}

/** The columns a state change writes. */
export function stateColumns(state: ChallengeRoundState) {
  return {
    status: state.status,
    speeches: JSON.stringify(state.speeches),
    deadlineAt: toDate(state.deadlineAt),
    winnerSide: state.winnerSide,
    decisionMethod: state.decisionMethod,
    completedAt: toDate(state.completedAt),
  };
}

/**
 * Writes a new state if the row hasn't changed since it was read. Returns the
 * row as written, or `null` when another request got there first.
 */
async function writeState(
  db: Db,
  row: DebateChallengeRow,
  state: ChallengeRoundState,
  extra: Partial<Pick<DebateChallengeRow, "decision">> = {},
): Promise<DebateChallengeRow | null> {
  // Second resolution: bump past the old stamp so the next compare-and-set sees a change.
  const updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1000));
  const columns = { ...stateColumns(state), ...extra, updatedAt };
  const result = await db
    .update(debateChallenges)
    .set(columns)
    .where(and(eq(debateChallenges.id, row.id), eq(debateChallenges.updatedAt, row.updatedAt)))
    .returning();
  return result[0] ?? null;
}

async function notify(db: Db, recipients: string[], title: string, body: string): Promise<void> {
  const ids = recipients.filter((id) => id && id !== AI_OPPONENT_ID);
  if (ids.length === 0) return;
  const now = new Date();
  await db.insert(notifications).values(
    ids.map((userId) => ({ userId, type: "debate_challenge", title, body, link: CHALLENGES_LINK, createdAt: now })),
  );
}

/** Every challenge the viewer is in, newest first. */
export async function listViewerChallenges(db: Db, viewerId: string): Promise<DebateChallengeRow[]> {
  return db
    .select()
    .from(debateChallenges)
    .where(or(eq(debateChallenges.challengerId, viewerId), eq(debateChallenges.opponentId, viewerId)))
    .orderBy(desc(debateChallenges.updatedAt))
    .limit(CHALLENGE_LIMIT);
}

export async function getChallengeRow(db: Db, id: string): Promise<DebateChallengeRow | null> {
  const [row] = await db.select().from(debateChallenges).where(eq(debateChallenges.id, id)).limit(1);
  return row ?? null;
}

/** Expires or forfeits a round past its response window, and tells both sides. */
export async function settleRow(db: Db, row: DebateChallengeRow, nowSeconds: number): Promise<DebateChallengeRow> {
  const state = rowToState(row);
  const settled = settleOverdue(state, nowSeconds);
  if (!settled) return row;
  const written = await writeState(db, row, settled);
  if (!written) return (await getChallengeRow(db, row.id)) ?? row;
  if (settled.status === "complete") {
    const loser = playerOnSide(settled, otherSide(settled.winnerSide!));
    const winner = playerOnSide(settled, settled.winnerSide!);
    await notify(db, [winner], "You won an online challenge on a forfeit", row.topic);
    await notify(db, [loser], "You ran out of time in an online challenge", row.topic);
  }
  return written;
}

function playerOnSide(state: ChallengeRoundState, side: "aff" | "neg"): string {
  return side === state.challengerSide ? state.challengerId : state.opponentId;
}

/**
 * Runs the model work a round is waiting on: the AI's speech when it is the
 * AI's turn, then the judge once all four speeches are in. Returns the row as
 * it ends up; a model that didn't answer leaves the row as it was.
 */
export async function advanceRow(
  db: Db,
  row: DebateChallengeRow,
  generate: ChallengeTextGenerator,
  nowSeconds: number,
): Promise<DebateChallengeRow> {
  let current = row;
  let state = rowToState(current);

  if (isVsAi(state) && turnOf(state) === AI_OPPONENT_ID) {
    const level: AiLevel = isAiLevel(current.aiLevel) ? current.aiLevel : "varsity";
    const text = await writeAiSpeech(generate, { format: fmt(current), topic: current.topic, speeches: state.speeches }, level);
    const next = text ? applyAiSpeech(state, text, nowSeconds) : null;
    if (!next) return current;
    const written = await writeState(db, current, next);
    if (!written) return (await getChallengeRow(db, row.id)) ?? current;
    current = written;
    state = next;
  }

  if (state.status === "judging") {
    const decision = await judgeRound(generate, { format: fmt(current), topic: current.topic, speeches: state.speeches });
    const next = decision ? applyJudgeDecision(state, decision.winner, nowSeconds) : null;
    if (!next || !decision) return current;
    const written = await writeState(db, current, next, { decision: decision.reason.slice(0, 4000) });
    if (!written) return (await getChallengeRow(db, row.id)) ?? current;
    current = written;
    const winner = playerOnSide(next, decision.winner);
    const loser = playerOnSide(next, otherSide(decision.winner));
    await notify(db, [winner], "You won an online challenge", current.topic);
    await notify(db, [loser], "The judge decided your online challenge", current.topic);
  }
  return current;
}

function fmt(row: DebateChallengeRow) {
  return isChallengeFormat(row.format) ? row.format : "pf";
}

/** Whether the round is waiting on a model call. */
export function needsModel(row: DebateChallengeRow): boolean {
  const state = rowToState(row);
  return state.status === "judging" || (isVsAi(state) && turnOf(state) === AI_OPPONENT_ID);
}

/** The viewer's side of a finished row, for the reward rules; `null` for unfinished rows. */
function finishedFor(row: DebateChallengeRow, viewerId: string): FinishedChallenge | null {
  const state = rowToState(row);
  if (state.status !== "complete" || !state.winnerSide || !state.decisionMethod) return null;
  const isChallenger = row.challengerId === viewerId;
  return {
    id: row.id,
    format: fmt(row),
    vsAi: isVsAi(state),
    aiLevel: row.aiLevel,
    viewerSide: isChallenger ? state.challengerSide : otherSide(state.challengerSide),
    winnerSide: state.winnerSide,
    decisionMethod: state.decisionMethod,
    completedAt: state.completedAt ?? toSeconds(row.updatedAt) ?? 0,
    claimed: isChallenger ? row.challengerClaimed : row.opponentClaimed,
  };
}

async function hydratePeople(db: Db, ids: Iterable<string>): Promise<Map<string, ChallengePerson>> {
  const unique = [...new Set(ids)].filter((id) => id && id !== AI_OPPONENT_ID);
  if (unique.length === 0) return new Map();
  const rows: { id: string; name: string; image: string | null }[] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, imageUrl: row.image ?? null }]));
}

const UNKNOWN_PERSON: ChallengePerson = { id: "deleted", name: "Former member", imageUrl: null };

/** One row as the board shows it to `viewerId`. */
export function toView(
  row: DebateChallengeRow,
  viewerId: string,
  people: Map<string, ChallengePerson>,
  reward: ChallengeReward | null,
  nowSeconds: number,
): DebateChallenge {
  const state = rowToState(row);
  const vsAi = isVsAi(state);
  const aiLevel: AiLevel | null = vsAi ? (isAiLevel(row.aiLevel) ? row.aiLevel : "varsity") : null;
  const isChallenger = row.challengerId === viewerId;
  const moves: DebateChallengeAction[] = availableMoves(state, viewerId, nowSeconds);
  if (reward && !reward.claimed && reward.xp > 0) moves.push("claim");
  return {
    id: row.id,
    status: state.status,
    format: fmt(row),
    topic: row.topic,
    note: row.note,
    challenger: people.get(row.challengerId) ?? UNKNOWN_PERSON,
    opponent: vsAi ? aiPerson(aiLevel ?? "varsity") : (people.get(row.opponentId ?? "") ?? UNKNOWN_PERSON),
    vsAi,
    aiLevel,
    challengerSide: state.challengerSide,
    viewerSide: isChallenger ? state.challengerSide : otherSide(state.challengerSide),
    speeches: state.speeches,
    turnId: turnOf(state),
    deadlineAt: state.deadlineAt,
    winnerSide: state.winnerSide,
    decisionMethod: state.decisionMethod,
    decision: row.decision,
    reward,
    moves,
    createdAt: toSeconds(row.createdAt) ?? 0,
    updatedAt: toSeconds(row.updatedAt) ?? 0,
    completedAt: state.completedAt,
  };
}

/** Views of `rows` for `viewerId`, with rewards worked out over all of their finished rounds. */
export async function viewsFor(
  db: Db,
  rows: DebateChallengeRow[],
  viewerId: string,
  nowSeconds: number,
): Promise<{ views: DebateChallenge[]; summary: ReturnType<typeof summarizeChallenges> }> {
  const summary = summarizeChallenges(rows.map((row) => finishedFor(row, viewerId)).filter((f): f is FinishedChallenge => f !== null));
  const people = await hydratePeople(db, rows.flatMap((row) => [row.challengerId, row.opponentId ?? ""]));
  const views = rows.map((row) => toView(row, viewerId, people, summary.rewards.get(row.id) ?? null, nowSeconds));
  return { views, summary };
}

/**
 * The whole board: settles overdue rounds, runs up to {@link AI_JOBS_PER_READ}
 * pending model jobs, then shapes everything for the viewer.
 */
export async function loadBoard(
  db: Db,
  viewer: ChallengePerson,
  generate: ChallengeTextGenerator,
  nowSeconds: number,
): Promise<ChallengeBoardResponse> {
  let rows = await listViewerChallenges(db, viewer.id);
  rows = await Promise.all(rows.map((row) => settleRow(db, row, nowSeconds)));
  let jobs = 0;
  for (let i = 0; i < rows.length && jobs < AI_JOBS_PER_READ; i++) {
    if (!needsModel(rows[i])) continue;
    jobs += 1;
    rows[i] = await advanceRow(db, rows[i], generate, nowSeconds);
  }
  const { views, summary } = await viewsFor(db, rows, viewer.id, nowSeconds);
  return { viewer, challenges: views, stats: summary.stats, trophies: summary.trophies };
}

/** Stores a new challenge row. */
export async function insertChallengeRow(
  db: Db,
  input: {
    id: string;
    challengerId: string;
    opponentId: string;
    aiLevel: AiLevel | null;
    format: string;
    topic: string;
    note: string;
    state: ChallengeRoundState;
  },
): Promise<DebateChallengeRow> {
  const vsAi = input.opponentId === AI_OPPONENT_ID;
  const now = new Date();
  const [row] = await db
    .insert(debateChallenges)
    .values({
      id: input.id,
      challengerId: input.challengerId,
      opponentId: vsAi ? null : input.opponentId,
      opponentKind: vsAi ? "ai" : "user",
      aiLevel: vsAi ? input.aiLevel : null,
      format: input.format,
      topic: input.topic,
      note: input.note,
      challengerSide: input.state.challengerSide,
      ...stateColumns(input.state),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** Challenges the viewer sent to players that are still waiting on a first answer. */
export async function countPendingSent(db: Db, viewerId: string): Promise<number> {
  const rows = await db
    .select({ id: debateChallenges.id })
    .from(debateChallenges)
    .where(
      and(
        eq(debateChallenges.challengerId, viewerId),
        eq(debateChallenges.status, "pending"),
        eq(debateChallenges.opponentKind, "user"),
      ),
    );
  return rows.length;
}

/** Whether the viewer already has a challenge waiting on this opponent. */
export async function hasPendingWith(db: Db, viewerId: string, opponentId: string): Promise<boolean> {
  const rows = await db
    .select({ id: debateChallenges.id })
    .from(debateChallenges)
    .where(
      and(
        eq(debateChallenges.challengerId, viewerId),
        eq(debateChallenges.opponentId, opponentId),
        eq(debateChallenges.status, "pending"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** AI challenges the viewer started in the last day. */
export async function countAiChallengesSince(db: Db, viewerId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ id: debateChallenges.id })
    .from(debateChallenges)
    .where(
      and(
        eq(debateChallenges.challengerId, viewerId),
        eq(debateChallenges.opponentKind, "ai"),
        gte(debateChallenges.createdAt, since),
      ),
    );
  return rows.length;
}

/**
 * Writes a move's new state and notifies the people it names. Returns the row
 * as written, or `null` when the round changed under the request.
 */
export async function writeMove(
  db: Db,
  row: DebateChallengeRow,
  next: ChallengeRoundState,
  recipients: string[],
  notice: { title: string; body: string },
): Promise<DebateChallengeRow | null> {
  const written = await writeState(db, row, next);
  if (written) await notify(db, recipients, notice.title, notice.body);
  return written;
}

/** Marks the viewer's reward collected. `false` when it already was (or the round isn't theirs). */
export async function claimReward(db: Db, row: DebateChallengeRow, viewerId: string): Promise<boolean> {
  const isChallenger = row.challengerId === viewerId;
  if (!isChallenger && row.opponentId !== viewerId) return false;
  const column = isChallenger ? debateChallenges.challengerClaimed : debateChallenges.opponentClaimed;
  const result = await db
    .update(debateChallenges)
    .set(isChallenger ? { challengerClaimed: true } : { opponentClaimed: true })
    .where(and(eq(debateChallenges.id, row.id), eq(debateChallenges.status, "complete"), eq(column, false)))
    .returning({ id: debateChallenges.id });
  return result.length > 0;
}

export { notify as notifyChallengePlayers };
