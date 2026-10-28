/**
 * @fileoverview Judge paradigms: the Tabroom paradigm cache, the admin sync
 * that fills it, and judges' own paradigms — over the `judge_paradigms`,
 * `judge_paradigm_sync` and `judge_own_paradigms` tables in
 * `lib/database/schema.ts`.
 *
 * ## Where a judge's profile comes from
 *
 * {@link loadJudgeProfile} answers the judge dialog in pairings. A judge is
 * found by Tabroom person id, or by name when their pairing carries none
 * (the cache first, then Tabroom's paradigm search). A cached copy newer than
 * {@link PARADIGM_REFRESH_MS} is served as is; an older or missing one is
 * fetched from Tabroom with the site's session (`TABROOM_SESSION_TOKEN`) and
 * saved. When Tabroom can't be read, an old copy is served marked stale.
 * A verified judge's own paradigm rides along as `ownParadigm`.
 *
 * @module lib/judge-paradigms/queries
 */

import { and, asc, count, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import {
  fetchTabroomJudge,
  sanitizeParadigmHtml,
  searchTabroomParadigms,
  type TabroomCredentials,
} from "@debate-ai/tournaments/server";
import type { JudgeProfile, JudgeRecordRow } from "@debate-ai/tournaments/ui";
import { searchParadigm } from "@debate-ai/webview/lib/tournaments/paradigm-search";
import { renderParadigmMarkdown } from "@debate-ai/tournaments/judge-paradigms/markdown";
import {
  PARADIGM_REFRESH_MS,
  nameKey,
  paradigmHasCode,
  type OwnParadigm,
  type OwnParadigmInput,
  type ParadigmClaim,
  type ParadigmSyncBatch,
  type ParadigmSyncStatus,
} from "@debate-ai/tournaments/judge-paradigms/types";
import { tabroomCredentials, tabroomFetch } from "./tabroom";
import type { getDBFromContext } from "@/lib/database/context";
import { judgeOwnParadigms, judgeParadigmSync, judgeParadigms, user, type JudgeParadigmRow } from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

const SYNC_ID = "tabroom";
/** Judges fetched per admin sync batch — each is two Tabroom requests, well inside a Worker's subrequest budget. */
export const SYNC_BATCH_SIZE = 20;
/** Rows per page of Tabroom's paradigm search (its maximum). */
const SEARCH_PAGE = 100;

const parseJson = <T>(text: string | null | undefined, fallback: T): T => {
  try {
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** A cached row as the dialog's profile. */
function toProfile(row: JudgeParadigmRow, stale = false): JudgeProfile {
  return {
    personId: row.personId,
    name: row.name,
    paradigmHtml: row.paradigmHtml,
    lastReviewed: row.lastReviewed,
    record: parseJson<JudgeRecordRow[]>(row.record, []),
    certifications: parseJson(row.certifications, []),
    source: row.source === "tabroom-page" ? "tabroom-page" : "tabroom-api",
    syncedAt: row.syncedAt.toISOString(),
    stale,
  };
}

/** Saves what Tabroom answered for one judge — a profile, or why there is none. */
export async function saveTabroomJudge(
  db: Db,
  personId: number,
  result: Awaited<ReturnType<typeof fetchTabroomJudge>>,
  fallbackName = "",
): Promise<void> {
  const now = new Date();
  const values = result.ok
    ? {
        name: result.profile.name || fallbackName,
        ...nameKey(result.profile.name || fallbackName),
        paradigmHtml: result.profile.paradigmHtml,
        lastReviewed: result.profile.lastReviewed,
        record: JSON.stringify(result.profile.record),
        rounds: result.profile.record.length,
        certifications: JSON.stringify(result.profile.certifications),
        source: result.profile.source,
        status: "ok",
        error: null,
        syncedAt: now,
      }
    : { status: result.reason === "not-found" ? "not-found" : "error", error: result.detail ?? result.reason, syncedAt: now };
  if (!result.ok && result.reason !== "not-found") {
    // A failed read never overwrites a good copy; it only notes the failure on a new row.
    const [existing] = await db.select({ status: judgeParadigms.status }).from(judgeParadigms).where(eq(judgeParadigms.personId, personId)).limit(1);
    if (existing?.status === "ok") return;
  }
  await db
    .insert(judgeParadigms)
    .values({ personId, name: fallbackName, ...nameKey(fallbackName), ...values })
    .onConflictDoUpdate({ target: judgeParadigms.personId, set: values });
}

/** A verified judge's own paradigm for Tabroom person `personId`, if any. */
async function ownParadigmFor(db: Db, personId: number): Promise<JudgeProfile["ownParadigm"]> {
  const [row] = await db
    .select({ html: judgeOwnParadigms.html, updatedAt: judgeOwnParadigms.updatedAt })
    .from(judgeOwnParadigms)
    .where(and(eq(judgeOwnParadigms.tabroomPersonId, personId), eq(judgeOwnParadigms.verified, true)))
    .orderBy(sql`${judgeOwnParadigms.updatedAt} desc`)
    .limit(1);
  return row && row.html.trim() ? { html: row.html, updatedAt: row.updatedAt.toISOString() } : null;
}

/**
 * The Tabroom person id of the one judge named `first last`: the cache when
 * exactly one row has that name, otherwise Tabroom's paradigm search.
 */
export async function findJudgeByName(db: Db, first: string, last: string, credentials = tabroomCredentials()): Promise<number | null> {
  const key = nameKey(`${first} ${last}`);
  if (!key.first || !key.last) return null;
  const rows = await db
    .select({ personId: judgeParadigms.personId })
    .from(judgeParadigms)
    .where(and(eq(judgeParadigms.first, key.first), eq(judgeParadigms.last, key.last), eq(judgeParadigms.status, "ok")))
    .limit(2);
  if (rows.length === 1) return rows[0].personId;
  if (rows.length > 1) return null;
  return searchParadigm(first, last, tabroomFetch(credentials));
}

/**
 * A judge's paradigm and judging record for the pairings dialog, by Tabroom
 * person id or by name. `null` when no judge can be found.
 */
export async function loadJudgeProfile(
  db: Db,
  query: { personId: number | null; first?: string; last?: string },
  { credentials = tabroomCredentials(), now = Date.now() }: { credentials?: TabroomCredentials | null; now?: number } = {},
): Promise<JudgeProfile | null> {
  const personId = query.personId ?? (query.first && query.last ? await findJudgeByName(db, query.first, query.last, credentials) : null);
  if (!personId) return null;

  const [cached] = await db.select().from(judgeParadigms).where(eq(judgeParadigms.personId, personId)).limit(1);
  const fresh = cached && now - cached.syncedAt.getTime() < PARADIGM_REFRESH_MS;
  let row = cached;
  let note: string | null = null;
  if (!fresh) {
    const result = await fetchTabroomJudge(personId, { credentials });
    if (result.ok || result.reason === "not-found") {
      await saveTabroomJudge(db, personId, result, [query.first, query.last].filter(Boolean).join(" "));
      [row] = await db.select().from(judgeParadigms).where(eq(judgeParadigms.personId, personId)).limit(1);
    } else {
      note = credentials ? "Tabroom couldn't be reached just now." : "Tabroom sign-in isn't set up on this site yet, so only synced judges can be shown.";
    }
  }

  const ownParadigm = await ownParadigmFor(db, personId);
  if (row && row.status === "ok") return { ...toProfile(row, !fresh && Boolean(note)), ownParadigm, note: ownParadigm ? null : note };
  if (ownParadigm) {
    const name = [query.first, query.last].filter(Boolean).join(" ");
    return { personId, name, paradigmHtml: null, lastReviewed: null, record: [], certifications: [], ownParadigm, source: "none", syncedAt: null };
  }
  if (note) {
    const name = [query.first, query.last].filter(Boolean).join(" ");
    return { personId, name, paradigmHtml: null, lastReviewed: null, record: [], certifications: [], source: "none", syncedAt: null, note };
  }
  return null;
}

/** A fresh code for an account to put in its Tabroom paradigm. */
function newVerifyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `debate-ai-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function toOwn(row: typeof judgeOwnParadigms.$inferSelect | undefined, code: string): OwnParadigm {
  return {
    tabroomPersonId: row?.tabroomPersonId ?? null,
    verified: Boolean(row?.verified),
    verifyCode: row?.verifyCode ?? code,
    markdown: row?.markdown ?? "",
    html: row?.html ?? "",
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

/** The viewer's own paradigm; one never saved reads empty, with a code ready for verifying. */
export async function getOwnParadigm(db: Db, userId: string): Promise<OwnParadigm> {
  const [row] = await db.select().from(judgeOwnParadigms).where(eq(judgeOwnParadigms.userId, userId)).limit(1);
  if (row) return toOwn(row, row.verifyCode);
  // Saved now so the code shown is the one verify checks for.
  const code = newVerifyCode();
  await db.insert(judgeOwnParadigms).values({ userId, verifyCode: code }).onConflictDoNothing();
  const [created] = await db.select().from(judgeOwnParadigms).where(eq(judgeOwnParadigms.userId, userId)).limit(1);
  return toOwn(created, code);
}

/**
 * Saves the viewer's paradigm. Linking a different Tabroom judge clears the
 * verification, which then has to be done again for the new one.
 */
export async function saveOwnParadigm(db: Db, userId: string, input: OwnParadigmInput): Promise<OwnParadigm> {
  const current = await getOwnParadigm(db, userId);
  const html = input.markdown.trim() ? sanitizeParadigmHtml(renderParadigmMarkdown(input.markdown)) : "";
  const verified = current.verified && current.tabroomPersonId === input.tabroomPersonId;
  await db
    .update(judgeOwnParadigms)
    .set({ tabroomPersonId: input.tabroomPersonId, markdown: input.markdown, html, verified, updatedAt: new Date() })
    .where(eq(judgeOwnParadigms.userId, userId));
  return getOwnParadigm(db, userId);
}

/**
 * Verifies the viewer as their linked Tabroom judge when that judge's Tabroom
 * paradigm, read fresh, contains the viewer's code.
 */
export async function verifyOwnParadigm(
  db: Db,
  userId: string,
  credentials = tabroomCredentials(),
): Promise<{ ok: true; paradigm: OwnParadigm } | { ok: false; status: number; error: string }> {
  const current = await getOwnParadigm(db, userId);
  if (!current.tabroomPersonId) return { ok: false, status: 400, error: "Link your Tabroom judge first, then save." };
  if (current.verified) return { ok: true, paradigm: current };
  if (!credentials) return { ok: false, status: 503, error: "This site can't read Tabroom yet. Ask an admin to verify you instead." };
  const result = await fetchTabroomJudge(current.tabroomPersonId, { credentials });
  if (!result.ok) {
    return { ok: false, status: 502, error: result.reason === "not-found" ? "Tabroom has no paradigm for that judge id." : "Tabroom couldn't be reached. Try again shortly." };
  }
  await saveTabroomJudge(db, current.tabroomPersonId, result);
  if (!paradigmHasCode(result.profile.paradigmHtml, current.verifyCode)) {
    return { ok: false, status: 409, error: `Your Tabroom paradigm doesn't contain ${current.verifyCode} yet. Add it on Tabroom, save, then verify again.` };
  }
  await db.update(judgeOwnParadigms).set({ verified: true }).where(eq(judgeOwnParadigms.userId, userId));
  return { ok: true, paradigm: { ...current, verified: true } };
}

/** Accounts linked to a Tabroom judge, unverified first — what the admin card reviews. */
export async function listParadigmClaims(db: Db, limit = 100): Promise<ParadigmClaim[]> {
  const rows = await db
    .select({
      userId: judgeOwnParadigms.userId,
      userName: user.name,
      userEmail: user.email,
      tabroomPersonId: judgeOwnParadigms.tabroomPersonId,
      tabroomName: judgeParadigms.name,
      verified: judgeOwnParadigms.verified,
      updatedAt: judgeOwnParadigms.updatedAt,
    })
    .from(judgeOwnParadigms)
    .innerJoin(user, eq(user.id, judgeOwnParadigms.userId))
    .leftJoin(judgeParadigms, eq(judgeParadigms.personId, judgeOwnParadigms.tabroomPersonId))
    .where(isNotNull(judgeOwnParadigms.tabroomPersonId))
    .orderBy(asc(judgeOwnParadigms.verified), sql`${judgeOwnParadigms.updatedAt} desc`)
    .limit(limit);
  type ClaimRow = Omit<ParadigmClaim, "tabroomPersonId" | "updatedAt" | "tabroomName"> & {
    tabroomPersonId: number | null;
    tabroomName: string | null;
    updatedAt: Date;
  };
  return rows.map((row: ClaimRow) => ({
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    tabroomPersonId: row.tabroomPersonId as number,
    tabroomName: row.tabroomName || null,
    verified: Boolean(row.verified),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** An admin's decision on a claim. */
export async function setParadigmClaimVerified(db: Db, userId: string, verified: boolean): Promise<boolean> {
  const updated = await db
    .update(judgeOwnParadigms)
    .set({ verified })
    .where(and(eq(judgeOwnParadigms.userId, userId), isNotNull(judgeOwnParadigms.tabroomPersonId)))
    .returning({ userId: judgeOwnParadigms.userId });
  return updated.length > 0;
}

async function syncState(db: Db) {
  const [row] = await db.select().from(judgeParadigmSync).where(eq(judgeParadigmSync.id, SYNC_ID)).limit(1);
  return row ?? { id: SYNC_ID, discoveryOffset: 0, discoveryDone: false, lastRunAt: null, lastError: null };
}

async function saveSyncState(db: Db, values: Partial<typeof judgeParadigmSync.$inferInsert>) {
  await db
    .insert(judgeParadigmSync)
    .values({ id: SYNC_ID, ...values })
    .onConflictDoUpdate({ target: judgeParadigmSync.id, set: values });
}

/** What the admin card shows: the cache's size and health, the sync's progress and the claims to review. */
export async function getParadigmSyncStatus(db: Db, now = Date.now()): Promise<ParadigmSyncStatus> {
  const staleBefore = new Date(now - PARADIGM_REFRESH_MS);
  const [[totals], [withParadigm], [failed], [stale], state, claims] = await Promise.all([
    db.select({ n: count() }).from(judgeParadigms),
    db.select({ n: count() }).from(judgeParadigms).where(isNotNull(judgeParadigms.paradigmHtml)),
    db.select({ n: count() }).from(judgeParadigms).where(eq(judgeParadigms.status, "error")),
    db.select({ n: count() }).from(judgeParadigms).where(lt(judgeParadigms.syncedAt, staleBefore)),
    syncState(db),
    listParadigmClaims(db),
  ]);
  return {
    credentialsConfigured: Boolean(tabroomCredentials()),
    cached: totals?.n ?? 0,
    withParadigm: withParadigm?.n ?? 0,
    failed: failed?.n ?? 0,
    stale: stale?.n ?? 0,
    discoveryOffset: state.discoveryOffset,
    discoveryDone: Boolean(state.discoveryDone),
    lastRunAt: state.lastRunAt ? state.lastRunAt.toISOString() : null,
    lastError: state.lastError,
    claims,
  };
}

/** Fetches and saves `ids` from Tabroom, a few at a time. */
async function fetchAndSave(db: Db, people: Array<{ id: number; name?: string }>, credentials: TabroomCredentials) {
  let saved = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (let i = 0; i < people.length; i += 4) {
    const chunk = people.slice(i, i + 4);
    const results = await Promise.all(chunk.map((person) => fetchTabroomJudge(person.id, { credentials })));
    for (const [j, result] of results.entries()) {
      await saveTabroomJudge(db, chunk[j].id, result, chunk[j].name ?? "");
      if (result.ok) saved++;
      else {
        failed++;
        if (result.reason !== "not-found") lastError = result.detail ?? result.reason;
      }
    }
  }
  return { saved, failed, lastError };
}

/**
 * One batch of the admin sync.
 *
 * - `discover` walks Tabroom's paradigm search (every judge with a current
 *   paradigm, `GET /rest/paradigms?search=`) one page past the saved offset,
 *   and fetches the judges on it the cache doesn't hold yet.
 * - `refresh` re-fetches the cached judges whose copy is oldest.
 *
 * Each call stays small enough for one Worker request; the admin card calls
 * it again until it reports nothing left.
 */
export async function runParadigmSyncBatch(
  db: Db,
  mode: "discover" | "refresh",
  { credentials = tabroomCredentials(), now = Date.now() }: { credentials?: TabroomCredentials | null; now?: number } = {},
): Promise<ParadigmSyncBatch> {
  const empty: ParadigmSyncBatch = { mode, fetched: 0, saved: 0, failed: 0, nextOffset: null, remaining: 0, error: null };
  if (!credentials) {
    return { ...empty, error: "TABROOM_SESSION_TOKEN is not set, and Tabroom refuses paradigm reads without a signed-in account." };
  }
  const state = await syncState(db);

  if (mode === "discover") {
    const offset = state.discoveryDone ? 0 : state.discoveryOffset;
    const page = await searchTabroomParadigms("", { limit: SEARCH_PAGE, offset }, { credentials });
    if (!page.ok) {
      const error = page.reason === "unauthorized" ? "Tabroom refused the site's session — TABROOM_SESSION_TOKEN may have expired." : `Tabroom search failed: ${page.detail ?? page.reason}`;
      await saveSyncState(db, { lastRunAt: new Date(now), lastError: error });
      return { ...empty, nextOffset: offset, error };
    }
    const ids = page.hits.map((hit) => hit.id);
    const known = ids.length
      ? new Set(
          (
            await db
              .select({ personId: judgeParadigms.personId })
              .from(judgeParadigms)
              .where(inArray(judgeParadigms.personId, ids))
          ).map((row: { personId: number }) => row.personId),
        )
      : new Set<number>();
    const todo = page.hits.filter((hit) => !known.has(hit.id)).slice(0, SYNC_BATCH_SIZE);
    const result = await fetchAndSave(db, todo, credentials);
    // Stay on this page until every judge on it is cached, then move on.
    const pageDone = page.hits.length - known.size - todo.length <= 0;
    const done = pageDone && page.hits.length < SEARCH_PAGE;
    const nextOffset = pageDone ? offset + page.hits.length : offset;
    await saveSyncState(db, { discoveryOffset: done ? 0 : nextOffset, discoveryDone: done, lastRunAt: new Date(now), lastError: result.lastError });
    return { ...empty, fetched: todo.length, saved: result.saved, failed: result.failed, nextOffset: done ? null : nextOffset, error: result.lastError };
  }

  const staleBefore = new Date(now - PARADIGM_REFRESH_MS);
  const due = await db
    .select({ id: judgeParadigms.personId, name: judgeParadigms.name })
    .from(judgeParadigms)
    .where(lt(judgeParadigms.syncedAt, staleBefore))
    .orderBy(asc(judgeParadigms.syncedAt))
    .limit(SYNC_BATCH_SIZE);
  const result = await fetchAndSave(db, due, credentials);
  const [left] = await db.select({ n: count() }).from(judgeParadigms).where(lt(judgeParadigms.syncedAt, staleBefore));
  await saveSyncState(db, { lastRunAt: new Date(now), lastError: result.lastError });
  return { ...empty, fetched: due.length, saved: result.saved, failed: result.failed, remaining: left?.n ?? 0, error: result.lastError };
}
