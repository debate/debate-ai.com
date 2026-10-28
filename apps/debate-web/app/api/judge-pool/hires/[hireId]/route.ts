import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { describeHire, getHire, notifyJudgePool, transitionHire } from "@/lib/judge-pool/queries";
import { applyHireAction, parseHireAction, parseHireId } from "@debate-ai/practice-rounds/src/judge-pool/validation";

/**
 * One hire request, moved along by the judge or the organizer.
 *
 * PATCH { action } — `accept` | `decline` (the judge, while pending) or
 *   `cancel` (the organizer while pending, either side once accepted). The
 *   rules are `applyHireAction` in `@debate-ai/practice-rounds/src/judge-pool/validation.ts`,
 *   which the board also reads for its buttons. Returns the request as it now
 *   stands and notifies the other side. The write is guarded on the status the
 *   action was computed from, so a cancel racing an accept gets a 409.
 */

const VERBS = { accepted: "accepted", declined: "declined", cancelled: "called off" } as const;

export const PATCH = withRouteErrors(
  "PATCH /api/judge-pool/hires/[hireId]",
  async (req: NextRequest, context: { params: Promise<{ hireId: string }> }) => {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Sign in to answer hire requests." }, { status: 401 });
    }

    const { hireId } = await context.params;
    const id = parseHireId(hireId);
    if (!id.ok) {
      return NextResponse.json({ error: id.error }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const action = parseHireAction(payload);
    if (!action.ok) {
      return NextResponse.json({ error: action.error }, { status: 400 });
    }

    const db = await getDBFromContext();
    const hire = await getHire(db, id.value);
    if (!hire || (hire.organizerId !== userId && hire.judgeId !== userId)) {
      return NextResponse.json({ error: "That hire request could not be found." }, { status: 404 });
    }

    const result = applyHireAction(hire, userId, action.value);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.code });
    }
    if (!(await transitionHire(db, hire.id, hire.status, result.status))) {
      return NextResponse.json({ error: "That request changed while you were looking at it. Refresh and try again." }, { status: 409 });
    }

    const actor = userId === hire.judgeId ? hire.judge : hire.organizer;
    const recipient = userId === hire.judgeId ? hire.organizerId : hire.judgeId;
    const verb = VERBS[result.status as keyof typeof VERBS];
    if (verb) {
      await notifyJudgePool(db, recipient, {
        title: `${actor.name} ${verb} the judging request`,
        body: `${describeHire(hire)}.`,
      });
    }

    const updated = await getHire(db, hire.id);
    if (!updated) {
      return NextResponse.json({ error: "That hire request could not be found." }, { status: 404 });
    }
    const { organizerId: _organizerId, judgeId: _judgeId, ...wire } = updated;
    return NextResponse.json(wire);
  },
);
