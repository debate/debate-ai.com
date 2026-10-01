import { PLAN_LIMIT_HEADER, type DailyMetric } from "./limits";

/**
 * Client half of the "show the plans only when a limit is hit" rule.
 *
 * The metered routes (`/api/reason-ai`, `/api/search`, `/api/card-ai-analysis`)
 * mark a refused use with the `x-plan-limit` header. Rather than teach every
 * caller of those routes to open a dialog, `watchPlanLimits` wraps
 * `window.fetch` once and reports any response carrying the header, and
 * `PlanLimitDialog` subscribes to show the pricing cards. Callers still get
 * the `429` back and handle it as before. No React here, so it tests without
 * a DOM.
 */

const METRICS: readonly DailyMetric[] = ["llmRequests", "cardAiAnalyses", "cardSearches"];

type Listener = (metric: DailyMetric) => void;
const listeners = new Set<Listener>();

/** Opens the pricing dialog for `metric`, for a caller that learns of a limit some other way. */
export function raisePlanLimit(metric: DailyMetric): void {
  for (const listener of listeners) listener(metric);
}

export function subscribeToPlanLimits(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The metric a response says was refused, or `null` when it isn't a plan-limit refusal. */
export function planLimitFromResponse(response: Pick<Response, "status" | "headers">): DailyMetric | null {
  if (response.status !== 429) return null;
  const value = response.headers.get(PLAN_LIMIT_HEADER);
  return METRICS.find((metric) => metric === value) ?? null;
}

const WATCHED = Symbol.for("debate-ai.planLimitWatcher");

/**
 * Wraps `target.fetch` (the window by default) so plan-limit refusals raise
 * the dialog. Idempotent per target; returns a function that restores it.
 */
export function watchPlanLimits(target: { fetch: typeof fetch } = globalThis): () => void {
  const current = target.fetch as typeof fetch & { [WATCHED]?: boolean };
  if (typeof current !== "function" || current[WATCHED]) return () => {};
  const original = current;
  const wrapped = (async (...args: Parameters<typeof fetch>) => {
    const response = await original.apply(target, args);
    const metric = planLimitFromResponse(response);
    if (metric) raisePlanLimit(metric);
    return response;
  }) as typeof fetch & { [WATCHED]?: boolean };
  wrapped[WATCHED] = true;
  target.fetch = wrapped;
  return () => {
    if (target.fetch === wrapped) target.fetch = original;
  };
}
