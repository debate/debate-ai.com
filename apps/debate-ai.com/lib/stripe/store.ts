import { and, desc, eq, inArray } from "drizzle-orm";
import { stripeSubscriptions, user } from "@/lib/database/schema";
import { ACTIVE_STATUSES } from "./plans";
import { updateFromSubscription, type SubscriptionUpdate } from "./webhook";

const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Reads the current state of a subscription straight from Stripe, so an
 * out-of-order webhook can't leave a stale status behind. Returns `null` when
 * no secret key is configured or the request fails — the caller then falls
 * back to the event's own snapshot.
 */
export async function fetchSubscription(
  subscriptionId: string,
  secretKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<SubscriptionUpdate | null> {
  if (!secretKey) return null;
  try {
    const res = await fetchImpl(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) {
      console.warn(`Stripe subscription lookup failed (${res.status}) for ${subscriptionId}`);
      return null;
    }
    return updateFromSubscription(await res.json());
  } catch (error) {
    console.warn("Stripe subscription lookup failed", error);
    return null;
  }
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * Upserts the row an event describes. A checkout without our
 * `client_reference_id` (someone opened the bare Payment Link) is attributed
 * by matching the checkout email to an account instead.
 */
export async function saveSubscriptionUpdate(db: any, update: SubscriptionUpdate): Promise<void> {
  let userId = update.userId;
  if (!userId && update.email) {
    const [match] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, update.email.toLowerCase()))
      .limit(1);
    userId = match?.id;
  }

  const values = definedOnly({ ...update, userId, updatedAt: new Date() });
  await db
    .insert(stripeSubscriptions)
    .values(values)
    .onConflictDoUpdate({ target: stripeSubscriptions.subscriptionId, set: values });
}

/** The user's most recently updated subscription that still grants access, if any. */
export async function getActiveSubscription(db: any, userId: string) {
  const [row] = await db
    .select()
    .from(stripeSubscriptions)
    .where(
      and(
        eq(stripeSubscriptions.userId, userId),
        inArray(stripeSubscriptions.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(stripeSubscriptions.updatedAt))
    .limit(1);
  return row ?? null;
}
