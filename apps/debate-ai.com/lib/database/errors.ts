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
