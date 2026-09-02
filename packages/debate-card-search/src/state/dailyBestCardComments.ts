/**
 * @fileoverview A comment thread on each day's announced Daily Best Card
 * Challenge winner — closes the "🕵️ Daily Best Card Challenge" bullet's "a
 * comment thread on each day's winner" follow-up under Research
 * Crowdsourcing Organizer Features in TODO.md. Local-first persistence,
 * mirroring `state/flowEdits.ts`'s/`debate-round`'s `state/judgeDecisions.ts`'s
 * `localStorage` convention: a comment is keyed by its own generated `id`
 * (many comments can share a `dayKey`, one per announced winner), so
 * `listDailyBestCardComments` filters and sorts oldest-first for a
 * chronological thread.
 *
 * `isValidDailyBestCardComment`/`MAX_SAVED_DAILY_BEST_CARD_COMMENT_BYTES`
 * are shared with the `/api/daily-best-card-comments` D1-backed routes
 * (`apps/debate-ai.com`) and `hooks/useDailyBestCardComments.ts`, mirroring
 * `debate-round`'s `state/savedJudgeDecisions.ts` split — kept
 * framework/fetch-free so both sides agree on what a valid synced comment
 * is without duplicating logic.
 *
 * @module state/dailyBestCardComments
 */

const STORAGE_KEY = "dailyBestCardComments";

/** Hard cap on a single comment's rendered text length, enforced before it's ever stored. */
export const MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH = 1000;

/** Hard cap on a single comment's JSON size — generous for even a max-length comment, well short of D1's row-size limits. */
export const MAX_SAVED_DAILY_BEST_CARD_COMMENT_BYTES = 20_000;

/** One comment posted to an announced day's winner thread. */
export interface DailyBestCardComment {
  id: string;
  /** The announced winner's UTC calendar day, "YYYY-MM-DD" — see `getUtcDayKey` in `lib/daily-best-card.ts`. */
  dayKey: string;
  authorId: string;
  text: string;
  /** Post time, as epoch milliseconds. */
  postedAt: number;
}

function readAll(): DailyBestCardComment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DailyBestCardComment[]) : [];
  } catch {
    return [];
  }
}

function writeAll(comments: DailyBestCardComment[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
}

function generateCommentId(): string {
  return `dbc-comment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Lists every persisted comment across every day, oldest first. */
export function listAllDailyBestCardComments(): DailyBestCardComment[] {
  return [...readAll()].sort((a, b) => a.postedAt - b.postedAt);
}

/** Lists one announced day's comment thread, oldest first. */
export function listDailyBestCardComments(dayKey: string): DailyBestCardComment[] {
  return listAllDailyBestCardComments().filter((comment) => comment.dayKey === dayKey);
}

/**
 * Posts a new comment to a day's thread, trimming `authorId`/`text` and
 * capping `text` at `MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH`. Callers
 * (`hooks/useDailyBestCardComments.ts`) are expected to reject blank text
 * before calling this — mirrors `state/flowEdits.ts#saveFlowEdit`'s
 * "trust the caller already validated" convention.
 */
export function postDailyBestCardComment(input: {
  dayKey: string;
  authorId: string;
  text: string;
}): DailyBestCardComment {
  const comment: DailyBestCardComment = {
    id: generateCommentId(),
    dayKey: input.dayKey,
    authorId: input.authorId.trim() || "Anonymous",
    text: input.text.trim().slice(0, MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH),
    postedAt: Date.now(),
  };
  writeAll([...readAll(), comment]);
  return comment;
}

/**
 * Upserts a comment as-is, keyed by `id` — used to adopt a remote copy
 * during account merge (mirrors `state/judgeDecisions.ts#adoptJudgeDecision`),
 * not for posting a new local comment (use `postDailyBestCardComment`).
 */
export function adoptDailyBestCardComment(comment: DailyBestCardComment): void {
  const comments = readAll();
  const index = comments.findIndex((existing) => existing.id === comment.id);
  if (index === -1) {
    comments.push(comment);
  } else {
    comments[index] = comment;
  }
  writeAll(comments);
}

/** Deletes a persisted comment by id; a no-op if it isn't stored. */
export function deleteDailyBestCardComment(id: string): void {
  writeAll(readAll().filter((comment) => comment.id !== id));
}

/**
 * Structural validator for an untrusted (e.g. parsed request-body JSON)
 * value claiming to be a `DailyBestCardComment`.
 */
export function isValidDailyBestCardComment(value: unknown): value is DailyBestCardComment {
  if (typeof value !== "object" || value === null) return false;
  const comment = value as Record<string, unknown>;

  if (typeof comment.id !== "string" || comment.id.trim().length === 0) return false;
  if (typeof comment.dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(comment.dayKey)) return false;
  if (typeof comment.authorId !== "string" || comment.authorId.trim().length === 0) return false;
  if (typeof comment.text !== "string" || comment.text.trim().length === 0) return false;
  if (comment.text.length > MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH) return false;
  if (typeof comment.postedAt !== "number") return false;

  return true;
}
