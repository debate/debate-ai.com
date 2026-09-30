import { PLANS, type PlanId } from "./plans";

/**
 * Tiered usage limits for the free tier and each paid plan in `plans.ts`.
 *
 * Daily limits reset at 00:00 UTC and are counted per account (or per IP for
 * signed-out callers) in `usage_counters` — see `usage.ts`. `null` means
 * unlimited. `/api/stripe/subscription` returns these so the plan picker can
 * list every limit next to each plan.
 */

export type TierId = PlanId | "free";

export interface TierLimits {
  /** Requests to the general AI proxy (`/api/reason-ai`) per day. */
  llmRequestsPerDay: number | null;
  /** Largest `maxTokens` a single AI proxy request may ask for. */
  llmMaxTokens: number;
  /** New (not already saved) card AI analyses generated per day. */
  cardAiAnalysesPerDay: number | null;
  /** Card searches (`/api/search`) per day. */
  cardSearchesPerDay: number | null;
  /** Most cards one card search returns. */
  cardSearchResults: number;
  /** Students a coach can put on their team roster. */
  teamStudents: number;
  /** Lesson plans a coach can have assigned to their team at once. */
  lessonPlans: number;
  /** Practice drills a coach can have assigned to their team at once. */
  practiceDrills: number;
}

export const TIER_LIMITS: Readonly<Record<TierId, TierLimits>> = {
  free: {
    llmRequestsPerDay: 10,
    llmMaxTokens: 2048,
    cardAiAnalysesPerDay: 5,
    cardSearchesPerDay: 50,
    cardSearchResults: 50,
    teamStudents: 0,
    lessonPlans: 0,
    practiceDrills: 0,
  },
  "pro-vip": {
    llmRequestsPerDay: 200,
    llmMaxTokens: 8192,
    cardAiAnalysesPerDay: 100,
    cardSearchesPerDay: 1000,
    cardSearchResults: 200,
    teamStudents: 0,
    lessonPlans: 0,
    practiceDrills: 0,
  },
  "research-team": {
    llmRequestsPerDay: 1000,
    llmMaxTokens: 16384,
    cardAiAnalysesPerDay: 500,
    cardSearchesPerDay: null,
    cardSearchResults: 200,
    teamStudents: 10,
    lessonPlans: 100,
    practiceDrills: 200,
  },
};

/** The metrics counted per day in `usage_counters`. */
export type DailyMetric = "llmRequests" | "cardAiAnalyses" | "cardSearches";

export const DAILY_LIMIT_KEY: Readonly<Record<DailyMetric, keyof TierLimits>> = {
  llmRequests: "llmRequestsPerDay",
  cardAiAnalyses: "cardAiAnalysesPerDay",
  cardSearches: "cardSearchesPerDay",
};

/**
 * The tier a stored subscription `plan` grants. A paying subscriber on a
 * price missing from `PLANS` (`unknown`) still gets Pro rather than being
 * dropped to free.
 */
export function tierForPlan(plan: string | null | undefined): TierId {
  if (!plan) return "free";
  if (PLANS.some((p) => p.id === plan)) return plan as PlanId;
  return "pro-vip";
}

export function limitsFor(tier: TierId): TierLimits {
  return TIER_LIMITS[tier];
}

/** One human-readable line per limit, in the order the plan picker lists them. */
export function describeLimits(limits: TierLimits): string[] {
  const perDay = (n: number | null, what: string) =>
    n === null ? `Unlimited ${what}` : `${n.toLocaleString("en-US")} ${what} / day`;
  const lines = [
    perDay(limits.llmRequestsPerDay, "AI requests"),
    `Up to ${limits.llmMaxTokens.toLocaleString("en-US")} tokens per AI response`,
    perDay(limits.cardAiAnalysesPerDay, "card AI analyses"),
    perDay(limits.cardSearchesPerDay, "card searches"),
    `${limits.cardSearchResults} results per card search`,
  ];
  if (limits.teamStudents > 0) {
    lines.push(
      `Team roster of up to ${limits.teamStudents} students`,
      `${limits.lessonPlans} lesson plans assigned to your students`,
      `${limits.practiceDrills} practice drills assigned to your students`,
    );
  }
  return lines;
}
