"use client"

import { useEffect, useState } from "react"
import { KeyRound } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/primitives/dialog"
import { PricingPlans, type SubscriptionInfo } from "./PricingPlans"
import { OwnAiKeyForm } from "../settings/sections/OwnAiKeySection"
import { subscribeToSubscriptionDialog } from "../../lib/stripe/subscription-dialog"

const METRIC_NAMES: Record<string, string> = {
  llmRequests: "AI requests",
  cardAiAnalyses: "card AI analyses",
  cardSearches: "card searches",
}

/**
 * User-opened subscription dialog: shows today's AI usage, the plan picker
 * with upgrade Payment Links, and the option to bring your own AI key.
 * Opened from Settings → Debate Account via `openSubscriptionDialog`. Mounted
 * once by `AppShell`.
 */
export function SubscriptionDialog() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToSubscriptionDialog(() => setOpen(true))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!open) return
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
  }, [open])

  const canUpgrade = !!info && info.plans.length > 0
  const usage = info?.usage

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Upgrade your subscription</DialogTitle>
          <DialogDescription>
            Higher daily AI limits, billed to your account.
            {usage && (
              <>
                {" "}
                Today: {usage.llmRequests} AI requests · {usage.cardAiAnalyses} card AI analyses ·{" "}
                {usage.cardSearches} card searches. Limits reset at midnight UTC.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {canUpgrade && <PricingPlans info={info} />}
        <section className="rounded-lg border border-border p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="size-4" aria-hidden />
            Or bring your own key
          </p>
          <OwnAiKeyForm onSaved={() => setOpen(false)} />
        </section>
      </DialogContent>
    </Dialog>
  )
}
