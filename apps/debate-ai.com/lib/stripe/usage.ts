import { and, eq, sql } from "drizzle-orm";
import { usageCounters } from "@/lib/database/schema";
import { DAILY_LIMIT_KEY, limitsFor, tierForPlan, type DailyMetric, type TierId, type TierLimits } from "./limits";
import { getActiveSubscription } from "./store";

/**
 * Enforcement side of the plan tiers in `limits.ts`: which tier a caller is
 * on, and the per-day counters in `usage_counters`.
 *
 * Every helper here fails open when the tables don't exist yet (a deploy
 * whose migrations haven't run), so a schema lag degrades to "unmetered"
 * rather than locking everyone out of search and AI.
 */

const isMissingTable = (error: unknown) => /no such table/i.test(error instanceof Error ? error.message : String(error));

/** Today's UTC date as `YYYY-MM-DD`, the key daily counters are bucketed by. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The usage subject for a caller: their user id, or `ip:<address>` when signed out. */
export function usageSubject(userId: string | null | undefined, request: Request): string {
  if (userId) return userId;
  const ip =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return `ip:${ip}`;
}

/** The tier the user's active subscription grants; `free` when signed out or unsubscribed. */
export async function getUserTier(db: any, userId: string | null | undefined): Promise<TierId> {
  if (!userId) return "free";
  try {
    const row = await getActiveSubscription(db, userId);
    return tierForPlan(row?.plan);
  } catch (error) {
    if (!isMissingTable(error)) console.warn("Failed to resolve plan tier", error);
    return "free";
  }
}

export interface UsageCheck {
  allowed: boolean;
  /** Uses counted today, including this one when allowed. */
  used: number;
  /** Today's limit, or `null` for unlimited. */
  limit: number | null;
}

/**
 * Counts one use of `metric` for `subject` today and reports whether it fit
 * under `limits`. An unlimited metric is still counted, so the settings page
 * can show usage. A refused use is not counted.
 */
export async function consumeDailyUsage(
  db: any,
  subject: string,
  metric: DailyMetric,
  limits: TierLimits,
  now: Date = new Date(),
): Promise<UsageCheck> {
  const limit = limits[DAILY_LIMIT_KEY[metric]] as number | null;
  const day = utcDay(now);
  try {
    const [row] = await db
      .insert(usageCounters)
      .values({ subject, metric, day, count: 1 })
      .onConflictDoUpdate({
        target: [usageCounters.subject, usageCounters.metric, usageCounters.day],
        set: { count: sql`${usageCounters.count} + 1` },
      })
      .returning({ count: usageCounters.count });
    const used = Number(row?.count ?? 1);
    if (limit !== null && used > limit) {
      await db
        .update(usageCounters)
        .set({ count: sql`${usageCounters.count} - 1` })
        .where(and(eq(usageCounters.subject, subject), eq(usageCounters.metric, metric), eq(usageCounters.day, day)));
      return { allowed: false, used: used - 1, limit };
    }
    return { allowed: true, used, limit };
  } catch (error) {
    if (!isMissingTable(error)) console.warn(`Failed to meter ${metric}`, error);
    return { allowed: true, used: 0, limit };
  }
}

/** Today's count for each daily metric. */
export async function getDailyUsage(
  db: any,
  subject: string,
  now: Date = new Date(),
): Promise<Record<DailyMetric, number>> {
  const usage: Record<DailyMetric, number> = { llmRequests: 0, cardAiAnalyses: 0, cardSearches: 0 };
  try {
    const rows = await db
      .select({ metric: usageCounters.metric, count: usageCounters.count })
      .from(usageCounters)
      .where(and(eq(usageCounters.subject, subject), eq(usageCounters.day, utcDay(now))));
    for (const row of rows as { metric: string; count: number }[]) {
      if (row.metric in usage) usage[row.metric as DailyMetric] = row.count;
    }
  } catch (error) {
    if (!isMissingTable(error)) console.warn("Failed to read usage", error);
  }
  return usage;
}

const METRIC_NAMES: Record<DailyMetric, string> = {
  llmRequests: "AI requests",
  cardAiAnalyses: "card AI analyses",
  cardSearches: "card searches",
};

/** The 429 message for a refused use, pointing at the upgrade. */
export function limitMessage(metric: DailyMetric, check: UsageCheck, tier: TierId): string {
  const upgrade = tier === "research-team" ? "" : " Upgrade your plan in Settings for a higher limit.";
  return `You've used all ${check.limit} of today's ${METRIC_NAMES[metric]} on your plan.${upgrade}`;
}
