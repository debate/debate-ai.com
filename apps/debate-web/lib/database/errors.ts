/**
 * Drizzle wraps every failed statement in a `DrizzleQueryError` whose own
 * message is just the SQL it tried to run — `Failed query: select "video_id"
 * from "youtube_video_exclusions"`. The driver's actual complaint (for D1,
 * something like `D1_ERROR: no such table: youtube_video_exclusions`) is left
 * on `cause`, so anything that logs or stores `error.message` alone throws
 * away the one detail that says *why* the query failed. Flatten the whole
 * `cause` chain instead, so a Workers log line or a `youtube_sync_runs.error`
 * row is diagnosable on its own.
 */
export function describeError(error: unknown, maxDepth = 5): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; current != null && depth < maxDepth; depth++) {
    const message = messageOf(current);
    // Wrappers often repeat their cause's message; keep the chain readable.
    if (message && !parts.includes(message)) parts.push(message);
    current = (current as { cause?: unknown }).cause;
  }

  return parts.join(" | ") || "Unknown error";
}

/** One-line message for a single link in the chain, whatever was thrown. */
function messageOf(value: unknown): string {
  if (typeof value === "string") return collapse(value);
  if (value instanceof Error) return collapse(value.message);
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return collapse(message);
  }
  try {
    return collapse(String(value));
  } catch {
    return "";
  }
}

/** Newlines make an admin toast and a log line hard to read; fold them out. */
function collapse(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

/**
 * D1's wording when a database has used up its share of compute: `D1 DB is
 * overloaded. Too many resources consumed within a 10 second window`. It is a
 * load fault, not a bad query: every statement sent in the next few seconds
 * fails the same way, so a caller should stop sending more (a fallback query,
 * a retry) and answer "busy" instead.
 */
const D1_OVERLOADED = /D1 DB is overloaded|Too many resources consumed/i;

/** Whether an error, anywhere in its `cause` chain, is D1 refusing work because it is overloaded. */
export function isD1Overloaded(error: unknown): boolean {
  return D1_OVERLOADED.test(describeError(error, 8));
}

/**
 * D1's wording for faults that are about the connection or the database
 * object rather than the query: the Durable Object behind the database was
 * reset or restarted, or the network between the Worker and it dropped.
 * Cloudflare's guidance is to retry these, and the same statement usually
 * succeeds a moment later. Overload is deliberately not in this list — see
 * {@link isD1Overloaded}, which wants fewer statements, not more.
 *
 * @see https://developers.cloudflare.com/d1/observability/debug-d1/#error-list
 */
const D1_TRANSIENT =
  /Network connection lost|object to be reset|reset because its code was updated|internal error|D1_ERROR: Internal|Cannot resolve D1 DB due to transient issue/i;

/** Whether an error, anywhere in its `cause` chain, is a D1 fault worth one retry. */
export function isD1Transient(error: unknown): boolean {
  const description = describeError(error, 8);
  return D1_TRANSIENT.test(description) && !D1_OVERLOADED.test(description);
}
