"use client"

import { Fragment, type ComponentType } from "react"
import { Bot, Check, Minus, Rocket, Search, Sparkles, Users, Zap } from "lucide-react"
import { cn } from "../../lib/ui/lib/utils"
import { Badge } from "../../lib/ui/primitives/badge"
import { Button } from "../../lib/ui/primitives/button"
import type { TierId, TierLimits } from "../../lib/stripe/limits"

/** What `/api/stripe/subscription` returns; see that route. */
export interface SubscriptionInfo {
  subscription: {
    plan: string | null
    status: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
  plans: { id: string; name: string; amount: number; checkoutUrl: string; limits?: TierLimits; features?: string[] }[]
  free?: { limits?: TierLimits; features: string[] }
  tier?: TierId
  usage?: { llmRequests: number; cardAiAnalyses: number; cardSearches: number } | null
}

interface Tier {
  id: string
  name: string
  blurb: string
  icon: ComponentType<{ className?: string }>
  amount: number
  limits?: TierLimits
  checkoutUrl?: string
}

const TIER_COPY: Record<string, { blurb: string; icon: Tier["icon"] }> = {
  free: { blurb: "For trying evidence search and the AI tools.", icon: Zap },
  "pro-vip": { blurb: "For debaters who research and prep every day.", icon: Rocket },
  "research-team": { blurb: "For coaches running a squad's prep and practice.", icon: Users },
}

/** Rows of the comparison table, grouped like the plan cards' features. */
const COMPARE: { group: string; icon: Tier["icon"]; rows: { label: string; key: keyof TierLimits; perDay?: boolean }[] }[] = [
  {
    group: "AI",
    icon: Bot,
    rows: [
      { label: "AI requests", key: "llmRequestsPerDay", perDay: true },
      { label: "Tokens per AI response", key: "llmMaxTokens" },
      { label: "Card AI analyses", key: "cardAiAnalysesPerDay", perDay: true },
    ],
  },
  {
    group: "Evidence",
    icon: Search,
    rows: [
      { label: "Card searches", key: "cardSearchesPerDay", perDay: true },
      { label: "Results per card search", key: "cardSearchResults" },
    ],
  },
  {
    group: "Team coaching",
    icon: Users,
    rows: [
      { label: "Students on your roster", key: "teamStudents" },
      { label: "Lesson plans assigned", key: "lessonPlans" },
      { label: "Practice drills assigned", key: "practiceDrills" },
    ],
  },
]

const price = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

function LimitValue({ value, perDay }: { value: number | null; perDay?: boolean }) {
  if (value === null) return <span className="font-medium">Unlimited</span>
  if (value === 0) return <Minus aria-label="Not included" className="mx-auto size-4 text-muted-foreground" />
  return (
    <span className="font-medium">
      {value.toLocaleString("en-US")}
      {perDay && <span className="text-muted-foreground font-normal"> / day</span>}
    </span>
  )
}

/**
 * The plan picker: a card per tier (icon, name, blurb, price, call to action)
 * with the next tier up highlighted, then a table comparing every limit in
 * `limits.ts`. Paid cards link to their Stripe Payment Link. It is shown only
 * from `PlanLimitDialog`, when a daily limit refuses a use.
 */
export function PricingPlans({ info }: { info: SubscriptionInfo }) {
  const currentId = info.subscription ? (info.tier ?? info.subscription.plan ?? "pro-vip") : "free"
  const tiers: Tier[] = [
    { id: "free", name: "Free", amount: 0, limits: info.free?.limits, ...TIER_COPY.free },
    ...info.plans.map((plan) => ({
      id: plan.id,
      name: plan.name.replace(/^Debate AI /, ""),
      amount: plan.amount,
      limits: plan.limits,
      checkoutUrl: plan.checkoutUrl,
      ...(TIER_COPY[plan.id] ?? { blurb: "", icon: Sparkles }),
    })),
  ]
  const currentIndex = Math.max(
    0,
    tiers.findIndex((tier) => tier.id === currentId),
  )
  const recommendedId = tiers[currentIndex + 1]?.id
  const comparable = tiers.every((tier) => tier.limits)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map((tier, index) => {
          const isCurrent = index === currentIndex
          const isRecommended = tier.id === recommendedId
          const Icon = tier.icon
          return (
            <div
              key={tier.id}
              data-plan={tier.id}
              className={cn(
                "bg-card text-card-foreground relative flex flex-col gap-5 rounded-xl border p-6",
                isRecommended && "border-primary shadow-md ring-1 ring-primary",
              )}
            >
              <div className="flex items-start justify-between">
                <span className="bg-muted flex size-10 items-center justify-center rounded-full">
                  <Icon className="size-5" />
                </span>
                {isRecommended && <Badge className="rounded-full">Recommended</Badge>}
                {isCurrent && (
                  <Badge variant="secondary" className="rounded-full">
                    Your plan
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className="text-muted-foreground text-sm">{tier.blurb}</p>
              </div>
              <p className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{price(tier.amount)}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </p>
              <div className="mt-auto">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : index < currentIndex || !tier.checkoutUrl ? (
                  <Button variant="outline" className="w-full" disabled>
                    Included
                  </Button>
                ) : (
                  <Button asChild variant={isRecommended ? "default" : "outline"} className="w-full">
                    <a href={tier.checkoutUrl} target="_blank" rel="noopener noreferrer">
                      Upgrade
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {comparable && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b">
                <th scope="col" className="px-4 py-3 text-left font-semibold">
                  Compare features
                </th>
                {tiers.map((tier) => (
                  <th key={tier.id} scope="col" className="px-4 py-3 text-center font-semibold">
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(({ group, icon: GroupIcon, rows }) => (
                <Fragment key={group}>
                  <tr className="bg-muted/50 border-b">
                    <th scope="colgroup" colSpan={tiers.length + 1} className="px-4 py-2.5 text-left font-medium">
                      <span className="flex items-center gap-2">
                        <GroupIcon className="size-4" />
                        {group}
                      </span>
                    </th>
                  </tr>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <th scope="row" className="text-muted-foreground px-4 py-2.5 text-left font-normal">
                        {row.label}
                      </th>
                      {tiers.map((tier) => (
                        <td key={tier.id} className="px-4 py-2.5 text-center">
                          <LimitValue value={tier.limits![row.key] as number | null} perDay={row.perDay} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr>
                <th scope="row" className="text-muted-foreground px-4 py-2.5 text-left font-normal">
                  Evidence search, card editor, flowing and timers
                </th>
                {tiers.map((tier) => (
                  <td key={tier.id} className="px-4 py-2.5 text-center">
                    <Check aria-label="Included" className="mx-auto size-4" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
