"use client"

import { useEffect, useState } from "react"
import { KeyRound, Rocket } from "lucide-react"
import { attachOwnAiKey, subscribeToAiKeyNeeded } from "../../lib/ai/own-ai-key"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@debate-ai/ui/primitives/dialog"
import { OwnAiKeyForm } from "../settings/sections/OwnAiKeySection"
import { PricingPlans, type SubscriptionInfo } from "./PricingPlans"

/**
 * Installs the fetch wrapper that sends the user's own AI key with AI
 * requests (`lib/ai/own-ai-key.ts`), and opens when an AI route reports that
 * Debate AI's shared key has hit its API limit. The dialog is an upgrade box
 * with two options: upgrade the account (the same plan cards as
 * `PlanLimitDialog`, fetched from `/api/stripe/subscription` on open), or
 * bring your own key. When the plans can't be loaded only the key option shows.
 * Mounted once by `AppShell`, next to `PlanLimitDialog`.
 */
export function OwnAiKeyDialog() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    const detach = attachOwnAiKey()
    const unsubscribe = subscribeToAiKeyNeeded(() => setOpen(true))
    return () => {
      unsubscribe()
      detach()
    }
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={canUpgrade ? "max-h-[90vh] overflow-y-auto sm:max-w-5xl" : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>AI limit reached</DialogTitle>
          <DialogDescription>
            Debate AI&apos;s shared AI key has hit its API limit for now.{" "}
            {canUpgrade
              ? "Upgrade your account or bring your own key to keep going, then try again."
              : "Add your own key to keep going, then try again."}
          </DialogDescription>
        </DialogHeader>
        {canUpgrade && (
          <section data-option="upgrade" className="rounded-lg border border-border p-4">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Rocket className="size-4" aria-hidden />
              Upgrade your account
            </p>
            <p className="mb-4 text-sm text-muted-foreground">Higher daily AI limits, billed to your account.</p>
            <PricingPlans info={info} />
          </section>
        )}
        <section data-option="own-key" className="rounded-lg border border-border p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="size-4" aria-hidden />
            {canUpgrade ? "Or bring your own key" : "Bring your own key"}
          </p>
          <OwnAiKeyForm onSaved={() => setOpen(false)} />
        </section>
      </DialogContent>
    </Dialog>
  )
}
