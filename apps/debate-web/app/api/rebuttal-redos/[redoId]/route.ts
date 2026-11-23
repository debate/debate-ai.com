import { NextRequest, NextResponse } from "next/server";
import { getDBFromContext } from "@/lib/database/context";
import { getUserId } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route-errors";
import { ensureRebuttalRedoTables } from "@/lib/rebuttal-redos/ensure-tables";
import { applyRedoUpdate, getRedoRow, getRedoViewer, redoViews, viewerRoleFor } from "@/lib/rebuttal-redos/store";
import { parseRedoUpdate } from "@debate-ai/practice-rounds/src/rebuttal-redos/validation";

/**
 * PATCH `RedoUpdate` — one move on a redo. The judge may `edit` (their
 * instructions, speech time, due date), `assign` or `skip` it, and `review`
 * it once turned in; the debater may `submit` (and resubmit until reviewed).
 * Returns `{ redo }`. Anyone else gets 404.
 */
export const PATCH = withRouteErrors(
  "PATCH /api/rebuttal-redos/[redoId]",
  async (req: NextRequest, context: { params: Promise<{ redoId: string }> }) => {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Sign in to update this redo." }, { status: 401 });
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const parsed = parseRedoUpdate(payload);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { redoId } = await context.params;
    const db = await getDBFromContext();
    await ensureRebuttalRedoTables(db);
    const viewer = await getRedoViewer(db, userId);
    const row = await getRedoRow(db, redoId);
    if (!viewer || !row || !viewerRoleFor(row, viewer.id)) return NextResponse.json({ error: "Redo not found." }, { status: 404 });

    const result = await applyRedoUpdate(db, row, viewer, parsed.value, Math.floor(Date.now() / 1000));
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const [redo] = await redoViews(db, [result.row], viewer.id);
    return NextResponse.json({ redo });
  },
);
