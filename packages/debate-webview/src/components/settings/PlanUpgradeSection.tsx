"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

interface SubscriptionInfo {
  subscription: {
    plan: string | null
    status: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
  plans: { id: string; name: string; amount: number; checkoutUrl: string }[]
}

/**
 * The signed-in user's current plan and a button per paid plan to upgrade,
 * at the top of the Preferences tab. Plans and their Payment Links (tagged
 * with the account so the webhook can attribute the purchase) come from
 * `/api/stripe/subscription`; renders nothing if that request fails.
 */
export function PlanUpgradeSection() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
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
  }, [])

  if (!info || info.plans.length === 0) return null
  const current = info.subscription
  const currentPlan = info.plans.find((plan) => plan.id === current?.plan)
  const renews = current?.currentPeriodEnd ? new Date(current.currentPeriodEnd).toLocaleDateString() : null
  const status = current
    ? `${currentPlan?.name ?? "Paid plan"} · ${current.status}${renews ? ` · ${current.cancelAtPeriodEnd ? "ends" : "renews"} ${renews}` : ""}`
    : "You are on the free plan."

  return (
    <section
      aria-label="Plan"
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 10,
        border: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <Sparkles size={16} />
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Plan</h4>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.6 }}>{status}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {info.plans.map((plan) => {
          const isCurrent = plan.id === current?.plan
          return (
            <div
              key={plan.id}
              style={{
                flex: "1 1 200px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                borderRadius: 8,
                background: "rgba(127, 127, 127, 0.08)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{plan.name}</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>${(plan.amount / 100).toFixed(2)} / month</div>
              {isCurrent ? (
                <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>Current plan</span>
              ) : (
                <a
                  href={plan.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 14px",
                    borderRadius: 8,
                    background: "#24A0ED",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Upgrade
                </a>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
