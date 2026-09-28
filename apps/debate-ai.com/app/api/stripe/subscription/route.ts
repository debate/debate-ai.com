import { NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getSession } from "@/lib/auth/session"
import { describeLimits, limitsFor, tierForPlan } from "@/lib/stripe/limits"
import { checkoutUrl, PLANS } from "@/lib/stripe/plans"
import { getActiveSubscription } from "@/lib/stripe/store"
import { getDailyUsage } from "@/lib/stripe/usage"

/**
 * GET — the signed-in user's active Stripe subscription (or `null`), plus
 * each plan's Payment Link tagged with their user id and email so the
 * webhook can attribute the purchase. Signed-out callers get the plans with
 * untagged links.
 *
 * Every plan carries its tiered limits (`lib/stripe/limits.ts`) as both raw
 * numbers and display lines, `free` describes the free tier, and a signed-in
 * caller also gets their `tier` and today's `usage` against it.
 */
export async function GET() {
  const session = await getSession()
  const account = session ? { userId: session.user.id, email: session.user.email } : undefined
  const plans = PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    checkoutUrl: checkoutUrl(plan, account),
    limits: limitsFor(plan.id),
    features: describeLimits(limitsFor(plan.id)),
  }))
  const free = { limits: limitsFor("free"), features: describeLimits(limitsFor("free")) }

  if (!session) return NextResponse.json({ subscription: null, plans, free, tier: "free", usage: null })

  try {
    const db = await getDBFromContext()
    const [row, usage] = await Promise.all([
      getActiveSubscription(db, session.user.id),
      getDailyUsage(db, session.user.id),
    ])
    const subscription = row
      ? {
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        }
      : null
    return NextResponse.json({ subscription, plans, free, tier: tierForPlan(row?.plan), usage })
  } catch (error) {
    // e.g. the D1 migration adding `stripe_subscriptions` hasn't run yet.
    console.warn("Failed to load Stripe subscription", error)
    return NextResponse.json({ subscription: null, plans, free, tier: "free", usage: null })
  }
}
