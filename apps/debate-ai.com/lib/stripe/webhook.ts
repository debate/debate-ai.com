/**
 * Stripe webhook handling without the `stripe` SDK: signature verification is
 * a plain HMAC-SHA256 over `${timestamp}.${rawBody}` (Web Crypto, so it runs
 * the same on Workers and Node), and the few event shapes we read are typed
 * locally. See https://docs.stripe.com/webhooks#verify-manually.
 */

import { planForPrice, type PlanId } from "./plans";

/** Stripe's own default: reject signatures older than five minutes (replays). */
export const DEFAULT_TOLERANCE_SECONDS = 300;

export class StripeSignatureError extends Error {}

export interface StripeEvent {
  id: string;
  type: string;
  livemode?: boolean;
  data: { object: Record<string, any> };
}

function parseSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim());
    if (key === "t") timestamp = Number(value);
    else if (key === "v1" && value) signatures.push(value);
  }
  return { timestamp, signatures };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Builds a `Stripe-Signature` header for `payload`. Used by tests and by
 * anyone replaying a payload against a deployed endpoint.
 */
export async function signPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${await hmacSha256Hex(secret, `${timestamp}.${payload}`)}`;
}

/**
 * Verifies `payload` (the raw, unparsed request body) against the
 * `Stripe-Signature` header and returns the parsed event. `secrets` may hold
 * several signing secrets — e.g. the old and new one while rotating — and any
 * match is accepted. Throws `StripeSignatureError` on any mismatch.
 */
export async function constructEvent(
  payload: string,
  header: string | null,
  secrets: string[],
  { toleranceSeconds = DEFAULT_TOLERANCE_SECONDS, now = Math.floor(Date.now() / 1000) } = {},
): Promise<StripeEvent> {
  if (!header) throw new StripeSignatureError("Missing Stripe-Signature header");
  if (secrets.length === 0) throw new StripeSignatureError("No webhook signing secret configured");

  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new StripeSignatureError("Malformed Stripe-Signature header");
  }
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new StripeSignatureError("Stripe-Signature timestamp outside the tolerance window");
  }

  for (const secret of secrets) {
    const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
    if (signatures.some((sig) => timingSafeEqual(sig, expected))) {
      return JSON.parse(payload) as StripeEvent;
    }
  }
  throw new StripeSignatureError("No matching Stripe signature");
}

/** Splits `STRIPE_WEBHOOK_SECRET`, which may list several comma-separated secrets. */
export function parseSecrets(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The columns of `stripe_subscriptions` one event sets; absent keys are left untouched. */
export interface SubscriptionUpdate {
  subscriptionId: string;
  userId?: string;
  customerId?: string;
  email?: string;
  priceId?: string;
  plan?: PlanId | "unknown";
  status?: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}

function idOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return undefined;
}

/**
 * Reads a Subscription object. `current_period_end` moved from the
 * subscription onto its items in API version 2025-03-31, so both are checked.
 */
export function updateFromSubscription(sub: Record<string, any>): SubscriptionUpdate {
  const item = sub.items?.data?.[0];
  const priceId: string | undefined = item?.price?.id ?? item?.plan?.id;
  const periodEnd: number | undefined = item?.current_period_end ?? sub.current_period_end;
  return {
    subscriptionId: sub.id,
    customerId: idOf(sub.customer),
    ...(priceId ? { priceId, plan: planForPrice(priceId) } : {}),
    status: sub.status,
    currentPeriodEnd: typeof periodEnd === "number" ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
  };
}

/**
 * Maps an event to the subscription row it changes, or `null` for events that
 * don't affect subscriptions (and one-off `payment` mode checkouts). Stripe
 * does not guarantee delivery order, so the route re-reads the live
 * subscription when it can rather than trusting this snapshot's status.
 */
export function subscriptionUpdateForEvent(event: StripeEvent): SubscriptionUpdate | null {
  const object = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const subscriptionId = idOf(object.subscription);
      if (object.mode !== "subscription" || !subscriptionId) return null;
      return {
        subscriptionId,
        ...(object.client_reference_id ? { userId: String(object.client_reference_id) } : {}),
        customerId: idOf(object.customer),
        email: object.customer_details?.email ?? object.customer_email ?? undefined,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return updateFromSubscription(object);
    default:
      return null;
  }
}
