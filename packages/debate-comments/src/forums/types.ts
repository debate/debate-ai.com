/**
 * @fileoverview The forum wire format — what `/api/forums` sends and what the
 * forum UI reads.
 *
 * ## What a forum is made of
 *
 * A thread is a title, an opening post and a list of replies. The replies are
 * not part of this format: they are ordinary comments on the `comments` table,
 * keyed on the thread's id (`resource_type = 'thread'`), and the thread page
 * renders them with the same `CommentSection` every other discussion uses. So
 * everything here is about the thread row and the counts derived from it.
 *
 * ## Why the feed carries an excerpt and not the body
 *
 * A feed is read for its titles; the opening post is read once, on the thread's
 * own page. Sending every post in full would make the feed's payload grow with
 * the forum rather than with its page size, so the feed truncates
 * {@link FORUM_EXCERPT_LENGTH} characters and the detail read returns the post
 * whole. The cut is made on the server, at a character boundary, so the client
 * never has to decide where a preview ends.
 *
 * The types live in the web package because that is where both ends of them
 * meet: the UI imports them, and the app's `lib/forums` imports the limits from
 * here rather than restating them, so a longer title cannot be accepted by the
 * API and truncated by the UI.
 *
 * @module debate-comments/forums/types
 */

/** The longest a thread title may be, in characters. */
export const MAX_THREAD_TITLE_LENGTH = 140;

/**
 * The longest an opening post may be, in characters.
 *
 * Longer than a comment's 5,000 on purpose: an opening post is the thing being
 * discussed, where a comment is a turn in a discussion that already has one,
 * and the field it is typed into is a multi-line box rather than a single line.
 */
export const MAX_THREAD_BODY_LENGTH = 20_000;

/**
 * How much of an opening post the feed shows, in characters.
 *
 * About three lines of the UI's text size — enough to tell two threads with the
 * same title apart, which is the only reason the feed shows one at all.
 */
export const FORUM_EXCERPT_LENGTH = 280;

/** How many threads one feed read returns when the caller names no limit. */
export const DEFAULT_FEED_LIMIT = 25;

/** The most a caller may ask for in one read, whatever it asks for. */
export const MAX_FEED_LIMIT = 50;

/**
 * The boards a thread can be filed under.
 *
 * A fixed list rather than a table: a category is a page of the forum with its
 * own URL, and a list members could add to would fill with near-duplicates
 * ("LD", "Lincoln Douglas", "lincoln-douglas") faster than anyone could merge
 * them. Adding a board is a one-line change here; the server validates against
 * the same list, so a client can never file a thread somewhere with no page.
 *
 * `general` is first because it is the default — every thread opened before
 * categories existed was backfilled into it by the column default.
 */
export const FORUM_CATEGORIES = [
  { id: "general", label: "General", description: "Anything debate that fits nowhere else." },
  { id: "policy", label: "Policy", description: "Affs, DAs, counterplans, Ks and the topic." },
  { id: "lincoln-douglas", label: "Lincoln-Douglas", description: "Values, frameworks, phil and LD theory." },
  { id: "public-forum", label: "Public Forum", description: "PF cases, rebuttal blocks and the monthly topics." },
  { id: "college", label: "College", description: "NDT/CEDA, NPDA and college programs." },
  { id: "evidence", label: "Evidence & research", description: "Card requests, cutting help and research tips." },
  { id: "tournaments", label: "Tournaments", description: "Pairings, judging, travel and results." },
  { id: "coaching", label: "Coaching & judging", description: "Paradigms, running a squad, teaching novices." },
  { id: "off-topic", label: "Off-topic", description: "Everything else." },
] as const;

export type ForumCategoryId = (typeof FORUM_CATEGORIES)[number]["id"];

/** Where a thread lands when its author picks no board. */
export const DEFAULT_FORUM_CATEGORY: ForumCategoryId = "general";

/** Narrows an untrusted value (a query param, a JSON body) to a category id. */
export function isForumCategoryId(value: unknown): value is ForumCategoryId {
  return typeof value === "string" && FORUM_CATEGORIES.some((category) => category.id === value);
}

/** The display label for a category id; unknown ids fall back to the raw value. */
export function forumCategoryLabel(id: string): string {
  return FORUM_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}

/**
 * The orders a feed can be read in.
 *
 * - `active` — most recently posted to first (a reply bumps a thread). The
 *   default, and the forum's "recent".
 * - `new` — most recently opened first; replies do not move a thread.
 * - `top` — most liked first.
 */
export const FORUM_SORTS = ["active", "new", "top"] as const;

export type ForumSort = (typeof FORUM_SORTS)[number];

export const DEFAULT_FORUM_SORT: ForumSort = "active";

/** Narrows an untrusted value to a feed order. */
export function isForumSort(value: unknown): value is ForumSort {
  return typeof value === "string" && (FORUM_SORTS as readonly string[]).includes(value);
}

/** Who wrote a thread. Only ever the public fields — never an email. */
export interface ForumAuthor {
  id: string;
  name: string;
  imageUrl: string | null;
}

/**
 * The reader as the API sees them, or `null` signed out.
 *
 * The UI needs this to decide between the new-thread form and a sign-in prompt.
 * It rides along with the feed rather than costing a second request, for the
 * same reason `CommentThreadResponse.viewer` does.
 */
export interface ForumViewer {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** One row in the feed: the thread, its author, and how busy it is. */
export interface ForumThreadSummary {
  id: string;
  title: string;
  /** The first {@link FORUM_EXCERPT_LENGTH} characters of the opening post. */
  excerpt: string;
  /** The board the thread was filed under — one of {@link FORUM_CATEGORIES}. */
  category: ForumCategoryId;
  author: ForumAuthor;
  /** How many members liked the thread itself (replies carry their own likes). */
  likeCount: number;
  /** Whether the viewer who fetched this feed has liked the thread. */
  viewerHasLiked: boolean;
  /**
   * Replies that are still visible. Deleted replies are excluded rather than
   * counted: the count on a feed row is "how much is left to read", and a
   * number that included removed posts would not be it.
   */
  replyCount: number;
  /** Unix seconds. */
  createdAt: number;
  /**
   * When the thread was last posted to, in Unix seconds — the feed's order, and
   * equal to `createdAt` for a thread nobody has replied to.
   */
  lastActivityAt: number;
}

/** A single thread, with its opening post whole. */
export interface ForumThreadDetail extends ForumThreadSummary {
  body: string;
}

/** What `GET /api/forums` returns. */
export interface ForumFeedResponse {
  threads: ForumThreadSummary[];
  viewer: ForumViewer | null;
  /**
   * Where to resume, or `null` when this was the last page.
   *
   * A cursor rather than a page number: the feed is ordered by when a thread was
   * last posted to, and a reply landing between two requests would push a row
   * from page two onto page one, so an offset walk skips it. The cursor names
   * the last row of this page, and the next read starts strictly after it.
   */
  nextCursor: string | null;
  /** The board this page lists, or `null` for every board. */
  category: ForumCategoryId | null;
  /** The order this page was read in. */
  sort: ForumSort;
}

/** What `POST /api/forums/:id/like` returns: the state the rows hold afterwards. */
export interface ForumThreadLikeResult {
  liked: boolean;
  likeCount: number;
}
