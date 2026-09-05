import { inArray, lt } from "drizzle-orm";
import { getReuseCheckLogPurgeCutoff } from "debate-research-evidence";
import { getDBFromContext } from "../database/context";
import { reuseCheckLog } from "../database/schema";

/**
 * Deletes `reuse_check_log` rows older than the retention window (idea #7's
 * "On Page Card Reuse Search" — "a retention/purge policy for the
 * ever-growing reuse_check_log" follow-up; see the "Known gaps" bullet this
 * closes in `docs/features/on-page-card-reuse-search.md`). The log is an
 * append-only audit trail written on every `GET /api/evidence-reuse-check`
 * lookup with no cap of its own, so without this it grows forever.
 *
 * Runs weekly via the worker's `scheduled` export (`worker/index.ts`,
 * alongside the existing YouTube resync) and can also be triggered on demand
 * from the admin page via `POST /api/admin/evidence-reuse-check-log/purge`.
 */
export async function purgeOldReuseCheckLogRows(nowMs: number = Date.now()) {
  const db = await getDBFromContext();
  const cutoff = getReuseCheckLogPurgeCutoff(nowMs);

  const expired = await db
    .select({ id: reuseCheckLog.id })
    .from(reuseCheckLog)
    .where(lt(reuseCheckLog.checkedAt, cutoff));

  if (expired.length > 0) {
    await db.delete(reuseCheckLog).where(
      inArray(
        reuseCheckLog.id,
        expired.map((row) => row.id),
      ),
    );
  }

  return { cutoff, purgedCount: expired.length };
}
