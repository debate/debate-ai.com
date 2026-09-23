import { NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getSession } from "@/lib/auth/session"
import { checkoutUrl, PLANS } from "@/lib/stripe/plans"
import { getActiveSubscription } from "@/lib/stripe/store"

/**
 * GET — the signed-in user's active Stripe subscription (or `null`), plus
 * each plan's Payment Link tagged with their user id and email so the
 * webhook can attribute the purchase. Signed-out callers get the plans with
 * untagged links.
 */
export async function GET() {
  const session = await getSession()
  const account = session ? { userId: session.user.id, email: session.user.email } : undefined
  const plans = PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    checkoutUrl: checkoutUrl(plan, account),
  }))

  if (!session) return NextResponse.json({ subscription: null, plans })

  try {
    const db = await getDBFromContext()
    const row = await getActiveSubscription(db, session.user.id)
    const subscription = row
      ? {
          plan: row.plan,
          status: row.status,
          currentPeriodEnd: row.currentPeriodEnd,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        }
      : null
    return NextResponse.json({ subscription, plans })
  } catch (error) {
    // e.g. the D1 migration adding `stripe_subscriptions` hasn't run yet.
    console.warn("Failed to load Stripe subscription", error)
    return NextResponse.json({ subscription: null, plans })
  }
}
