/**
 * @fileoverview D1 reads and writes behind the file market (`/api/market`):
 * wallets, Stripe top-up credits, listings and purchases.
 *
 * D1 has no interactive transactions, so every balance change is a single
 * guarded `UPDATE` (a debit only lands while the balance covers it), and each
 * multi-step write undoes its earlier steps if a later one is refused.
 * Uniqueness does the rest: a Stripe session credits once
 * (`wallet_transactions.ref`) and a file is bought once (`file_purchases`'s
 * key).
 *
 * The pure rules — prices, the outline preview, the top-up options — live in
 * `@debate/file-market`.
 *
 * @module lib/market/queries
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ListingDetail, ListingSummary, OutlineEntry, TopUpCredit, Wallet } from "@debate/file-market";
import type { getDBFromContext } from "@/lib/database/context";
import {
  documents,
  fileListings,
  filePurchases,
  user,
  wallets,
  walletTransactions,
  type FileListingRow,
} from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** The most listings one market read returns. */
const LISTING_LIMIT = 200;

/** A purchase the market refused, with the status the route should answer. */
export class PurchaseRefused extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** The signed-in viewer, or `null` when the id names no account. */
export async function getMarketViewer(db: Db, userId: string) {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) return null;
  return { id: row.id, name: row.name, email: row.email, isAnonymous: Boolean(row.isAnonymous) };
}

/** The account's wallet, created at zero the first time it is asked for. */
export async function ensureWallet(db: Db, userId: string): Promise<Wallet> {
  await db.insert(wallets).values({ userId, balanceCents: 0 }).onConflictDoNothing();
  const [row] = await db
    .select({ balanceCents: wallets.balanceCents })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);
  return { balanceCents: row?.balanceCents ?? 0 };
}

async function debit(db: Db, userId: string, amountCents: number): Promise<boolean> {
  const rows = await db
    .update(wallets)
    .set({ balanceCents: sql`${wallets.balanceCents} - ${amountCents}`, updatedAt: new Date() })
    .where(and(eq(wallets.userId, userId), sql`${wallets.balanceCents} >= ${amountCents}`))
    .returning({ balanceCents: wallets.balanceCents });
  return rows.length > 0;
}

async function credit(db: Db, userId: string, amountCents: number): Promise<void> {
  if (amountCents <= 0) return;
  await db.insert(wallets).values({ userId, balanceCents: 0 }).onConflictDoNothing();
  await db
    .update(wallets)
    .set({ balanceCents: sql`${wallets.balanceCents} + ${amountCents}`, updatedAt: new Date() })
    .where(eq(wallets.userId, userId));
}

/**
 * Credits a paid Stripe top-up, once per Checkout Session. Returns `false`
 * when this session was already credited (a redelivered webhook) or when its
 * user id names no account.
 */
export async function creditTopUp(db: Db, topUp: TopUpCredit): Promise<boolean> {
  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.id, topUp.userId)).limit(1);
  if (!account) return false;
  const claimed = await db
    .insert(walletTransactions)
    .values({
      id: crypto.randomUUID(),
      userId: topUp.userId,
      kind: "topup",
      amountCents: topUp.amountCents,
      ref: `stripe:${topUp.sessionId}`,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: walletTransactions.id });
  if (claimed.length === 0) return false;
  try {
    await credit(db, topUp.userId, topUp.amountCents);
  } catch (error) {
    // Release the claim so Stripe's retry of this event can credit it.
    await db.delete(walletTransactions).where(eq(walletTransactions.id, claimed[0].id));
    throw error;
  }
  return true;
}

function iso(value: Date | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  return new Date(0).toISOString();
}

function readOutline(stored: string): OutlineEntry[] {
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as OutlineEntry[]) : [];
  } catch {
    return [];
  }
}

type SellerFields = { sellerName: string | null; sellerImage: string | null };

function toSummary(row: FileListingRow & SellerFields): ListingSummary {
  return {
    id: row.id,
    title: row.title,
    priceCents: row.priceCents,
    seller: { id: row.sellerId, name: row.sellerName ?? "Unknown", image: row.sellerImage ?? null },
    headings: readOutline(row.outline).length,
    sales: row.sales,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

const listingColumns = {
  id: fileListings.id,
  sellerId: fileListings.sellerId,
  documentId: fileListings.documentId,
  title: fileListings.title,
  outline: fileListings.outline,
  content: fileListings.content,
  format: fileListings.format,
  priceCents: fileListings.priceCents,
  active: fileListings.active,
  sales: fileListings.sales,
  createdAt: fileListings.createdAt,
  updatedAt: fileListings.updatedAt,
  sellerName: user.name,
  sellerImage: user.image,
};

/** The open listings, most recently listed or updated first. */
export async function listListings(db: Db): Promise<ListingSummary[]> {
  const rows = await db
    .select(listingColumns)
    .from(fileListings)
    .leftJoin(user, eq(user.id, fileListings.sellerId))
    .where(eq(fileListings.active, true))
    .orderBy(desc(fileListings.updatedAt))
    .limit(LISTING_LIMIT);
  return rows.map(toSummary);
}

async function hasPurchased(db: Db, listingId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ listingId: filePurchases.listingId })
    .from(filePurchases)
    .where(and(eq(filePurchases.listingId, listingId), eq(filePurchases.buyerId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** The raw listing row, contents included. */
export async function getListingRow(db: Db, id: string): Promise<FileListingRow | null> {
  const [row] = await db.select().from(fileListings).where(eq(fileListings.id, id)).limit(1);
  return row ?? null;
}

/**
 * One listing as `viewerId` may see it: the preview for anyone, the contents
 * only for its seller and its buyers. A stopped listing is visible only to
 * them too. `null` when it doesn't exist or the viewer can't see it.
 */
export async function getListing(db: Db, id: string, viewerId: string | null): Promise<ListingDetail | null> {
  const [row] = await db
    .select(listingColumns)
    .from(fileListings)
    .leftJoin(user, eq(user.id, fileListings.sellerId))
    .where(eq(fileListings.id, id))
    .limit(1);
  if (!row) return null;
  const isSeller = viewerId !== null && row.sellerId === viewerId;
  const owned = isSeller || (viewerId !== null && (await hasPurchased(db, id, viewerId)));
  if (!row.active && !owned) return null;
  return {
    ...toSummary(row),
    outline: readOutline(row.outline),
    owned,
    isSeller,
    active: Boolean(row.active),
    ...(owned ? { content: { content: row.content, format: row.format } } : {}),
  };
}

/** Listings `sellerId` has for sale, keyed by the document they came from. */
export async function listingsForDocuments(db: Db, sellerId: string, documentIds: number[]) {
  if (documentIds.length === 0) return [];
  return db
    .select({ id: fileListings.id, documentId: fileListings.documentId, priceCents: fileListings.priceCents })
    .from(fileListings)
    .where(
      and(
        eq(fileListings.sellerId, sellerId),
        eq(fileListings.active, true),
        inArray(fileListings.documentId, documentIds),
      ),
    );
}

/**
 * Lists `documentId` for sale at `priceCents`, or — when it is already
 * listed — reprices it and refreshes the snapshot buyers get. Refused when
 * the document is not the seller's own file.
 */
export async function upsertListing(
  db: Db,
  input: { sellerId: string; documentId: number; priceCents: number; outline: OutlineEntry[] },
): Promise<string> {
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      format: documents.format,
      isFolder: documents.isFolder,
    })
    .from(documents)
    .where(and(eq(documents.id, input.documentId), eq(documents.userId, input.sellerId)))
    .limit(1);
  if (!doc) throw new PurchaseRefused("That file isn't one of yours.", 404);
  if (doc.isFolder) throw new PurchaseRefused("Folders can't be sold — sell the files inside it.", 400);
  if (!doc.content.trim()) throw new PurchaseRefused("That file is empty.", 400);

  const now = new Date();
  const values = {
    title: doc.title,
    outline: JSON.stringify(input.outline),
    content: doc.content,
    format: doc.format,
    priceCents: input.priceCents,
    active: true,
    updatedAt: now,
  };
  const [existing] = await db
    .select({ id: fileListings.id, sellerId: fileListings.sellerId })
    .from(fileListings)
    .where(eq(fileListings.documentId, doc.id))
    .limit(1);
  if (existing) {
    await db.update(fileListings).set(values).where(eq(fileListings.id, existing.id));
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.insert(fileListings).values({
    id,
    sellerId: input.sellerId,
    documentId: doc.id,
    createdAt: now,
    sales: 0,
    ...values,
  });
  return id;
}

/** Takes a listing off the market. Only its seller can. */
export async function stopListing(db: Db, id: string, sellerId: string): Promise<boolean> {
  const rows = await db
    .update(fileListings)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(fileListings.id, id), eq(fileListings.sellerId, sellerId)))
    .returning({ id: fileListings.id });
  return rows.length > 0;
}

/** Saves the listing's file into `userId`'s own files and returns the new document's id. */
export async function copyListingToDocuments(db: Db, listing: FileListingRow, userId: string): Promise<number> {
  const [created] = await db
    .insert(documents)
    .values({
      title: listing.title,
      content: listing.content,
      format: listing.format,
      userId,
      parentId: null,
      isFolder: false,
    })
    .returning({ id: documents.id });
  return created.id;
}

/**
 * Buys `listing` for `buyerId`: debits the buyer, credits the seller the full
 * price, records the purchase and both ledger lines, and saves a copy to the
 * buyer's files. Returns that copy's document id.
 */
export async function purchaseListing(db: Db, listing: FileListingRow, buyerId: string): Promise<number> {
  if (listing.sellerId === buyerId) throw new PurchaseRefused("You're the seller of this file.", 409);
  if (!listing.active) throw new PurchaseRefused("This file is no longer for sale.", 410);
  if (await hasPurchased(db, listing.id, buyerId)) throw new PurchaseRefused("You already own this file.", 409);

  const price = listing.priceCents;
  await ensureWallet(db, buyerId);
  if (!(await debit(db, buyerId, price))) {
    throw new PurchaseRefused("Your wallet doesn't cover this file. Add money and try again.", 402);
  }

  const claimed = await db
    .insert(filePurchases)
    .values({ listingId: listing.id, buyerId, priceCents: price, createdAt: new Date() })
    .onConflictDoNothing()
    .returning({ listingId: filePurchases.listingId });
  if (claimed.length === 0) {
    // A second click that raced the first: give this charge back.
    await credit(db, buyerId, price);
    throw new PurchaseRefused("You already own this file.", 409);
  }

  await credit(db, listing.sellerId, price);
  const now = new Date();
  await db.insert(walletTransactions).values([
    {
      id: crypto.randomUUID(),
      userId: buyerId,
      kind: "purchase",
      amountCents: -price,
      ref: `purchase:${listing.id}:${buyerId}`,
      listingId: listing.id,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      userId: listing.sellerId,
      kind: "sale",
      amountCents: price,
      ref: `sale:${listing.id}:${buyerId}`,
      listingId: listing.id,
      createdAt: now,
    },
  ]);
  await db
    .update(fileListings)
    .set({ sales: sql`${fileListings.sales} + 1` })
    .where(eq(fileListings.id, listing.id));

  return copyListingToDocuments(db, listing, buyerId);
}

/** Whether `userId` may read the listing's contents: its seller or a buyer. */
export async function ownsListing(db: Db, listing: FileListingRow, userId: string): Promise<boolean> {
  return listing.sellerId === userId || hasPurchased(db, listing.id, userId);
}
