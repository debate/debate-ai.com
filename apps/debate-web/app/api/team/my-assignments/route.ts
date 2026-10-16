import { withRouteErrors } from "@/lib/api/route-errors"
import { assignmentsForStudent } from "@/lib/stripe/team"
import { teamRoute } from "@/lib/stripe/team-route"

/**
 * GET — the lesson plans and practice drills coaches have assigned to the
 * signed-in student (matched by their account email), newest first. Open to
 * any plan: only the coach needs Research Team.
 */
export const GET = withRouteErrors("GET /api/team/my-assignments", async () =>
  teamRoute(async (db, session) => ({ assignments: await assignmentsForStudent(db, session.user.email) })),
)
