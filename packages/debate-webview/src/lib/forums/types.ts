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
 * @module lib/forums/types
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
  author: ForumAuthor;
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
}
