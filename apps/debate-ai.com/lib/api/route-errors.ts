import { NextResponse } from "next/server";

/**
 * @fileoverview Turns an unhandled throw inside an API route handler into a
 * logged, described JSON error instead of an empty 500.
 *
 * The account-sync routes (`/api/drill-sets`, `/api/judge-decisions`,
 * `/api/coach-materials`, …) query D1 with no error handling of their own, so
 * when production's D1 was 24 migrations behind, every one of them answered a
 * bodiless 500. Nothing in that response said which table was missing, and the
 * clients' `readErrorMessage` helpers fell back to their generic copy ("Failed
 * to load your synced drill sets"), so the only visible symptom was a wall of
 * `500 ()` lines in the browser console — the schema drift itself was
 * invisible from both ends.
 *
 * Wrapping a handler here costs nothing on the success path and makes the
 * failure self-describing: the Worker logs the real error, and the response
 * carries a message the UI can show.
 *
 * @module lib/api/route-errors
 */

/**
 * SQLite's wording when the code expects a schema the database does not have —
 * a deploy that shipped without its migrations. It is an environment fault, not
 * a bad request, so it answers 503 (and says so) rather than joining the
 * undifferentiated 500s.
 */
const SCHEMA_DRIFT = /no such table|no such column|has no column named/i;

/**
 * Every message in an error's `cause` chain.
 *
 * Drizzle reports a failed query as a `DrizzleQueryError` whose own message is
 * only `Failed query: select "data" from "saved_drill_sets" …` — the driver's
 * `no such table` sits one or more `cause` links down. Matching on the top
 * message alone would classify exactly the failure this helper exists to
 * recognize as a generic 500.
 */
function causeChain(error: unknown): string[] {
  const parts: string[] = [];
  let current: unknown = error;
  // Bounded so a self-referential cause chain cannot spin here.
  for (let depth = 0; current != null && depth < 8; depth++) {
    parts.push(current instanceof Error ? current.message : String(current));
    current = current instanceof Error ? (current.cause as unknown) : undefined;
  }
  return parts;
}

/**
 * Wraps a route handler so anything it throws becomes a JSON error response.
 *
 * `routeName` is only used for the server-side log line; keep it in the
 * `"GET /api/drill-sets"` shape so a Workers log search finds the route.
 *
 * @example
 * export const GET = withRouteErrors("GET /api/drill-sets", async (req: NextRequest) => {
 *   // … unchanged handler body …
 * })
 */
export function withRouteErrors<Args extends unknown[]>(
  routeName: string,
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const chain = causeChain(error);
      console.error(`[api] ${routeName} failed:`, chain.join(" | "), error);

      // Only the links that actually name the missing object are returned. The
      // `DrizzleQueryError` link above them carries the query's interpolated
      // parameters, which hold whatever the caller was reading or saving.
      const drift = chain.filter((part) => SCHEMA_DRIFT.test(part));
      if (drift.length > 0) {
        return NextResponse.json(
          {
            error:
              "This feature is unavailable: the database is missing tables this build expects. " +
              "Run `npm run db:migrate:d1` against the deployed D1 database.",
            // Safe to surface — it names a table this repo's schema already
            // declares publicly, and it is the one detail that makes the
            // failure actionable from a bug report.
            detail: drift[drift.length - 1],
          },
          { status: 503 },
        );
      }

      // Anything else stays opaque to the client; the detail is in the log.
      return NextResponse.json({ error: "Something went wrong handling this request." }, { status: 500 });
    }
  };
}
