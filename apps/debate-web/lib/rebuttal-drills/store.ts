/**
 * @fileoverview The read and write side of Rebuttal Playlists drills, over the
 * `rebuttal_drills` table. The rules, prompts and playlists come from
 * `debate-practice-rounds`' `rebuttal-playlists/`; this file stores what the
 * rules return, pairs students, runs the AI partner, coach and judge, and
 * shapes rows into the page's wire format.
 *
 * Writes are compare-and-set on `updated_at`, so two students joining the
 * same waiting drill at once can't both land — the loser is simply paired
 * elsewhere (or starts their own waiting drill).
 *
 * Model calls go through the Online Challenges key path
 * (`lib/debate-challenges/ai.ts`): the caller's own key first, then the
 * site's shared keys. A call that fails leaves the drill where it was, and
 * the next board read tries again.
 *
 * @module lib/rebuttal-drills/store
 */

import { and, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { notifications, rebuttalDrills, user, type RebuttalDrillRow } from "@/lib/database/schema";
import type { ChallengeTextGenerator } from "@/lib/debate-challenges/ai";
import { isChallengeFormat } from "@debate-ai/practice-rounds/src/debate-challenges/validation";
import { otherSide } from "@debate-ai/practice-rounds/src/debate-challenges/types";
import { findPlaylistVideo } from "@debate-ai/practice-rounds/src/rebuttal-playlists/playlists";
import {
  aiRebuttalPrompt,
  coachPrompt,
  drillJudgePrompt,
  parseDrillJudgeReply,
  type DrillPromptRound,
} from "@debate-ai/practice-rounds/src/rebuttal-playlists/prompts";
import {
  aiOwesRebuttal,
  applyAiRebuttal,
  applyDrillDecision,
  availableDrillMoves,
  isVsAi,
  joinDrill,
  pickPartnerDrill,
  seatCoachUses,
  seatHolder,
  seatText,
  type DrillState,
} from "@debate-ai/practice-rounds/src/rebuttal-playlists/rules";
import { isDrillSide, isDrillStatus } from "@debate-ai/practice-rounds/src/rebuttal-playlists/validation";
import {
  AI_PARTNER_ID,
  MAX_COACH_USES,
  PARTNER_WAIT_SECONDS,
  type DrillFormat,
  type DrillPerson,
  type DrillSide,
  type OpenSeatCount,
  type RebuttalBoardResponse,
  type RebuttalDrill,
  type RebuttalDrillSeat,
} from "@debate-ai/practice-rounds/src/rebuttal-playlists/types";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Where every drill notification sends its reader. */
export const REBUTTAL_DRILLS_LINK = "/practice/debates?section=drills";

/** The most of the viewer's drills one board read returns. */
const DRILL_LIMIT = 300;
/** The most model jobs (AI rebuttals, judgings) one board read runs. */
const AI_JOBS_PER_READ = 2;

const REBUTTAL_MAX_TOKENS = 1000;
const COACH_MAX_TOKENS = 600;
const JUDGE_MAX_TOKENS = 700;

const toSeconds = (value: Date | null | undefined): number | null =>
  value ? Math.floor(value.getTime() / 1000) : null;
const toDate = (seconds: number | null): Date | null => (seconds === null ? null : new Date(seconds * 1000));

/** The stored row as the rules read it. */
export function rowToState(row: RebuttalDrillRow): DrillState {
  return {
    status: isDrillStatus(row.status) ? row.status : "writing",
    creatorId: row.creatorId,
    creatorSide: isDrillSide(row.creatorSide) ? row.creatorSide : "aff",
    partnerId: row.partnerKind === "ai" ? AI_PARTNER_ID : (row.partnerId ?? null),
    creatorText: row.creatorText,
    partnerText: row.partnerText,
    creatorCoachUses: row.creatorCoachUses,
    partnerCoachUses: row.partnerCoachUses,
    winnerSide: isDrillSide(row.winnerSide) ? row.winnerSide : null,
    createdAt: toSeconds(row.createdAt) ?? 0,
    completedAt: toSeconds(row.completedAt),
  };
}

/** The columns a state change writes. */
function stateColumns(state: DrillState) {
  const ai = state.partnerId === AI_PARTNER_ID;
  return {
    status: state.status,
    partnerId: ai ? null : state.partnerId,
    partnerKind: ai ? "ai" : state.partnerId ? "user" : "none",
    creatorText: state.creatorText,
    partnerText: state.partnerText,
    creatorCoachUses: state.creatorCoachUses,
    partnerCoachUses: state.partnerCoachUses,
    winnerSide: state.winnerSide,
    completedAt: toDate(state.completedAt),
  };
}

/**
 * Writes a new state if the row hasn't changed since it was read. Returns the
 * row as written, or `null` when another request got there first.
 */
export async function writeDrillState(
  db: Db,
  row: RebuttalDrillRow,
  state: DrillState,
  extra: Partial<Pick<RebuttalDrillRow, "decision">> = {},
): Promise<RebuttalDrillRow | null> {
  const updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1000));
  const result = await db
    .update(rebuttalDrills)
    .set({ ...stateColumns(state), ...extra, updatedAt })
    .where(and(eq(rebuttalDrills.id, row.id), eq(rebuttalDrills.updatedAt, row.updatedAt)))
    .returning();
  return result[0] ?? null;
}

export async function notifyDrillPlayers(db: Db, recipients: string[], title: string, body: string): Promise<void> {
  const ids = recipients.filter((id) => id && id !== AI_PARTNER_ID);
  if (ids.length === 0) return;
  const now = new Date();
  await db.insert(notifications).values(
    ids.map((userId) => ({ userId, type: "rebuttal_drill", title, body, link: REBUTTAL_DRILLS_LINK, createdAt: now })),
  );
}

export async function getDrillRow(db: Db, id: string): Promise<RebuttalDrillRow | null> {
  const [row] = await db.select().from(rebuttalDrills).where(eq(rebuttalDrills.id, id)).limit(1);
  return row ?? null;
}

/** Every drill the viewer is in, newest first. */
export async function listViewerDrills(db: Db, viewerId: string): Promise<RebuttalDrillRow[]> {
  return db
    .select()
    .from(rebuttalDrills)
    .where(or(eq(rebuttalDrills.creatorId, viewerId), eq(rebuttalDrills.partnerId, viewerId)))
    .orderBy(desc(rebuttalDrills.updatedAt))
    .limit(DRILL_LIMIT);
}

/** Other students' drills still waiting for a partner, newer than the wait window. */
export async function listWaitingDrills(
  db: Db,
  viewerId: string,
  nowSeconds: number,
  videoId?: string,
): Promise<RebuttalDrillRow[]> {
  const since = new Date((nowSeconds - PARTNER_WAIT_SECONDS) * 1000);
  return db
    .select()
    .from(rebuttalDrills)
    .where(
      and(
        eq(rebuttalDrills.status, "waiting"),
        ne(rebuttalDrills.creatorId, viewerId),
        gte(rebuttalDrills.createdAt, since),
        ...(videoId ? [eq(rebuttalDrills.videoId, videoId)] : []),
      ),
    )
    .orderBy(rebuttalDrills.createdAt)
    .limit(500);
}

function fmt(row: RebuttalDrillRow): DrillFormat {
  return isChallengeFormat(row.format) ? row.format : "pf";
}

function promptRound(row: RebuttalDrillRow): DrillPromptRound {
  const video = findPlaylistVideo(row.playlistId, row.videoId);
  return {
    format: fmt(row),
    video: video ?? { title: row.topic, tournament: "", round: "", affTeam: "Affirmative", negTeam: "Negative" },
  };
}

/**
 * Pairs `joinerId` with the oldest drill on this video waiting for exactly
 * their side, or returns `null` when there is none (or every candidate was
 * claimed by someone else first).
 */
export async function joinWaitingDrill(
  db: Db,
  joinerId: string,
  videoId: string,
  playlistId: string,
  side: DrillSide,
  blocked: ReadonlySet<string>,
  nowSeconds: number,
): Promise<RebuttalDrillRow | null> {
  const rows = (await listWaitingDrills(db, joinerId, nowSeconds, videoId)).filter((row) => row.playlistId === playlistId);
  const candidates = rows.map((row) => ({ row, state: rowToState(row) }));
  const remaining = [...candidates];
  while (remaining.length > 0) {
    const pick = pickPartnerDrill(remaining, joinerId, side, nowSeconds, blocked);
    if (!pick) return null;
    const written = await writeDrillState(db, pick.row, joinDrill(pick.state, joinerId));
    if (written) return written;
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return null;
}

/**
 * Runs the model work a drill is waiting on: the AI partner's rebuttal, then
 * the judge once both are in. A model that didn't answer leaves the row as it was.
 */
export async function advanceDrill(
  db: Db,
  row: RebuttalDrillRow,
  generate: ChallengeTextGenerator,
  nowSeconds: number,
): Promise<RebuttalDrillRow> {
  let current = row;
  let state = rowToState(current);

  if (aiOwesRebuttal(state)) {
    const raw = await generate(aiRebuttalPrompt(promptRound(current), otherSide(state.creatorSide)), REBUTTAL_MAX_TOKENS);
    const text = raw ? raw.replace(/^#+\s.*\n+/, "").trim() : "";
    const next = text ? applyAiRebuttal(state, text) : null;
    if (!next) return current;
    const written = await writeDrillState(db, current, next);
    if (!written) return (await getDrillRow(db, row.id)) ?? current;
    current = written;
    state = next;
  }

  if (state.status === "judging") {
    const reply = await generate(drillJudgePrompt(promptRound(current), seatText(state, "aff"), seatText(state, "neg")), JUDGE_MAX_TOKENS);
    const decision = reply ? parseDrillJudgeReply(reply) : null;
    const next = decision ? applyDrillDecision(state, decision.winner, nowSeconds) : null;
    if (!next || !decision) return current;
    const written = await writeDrillState(db, current, next, { decision: decision.reason.slice(0, 4000) });
    if (!written) return (await getDrillRow(db, row.id)) ?? current;
    current = written;
    await notifyDrillPlayers(
      db,
      [state.creatorId, state.partnerId ?? ""],
      "Your rebuttal drill was judged",
      current.topic,
    );
  }
  return current;
}

/** Whether the drill is waiting on a model call. */
export function drillNeedsModel(row: RebuttalDrillRow): boolean {
  const state = rowToState(row);
  return state.status === "judging" || aiOwesRebuttal(state);
}

/** The coach's help on a draft, or `null` when no model answered. */
export async function coachDraft(
  generate: ChallengeTextGenerator,
  row: RebuttalDrillRow,
  side: DrillSide,
  draft: string,
): Promise<string | null> {
  const reply = await generate(coachPrompt(promptRound(row), side, draft), COACH_MAX_TOKENS);
  return reply?.trim() || null;
}

async function hydratePeople(db: Db, ids: Iterable<string>): Promise<Map<string, DrillPerson>> {
  const unique = [...new Set(ids)].filter((id) => id && id !== AI_PARTNER_ID);
  if (unique.length === 0) return new Map();
  const rows: { id: string; name: string; image: string | null }[] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, imageUrl: row.image ?? null }]));
}

const AI_PERSON: DrillPerson = { id: AI_PARTNER_ID, name: "AI partner", imageUrl: null };
const UNKNOWN_PERSON: DrillPerson = { id: "deleted", name: "Former member", imageUrl: null };

/** One row as the page shows it to `viewerId`. */
export function toDrillView(
  row: RebuttalDrillRow,
  viewerId: string,
  people: Map<string, DrillPerson>,
  nowSeconds: number,
): RebuttalDrill {
  const state = rowToState(row);
  const viewerSide = row.creatorId === viewerId ? state.creatorSide : otherSide(state.creatorSide);
  const judged = state.status === "complete";
  const seat = (side: DrillSide): RebuttalDrillSeat => {
    const holder = seatHolder(state, side);
    const text = seatText(state, side);
    return {
      side,
      person: holder === null ? null : holder === AI_PARTNER_ID ? AI_PERSON : (people.get(holder) ?? UNKNOWN_PERSON),
      submitted: text !== "",
      text: text && (side === viewerSide || judged) ? text : null,
      coachLeft: Math.max(0, MAX_COACH_USES - seatCoachUses(state, side)),
    };
  };
  return {
    id: row.id,
    playlistId: row.playlistId,
    videoId: row.videoId,
    format: fmt(row),
    topic: row.topic,
    status: state.status,
    vsAi: isVsAi(state),
    viewerSide,
    aff: seat("aff"),
    neg: seat("neg"),
    winnerSide: state.winnerSide,
    decision: judged ? row.decision : "",
    moves: availableDrillMoves(state, viewerId, nowSeconds),
    createdAt: toSeconds(row.createdAt) ?? 0,
    updatedAt: toSeconds(row.updatedAt) ?? 0,
    completedAt: state.completedAt,
  };
}

/** Views of `rows` for `viewerId`. */
export async function drillViewsFor(db: Db, rows: RebuttalDrillRow[], viewerId: string, nowSeconds: number) {
  const people = await hydratePeople(db, rows.flatMap((row) => [row.creatorId, row.partnerId ?? ""]));
  return rows.map((row) => toDrillView(row, viewerId, people, nowSeconds));
}

/** Waiting drills by others, counted per video and the side a joiner would take. */
export function countOpenSeats(rows: RebuttalDrillRow[], blocked: ReadonlySet<string>): OpenSeatCount[] {
  const counts = new Map<string, OpenSeatCount>();
  for (const row of rows) {
    if (blocked.has(row.creatorId) || !isDrillSide(row.creatorSide)) continue;
    const side = otherSide(row.creatorSide);
    const key = `${row.videoId}:${side}`;
    const entry = counts.get(key) ?? { videoId: row.videoId, side, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()];
}

/** The whole board: runs a couple of pending model jobs, then shapes everything for the viewer. */
export async function loadDrillBoard(
  db: Db,
  viewer: DrillPerson,
  blocked: ReadonlySet<string>,
  generate: ChallengeTextGenerator,
  nowSeconds: number,
): Promise<RebuttalBoardResponse> {
  let rows = await listViewerDrills(db, viewer.id);
  let jobs = 0;
  rows = await Promise.all(
    rows.map(async (row) => {
      if (jobs >= AI_JOBS_PER_READ || !drillNeedsModel(row)) return row;
      jobs += 1;
      return advanceDrill(db, row, generate, nowSeconds);
    }),
  );
  const waiting = await listWaitingDrills(db, viewer.id, nowSeconds);
  return {
    viewer,
    drills: await drillViewsFor(db, rows, viewer.id, nowSeconds),
    openSeats: countOpenSeats(waiting, blocked),
  };
}

/** Inserts a new drill row and returns it. */
export async function insertDrillRow(
  db: Db,
  input: { id: string; playlistId: string; videoId: string; format: DrillFormat; topic: string; state: DrillState },
): Promise<RebuttalDrillRow> {
  const now = new Date(input.state.createdAt * 1000);
  const [row] = await db
    .insert(rebuttalDrills)
    .values({
      id: input.id,
      playlistId: input.playlistId,
      videoId: input.videoId,
      format: input.format,
      topic: input.topic,
      creatorId: input.state.creatorId,
      creatorSide: input.state.creatorSide,
      ...stateColumns(input.state),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** The viewer's own open drill on this video and side, if any — starting again returns it instead of a duplicate. */
export async function findOpenDrillFor(
  db: Db,
  viewerId: string,
  playlistId: string,
  videoId: string,
  side: DrillSide,
): Promise<RebuttalDrillRow | null> {
  const rows = (await listViewerDrills(db, viewerId)).filter(
    (row) => row.playlistId === playlistId && row.videoId === videoId && (row.status === "waiting" || row.status === "writing"),
  );
  return (
    rows.find((row) => {
      const state = rowToState(row);
      return (row.creatorId === viewerId ? state.creatorSide : otherSide(state.creatorSide)) === side;
    }) ?? null
  );
}

/** How many open drills the viewer has. */
export async function countOpenDrills(db: Db, viewerId: string): Promise<number> {
  const rows = await db
    .select({ id: rebuttalDrills.id })
    .from(rebuttalDrills)
    .where(
      and(
        or(eq(rebuttalDrills.creatorId, viewerId), eq(rebuttalDrills.partnerId, viewerId)),
        inArray(rebuttalDrills.status, ["waiting", "writing"]),
      ),
    );
  return rows.length;
}

/** How many AI drills the viewer has started since `since`. */
export async function countAiDrillsSince(db: Db, viewerId: string, since: Date): Promise<number> {
  const rows = await db
    .select({ id: rebuttalDrills.id })
    .from(rebuttalDrills)
    .where(
      and(eq(rebuttalDrills.creatorId, viewerId), eq(rebuttalDrills.partnerKind, "ai"), gte(rebuttalDrills.createdAt, since)),
    );
  return rows.length;
}
