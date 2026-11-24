/**
 * @fileoverview Site feedback: the rules the Settings footer's Feedback
 * dialog and `POST /api/feedback` share.
 *
 * Anyone (signed in or not) can send one message an hour. The message has no
 * practical length limit — {@link MAX_FEEDBACK_LENGTH} only keeps one row
 * well inside a D1 row — and lands in the admin page's Feedback tab.
 *
 * @module lib/feedback/feedback
 */

/** One submission per this many seconds, per address, account and email. */
export const FEEDBACK_COOLDOWN_SECONDS = 60 * 60;

/**
 * Longest message kept, in characters. Far past anything typed by hand
 * (about 30,000 words); it exists only so one row stays inside D1's limit.
 */
export const MAX_FEEDBACK_LENGTH = 200_000;

/** Longest email address accepted (RFC 5321's path limit). */
export const MAX_FEEDBACK_EMAIL_LENGTH = 254;

/** A validated submission. */
export interface FeedbackSubmission {
  email: string;
  message: string;
  /** The path the dialog was opened from, when it sent one. */
  page: string | null;
}

/** One row of `GET /api/admin/feedback`. */
export interface AdminFeedbackRow {
  id: number;
  email: string;
  message: string;
  page: string | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True for something shaped like an email address. */
export function isFeedbackEmail(value: string): boolean {
  return value.length <= MAX_FEEDBACK_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

/** Checks a request body; returns the cleaned submission or the first problem. */
export function parseFeedback(
  body: unknown,
): { ok: true; value: FeedbackSubmission } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Send your email and feedback." };
  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (!isFeedbackEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!message) return { ok: false, error: "Write some feedback first." };
  if (message.length > MAX_FEEDBACK_LENGTH) {
    return { ok: false, error: `Feedback is limited to ${MAX_FEEDBACK_LENGTH.toLocaleString("en-US")} characters.` };
  }
  const page =
    typeof raw.page === "string" && raw.page.startsWith("/") && !raw.page.startsWith("//")
      ? raw.page.slice(0, 500)
      : null;
  return { ok: true, value: { email: email.toLowerCase(), message, page } };
}

/** "in 1 hour" / "in 12 minutes" / "in a minute" for a wait of `seconds`. */
export function describeFeedbackWait(seconds: number): string {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  if (minutes >= 60) return "in 1 hour";
  if (minutes <= 1) return "in a minute";
  return `in ${minutes} minutes`;
}
