import { withRouteErrors } from "@/lib/api/route-errors"
import { limitsFor } from "@debate/webview/lib/stripe/limits"
import { createAssignment, deleteAssignment, listAssignments, requireTeamTier } from "@/lib/stripe/team"
import { readJson, teamRoute } from "@/lib/stripe/team-route"

/**
 * Lesson plans and practice drills a Research Team coach assigns to their
 * roster — to every student at once by default, or to `studentEmails`.
 *
 * GET → `{ assignments, limits: { lessonPlans, practiceDrills } }`
 * POST `{ kind: "lesson-plan" | "practice-drill", title, body?, dueAt?, studentEmails? }`
 *   → the new assignment.
 * DELETE `?id=` → `{ ok: true }`.
 */

export const GET = withRouteErrors("GET /api/team/assignments", async () =>
  teamRoute(async (db, session) => {
    const limits = limitsFor(await requireTeamTier(db, session.user.id))
    return {
      assignments: await listAssignments(db, session.user.id),
      limits: { lessonPlans: limits.lessonPlans, practiceDrills: limits.practiceDrills },
    }
  }),
)

export const POST = withRouteErrors("POST /api/team/assignments", async (request: Request) =>
  teamRoute(async (db, session) => {
    const tier = await requireTeamTier(db, session.user.id)
    return createAssignment(db, session.user.id, tier, await readJson(request))
  }),
)

export const DELETE = withRouteErrors("DELETE /api/team/assignments", async (request: Request) =>
  teamRoute(async (db, session) => {
    await requireTeamTier(db, session.user.id)
    await deleteAssignment(db, session.user.id, new URL(request.url).searchParams.get("id"))
    return { ok: true }
  }),
)
