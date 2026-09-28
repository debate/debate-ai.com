import { withRouteErrors } from "@/lib/api/route-errors"
import { limitsFor } from "@/lib/stripe/limits"
import { addStudent, listStudents, removeStudent, requireTeamTier } from "@/lib/stripe/team"
import { readJson, teamRoute } from "@/lib/stripe/team-route"

/**
 * A Research Team coach's student roster (up to the plan's `teamStudents`,
 * 10 today — see `lib/stripe/limits.ts`).
 *
 * GET → `{ students: string[], max }`
 * POST `{ email }` → adds a student, returns the updated roster.
 * DELETE `?email=` → removes a student, returns the updated roster.
 */

export const GET = withRouteErrors("GET /api/team/students", async () =>
  teamRoute(async (db, session) => {
    const tier = await requireTeamTier(db, session.user.id)
    return { students: await listStudents(db, session.user.id), max: limitsFor(tier).teamStudents }
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
