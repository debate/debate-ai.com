import { withRouteErrors } from "@/lib/api/route-errors"
import { limitsFor } from "@debate-ai/webview/lib/stripe/limits"
import { addStudent, listStudents, removeStudent, requireTeamTier } from "@/lib/stripe/team"
import { getUserTier } from "@/lib/stripe/usage"
import { readJson, teamRoute } from "@/lib/stripe/team-route"

/**
 * A Research Team coach's student roster (up to the plan's `teamStudents`,
 * 10 today — see `@debate-ai/webview/src/lib/stripe/limits.ts`).
 *
 * GET → `{ students: string[], max }`. An account without the plan gets
 *   `{ students: [], max: 0 }` rather than a 403: Preferences asks on every
 *   visit to decide whether to show the coaching tools, and a 403 there
 *   printed a console error for everyone who isn't a coach.
 * POST `{ email }` → adds a student, returns the updated roster.
 * DELETE `?email=` → removes a student, returns the updated roster.
 */

export const GET = withRouteErrors("GET /api/team/students", async () =>
  teamRoute(async (db, session) => {
    const max = limitsFor(await getUserTier(db, session.user.id)).teamStudents
    if (max === 0) return { students: [], max }
    return { students: await listStudents(db, session.user.id), max }
  }),
)

export const POST = withRouteErrors("POST /api/team/students", async (request: Request) =>
  teamRoute(async (db, session) => {
    const tier = await requireTeamTier(db, session.user.id)
    const body = await readJson(request)
    return { students: await addStudent(db, session.user.id, tier, body.email), max: limitsFor(tier).teamStudents }
  }),
)

export const DELETE = withRouteErrors("DELETE /api/team/students", async (request: Request) =>
  teamRoute(async (db, session) => {
    const tier = await requireTeamTier(db, session.user.id)
    await removeStudent(db, session.user.id, new URL(request.url).searchParams.get("email"))
    return { students: await listStudents(db, session.user.id), max: limitsFor(tier).teamStudents }
  }),
)
