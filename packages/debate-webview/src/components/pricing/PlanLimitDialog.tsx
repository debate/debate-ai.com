"use client"

import { useEffect, useState } from "react"
import type { DailyMetric } from "../../lib/stripe/limits"
import { subscribeToPlanLimits, watchPlanLimits } from "../../lib/stripe/plan-limit"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../lib/ui/primitives/dialog"
import { PricingPlans, type SubscriptionInfo } from "./PricingPlans"

const METRIC_NAMES: Record<DailyMetric, string> = {
  llmRequests: "AI requests",
  cardAiAnalyses: "card AI analyses",
  cardSearches: "card searches",
}

/**
 * The only place the pricing plans appear: a dialog that opens when a metered
 * API route refuses a use for hitting the plan's daily limit (see
 * `lib/stripe/plan-limit.ts`). It fetches `/api/stripe/subscription` at that
 * moment, so the cards show the caller's current plan, today's usage and
 * account-tagged Payment Links. Mounted once by `AppShell`.
 */
export function PlanLimitDialog() {
  const [metric, setMetric] = useState<DailyMetric | null>(null)
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    const unwatch = watchPlanLimits()
    const unsubscribe = subscribeToPlanLimits(setMetric)
    return () => {
      unsubscribe()
      unwatch()
    }
  }, [])

  useEffect(() => {
    if (!metric) return
    let cancelled = false
    fetch("/api/stripe/subscription")
      .then((res) => (res.ok ? (res.json() as Promise<SubscriptionInfo>) : null))
      .then((data) => {
        if (!cancelled) setInfo(data)
      })
      .catch(() => {
        if (!cancelled) setInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [metric])

  // Nothing to sell without the plans, so a failed fetch leaves the caller's
  // own 429 message as the only signal.
  if (!metric || !info || info.plans.length === 0) return null

  const usage = info.usage
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setMetric(null)
          setInfo(null)
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <DialogTitle className="text-2xl">You've reached today's {METRIC_NAMES[metric]} limit</DialogTitle>
          <DialogDescription className="max-w-xl">
            Limits reset at midnight UTC. Upgrade for a higher daily limit and keep researching.
            {usage && (
              <>
                {" "}
                Today: {usage.llmRequests} AI requests · {usage.cardAiAnalyses} card AI analyses ·{" "}
                {usage.cardSearches} card searches.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <PricingPlans info={info} />
      </DialogContent>
    </Dialog>
  )
}
