import { desc, eq, sql } from "drizzle-orm";
import type { getDBFromContext } from "@/lib/database/context";
import { describeError } from "@/lib/database/errors";
import { filePurchases, stripeSubscriptions, user, walletTransactions } from "@/lib/database/schema";
import { ACTIVE_STATUSES, PLANS } from "@debate-ai/webview/lib/stripe/plans";

type AdminDB = Awaited<ReturnType<typeof getDBFromContext>>;

/** One account that has paid for something: a plan, a wallet top-up or a file. */
export interface Buyer {
  /** The account id, or `null` for a Stripe subscription not yet linked to an account. */
  userId: string | null;
  name: string | null;
  email: string | null;
  /** The newest subscription's plan name ("Debate AI Pro VIP"), or `null` if they never subscribed. */
  plan: string | null;
  /** Stripe's status for that subscription — `active`, `trialing`, `past_due`, `canceled`, … */
  status: string | null;
  /** Whether that subscription still grants the plan (see `ACTIVE_STATUSES`). */
  activeSubscription: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Real money added to the wallet through Stripe top-ups, in cents. */
  topUpCents: number;
  /** Files bought from the file market. */
  filesBought: number;
  /** Wallet balance spent on those files, in cents. */
  fileSpendCents: number;
  /** The most recent purchase of any kind, ISO. */
  lastPurchaseAt: string | null;
}

export interface BuyerTotals {
  buyers: number;
  activeSubscribers: number;
  /** Monthly recurring revenue from active subscriptions, in cents. */
  monthlyRecurringCents: number;
  topUpCents: number;
  filesSold: number;
  fileSalesCents: number;
}

export interface BuyersReport {
  buyers: Buyer[];
  totals: BuyerTotals;
}

interface SubscriptionRow {
  subscriptionId: string;
  userId: string | null;
  email: string | null;
  plan: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}
interface TopUpRow { userId: string; cents: number; last: number | null }
interface PurchaseRow { userId: string; files: number; cents: number; last: number | null }

const PLAN_BY_ID = new Map(PLANS.map((plan) => [plan.id as string, plan]));

function toIso(value: unknown): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * The payment tables are created by their own features on first use, so a
 * fresh database may not have them yet. Reads from a missing table count as
 * "nobody bought anything there" rather than failing the whole report.
 */
async function rowsOrEmpty<T>(query: () => Promise<unknown>): Promise<T[]> {
  try {
    return (await query()) as T[];
  } catch (error) {
    if (/no such table/i.test(describeError(error, 8))) return [];
    throw error;
  }
}

/**
 * Everyone who has paid: Stripe subscribers (current and past), wallet
 * top-ups and file-market purchases, merged into one row per account and
 * sorted with active subscribers first, then by most recent purchase.
 */
export async function loadBuyers(db: AdminDB): Promise<BuyersReport> {
  const [subscriptions, topUps, purchases] = await Promise.all([
    rowsOrEmpty<SubscriptionRow>(async () =>
      db
        .select({
          subscriptionId: stripeSubscriptions.subscriptionId,
          userId: stripeSubscriptions.userId,
          email: stripeSubscriptions.email,
          plan: stripeSubscriptions.plan,
          status: stripeSubscriptions.status,
          currentPeriodEnd: stripeSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: stripeSubscriptions.cancelAtPeriodEnd,
          createdAt: stripeSubscriptions.createdAt,
          updatedAt: stripeSubscriptions.updatedAt,
        })
        .from(stripeSubscriptions)
        .orderBy(desc(stripeSubscriptions.updatedAt)),
    ),
    rowsOrEmpty<TopUpRow>(async () =>
      db
        .select({
          userId: walletTransactions.userId,
          cents: sql<number>`coalesce(sum(${walletTransactions.amountCents}), 0)`,
          last: sql<number>`max(${walletTransactions.createdAt})`,
        })
        .from(walletTransactions)
        .where(eq(walletTransactions.kind, "topup"))
        .groupBy(walletTransactions.userId),
    ),
    rowsOrEmpty<PurchaseRow>(async () =>
      db
        .select({
          userId: filePurchases.buyerId,
          files: sql<number>`count(*)`,
          cents: sql<number>`coalesce(sum(${filePurchases.priceCents}), 0)`,
          last: sql<number>`max(${filePurchases.createdAt})`,
        })
        .from(filePurchases)
        .groupBy(filePurchases.buyerId),
    ),
  ]);

  const byKey = new Map<string, Buyer>();
  const entry = (userId: string | null, fallbackKey: string): Buyer => {
    const key = userId ?? fallbackKey;
    let buyer = byKey.get(key);
    if (!buyer) {
      buyer = {
        userId,
        name: null,
        email: null,
        plan: null,
        status: null,
        activeSubscription: false,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        topUpCents: 0,
        filesBought: 0,
        fileSpendCents: 0,
        lastPurchaseAt: null,
      };
      byKey.set(key, buyer);
    }
    return buyer;
  };

  // Newest subscription first, so an account's first row decides its plan —
  // except that an active one always wins over a canceled one.
  for (const row of subscriptions) {
    const buyer = entry(row.userId, `sub:${row.subscriptionId}`);
    const active = ACTIVE_STATUSES.has(row.status ?? "");
    if (buyer.plan === null || (active && !buyer.activeSubscription)) {
      buyer.plan = PLAN_BY_ID.get(row.plan ?? "")?.name ?? row.plan ?? "Unknown plan";
      buyer.status = row.status;
      buyer.activeSubscription = active;
      buyer.currentPeriodEnd = toIso(row.currentPeriodEnd);
      buyer.cancelAtPeriodEnd = Boolean(row.cancelAtPeriodEnd);
    }
    buyer.email ??= row.email;
    buyer.lastPurchaseAt = later(buyer.lastPurchaseAt, toIso(row.createdAt));
  }

  for (const row of topUps) {
    const buyer = entry(row.userId, row.userId);
    buyer.topUpCents += Number(row.cents) || 0;
    buyer.lastPurchaseAt = later(buyer.lastPurchaseAt, toIso(row.last));
  }

  for (const row of purchases) {
    const buyer = entry(row.userId, row.userId);
    buyer.filesBought += Number(row.files) || 0;
    buyer.fileSpendCents += Number(row.cents) || 0;
    buyer.lastPurchaseAt = later(buyer.lastPurchaseAt, toIso(row.last));
  }

  // Fill in names and emails for the accounts found above.
  const userIds = [...byKey.values()].map((b) => b.userId).filter((id): id is string => Boolean(id));
  if (userIds.length > 0) {
    const accounts = new Map<string, { name: string | null; email: string | null }>();
    // D1 caps bound parameters per statement, so look accounts up in chunks.
    for (let i = 0; i < userIds.length; i += 90) {
      const chunk = userIds.slice(i, i + 90);
      const rows = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(sql`${user.id} in (${sql.join(chunk.map((id) => sql`${id}`), sql`, `)})`);
      for (const row of rows) accounts.set(row.id, { name: row.name, email: row.email });
    }
    for (const buyer of byKey.values()) {
      const account = buyer.userId ? accounts.get(buyer.userId) : undefined;
      if (!account) continue;
      buyer.name = account.name;
      buyer.email = account.email ?? buyer.email;
    }
  }

  const buyers = [...byKey.values()].sort((a, b) => {
    if (a.activeSubscription !== b.activeSubscription) return a.activeSubscription ? -1 : 1;
    return (b.lastPurchaseAt ?? "").localeCompare(a.lastPurchaseAt ?? "");
  });

  const totals: BuyerTotals = {
    buyers: buyers.length,
    activeSubscribers: 0,
    monthlyRecurringCents: 0,
    topUpCents: 0,
    filesSold: 0,
    fileSalesCents: 0,
  };
  for (const row of subscriptions) {
    if (!ACTIVE_STATUSES.has(row.status ?? "")) continue;
    totals.activeSubscribers += 1;
    totals.monthlyRecurringCents += PLAN_BY_ID.get(row.plan ?? "")?.amount ?? 0;
  }
  for (const buyer of buyers) {
    totals.topUpCents += buyer.topUpCents;
    totals.filesSold += buyer.filesBought;
    totals.fileSalesCents += buyer.fileSpendCents;
  }

  return { buyers, totals };
}
