/**
 * @fileoverview D1 reads and writes behind research publishers
 * (`/api/market/publishers`) and a file's publication details
 * (`/api/doc/documents/<id>/metadata`).
 *
 * A publisher is a research group with a page, a list of student members and
 * a monthly subscription price. Subscribing pays one month from the reader's
 * wallet to the owner's through the same guarded wallet writes the file
 * market uses (`./queries.ts`); a subscription can only be renewed once it
 * has lapsed, so the claim on the subscription row — not the wallet — is what
 * stops two racing clicks from both being charged.
 *
 * The three tables are created here on first use: the app ships no
 * migrations (see `lib/database/ensure-columns.ts`). The pure rules live in
 * `@debate-ai/file-market` (`src/publishers.ts`).
 *
 * @module lib/market/publishers
 */

import { and, asc, count, eq, gt, lte, sql } from "drizzle-orm";
import {
  publisherSlug,
  findCampPublisherBySlug,
  readStudents,
  subscriptionEnd,
  type FileMetadata,
  type FileMetadataResponse,
  type PublishedFile,
  type PublisherPageResponse,
  type PublisherRequest,
  type PublisherSubscription,
  type PublisherSummary,
  type ResearchPublisher,
} from "@debate-ai/file-market";
import type { getDBFromContext } from "@/lib/database/context";
import { ensureDocumentColumns, fileStatColumns } from "@/lib/file-stats/columns";
import {
  documentMetadata,
  documents,
  researchPublishers,
  researchPublisherSubscriptions,
  user,
  walletTransactions,
  type ResearchPublisherRow,
} from "@/lib/database/schema";
import { credit, debit, ensureWallet, getMarketViewer, PurchaseRefused } from "./queries";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** The DDL for the three publisher tables, matching `schema.ts`. */
export const PUBLISHER_TABLES_SQL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS \`research_publishers\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`slug\` text NOT NULL,
	\`owner_id\` text NOT NULL,
	\`name\` text NOT NULL,
	\`description\` text DEFAULT '' NOT NULL,
	\`research_group\` text DEFAULT '' NOT NULL,
	\`students\` text DEFAULT '[]' NOT NULL,
	\`years\` text DEFAULT '' NOT NULL,
	\`website\` text DEFAULT '' NOT NULL,
	\`price_cents\` integer DEFAULT 0 NOT NULL,
	\`created_at\` integer DEFAULT (unixepoch()) NOT NULL,
	\`updated_at\` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (\`owner_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
)`,
  "CREATE UNIQUE INDEX IF NOT EXISTS `idx_research_publishers_slug` ON `research_publishers` (`slug`)",
  "CREATE INDEX IF NOT EXISTS `idx_research_publishers_owner` ON `research_publishers` (`owner_id`)",
  `CREATE TABLE IF NOT EXISTS \`research_publisher_subscriptions\` (
	\`publisher_id\` text NOT NULL,
	\`user_id\` text NOT NULL,
	\`price_cents\` integer DEFAULT 0 NOT NULL,
	\`started_at\` integer DEFAULT (unixepoch()) NOT NULL,
	\`expires_at\` integer NOT NULL,
	PRIMARY KEY(\`publisher_id\`, \`user_id\`),
	FOREIGN KEY (\`publisher_id\`) REFERENCES \`research_publishers\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
)`,
  "CREATE INDEX IF NOT EXISTS `idx_research_publisher_subscriptions_user` ON `research_publisher_subscriptions` (`user_id`)",
  `CREATE TABLE IF NOT EXISTS \`document_metadata\` (
	\`document_id\` integer PRIMARY KEY NOT NULL,
	\`publisher_id\` text,
	\`research_group\` text DEFAULT '' NOT NULL,
	\`students\` text DEFAULT '[]' NOT NULL,
	\`years\` text DEFAULT '' NOT NULL,
	\`published_on\` text DEFAULT '' NOT NULL,
	\`summary\` text DEFAULT '' NOT NULL,
	\`updated_at\` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (\`document_id\`) REFERENCES \`documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`publisher_id\`) REFERENCES \`research_publishers\`(\`id\`) ON UPDATE no action ON DELETE set null
)`,
  "CREATE INDEX IF NOT EXISTS `idx_document_metadata_publisher` ON `document_metadata` (`publisher_id`)",
];

const ready = new WeakMap<object, Promise<void>>();

/** Creates the publisher tables if they are missing. Once per database per isolate. */
export function ensurePublisherTables(db: Db): Promise<void> {
  const key = db as unknown as object;
  let pending = ready.get(key);
  if (!pending) {
    pending = (async () => {
      for (const statement of PUBLISHER_TABLES_SQL) await db.run(sql.raw(statement));
    })();
    pending.catch(() => ready.delete(key));
    ready.set(key, pending);
  }
  return pending;
}

function iso(value: Date | number | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  return new Date(0).toISOString();
}

function toSummary(row: Pick<ResearchPublisherRow, "id" | "slug" | "name" | "priceCents">): PublisherSummary {
  return { id: row.id, slug: row.slug, name: row.name, priceCents: row.priceCents };
}

/** A publisher row by its page slug. */
export async function getPublisherBySlug(db: Db, slug: string): Promise<ResearchPublisherRow | null> {
  await ensurePublisherTables(db);
  const [row] = await db.select().from(researchPublishers).where(eq(researchPublishers.slug, slug)).limit(1);
  return row ?? null;
}

/** The publishers `ownerId` runs, by name. */
export async function listOwnPublishers(db: Db, ownerId: string): Promise<PublisherSummary[]> {
  await ensurePublisherTables(db);
  const rows = await db
    .select()
    .from(researchPublishers)
    .where(eq(researchPublishers.ownerId, ownerId))
    .orderBy(asc(researchPublishers.name));
  return rows.map(toSummary);
}

/** A publisher as its page shows it: owner and live subscriber count included. */
export async function describePublisher(db: Db, row: ResearchPublisherRow): Promise<ResearchPublisher> {
  const [owner] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, row.ownerId))
    .limit(1);
  const [subscribers] = await db
    .select({ n: count() })
    .from(researchPublisherSubscriptions)
    .where(
      and(
        eq(researchPublisherSubscriptions.publisherId, row.id),
        gt(researchPublisherSubscriptions.expiresAt, new Date()),
      ),
    );
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    researchGroup: row.researchGroup,
    students: readStudents(row.students),
    years: row.years,
    website: row.website,
    priceCents: row.priceCents,
    owner: { id: row.ownerId, name: owner?.name ?? "Unknown", image: owner?.image ?? null },
    subscribers: subscribers?.n ?? 0,
    createdAt: iso(row.createdAt),
  };
}

function publisherValues(request: PublisherRequest) {
  return {
    name: request.name,
    description: request.description,
    researchGroup: request.researchGroup,
    students: JSON.stringify(request.students),
    years: request.years,
    website: request.website,
    priceCents: request.priceCents,
  };
}

/** Creates a publisher for `ownerId` under the first free slug made from its name. */
export async function createPublisher(db: Db, ownerId: string, request: PublisherRequest): Promise<ResearchPublisherRow> {
  await ensurePublisherTables(db);
  const base = publisherSlug(request.name);
  const now = new Date();
  // `camp-<code>` pages belong to the official camp publishers.
  const reserved = findCampPublisherBySlug(base) !== null;
  for (let attempt = reserved ? 2 : 1; attempt <= 20; attempt++) {
    const slug = attempt === 1 ? base : `${base}-${attempt}`;
    const [row] = await db
      .insert(researchPublishers)
      .values({ id: crypto.randomUUID(), slug, ownerId, ...publisherValues(request), createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
  }
  throw new PurchaseRefused("Pick a more distinctive name; that one is taken.", 409);
}

/** Saves an edit to a publisher. The slug stays put so links keep working. */
export async function updatePublisher(
  db: Db,
  row: ResearchPublisherRow,
  request: PublisherRequest,
): Promise<ResearchPublisherRow> {
  const [updated] = await db
    .update(researchPublishers)
    .set({ ...publisherValues(request), updatedAt: new Date() })
    .where(eq(researchPublishers.id, row.id))
    .returning();
  return updated ?? row;
}

/** The files published under a publisher by its owner — details only, never content. */
export async function listPublishedFiles(db: Db, publisher: ResearchPublisherRow): Promise<PublishedFile[]> {
  await ensureDocumentColumns(db).catch(() => undefined);
  const rows = await db
    .select({
      documentId: documents.id,
      title: documents.title,
      author: documents.author,
      quoteCount: documents.quoteCount,
      pageCount: documents.pageCount,
      researchGroup: documentMetadata.researchGroup,
      students: documentMetadata.students,
      years: documentMetadata.years,
      publishedOn: documentMetadata.publishedOn,
      summary: documentMetadata.summary,
    })
    .from(documentMetadata)
    .innerJoin(documents, eq(documents.id, documentMetadata.documentId))
    .where(
      and(
        eq(documentMetadata.publisherId, publisher.id),
        eq(documents.userId, publisher.ownerId),
        eq(documents.isFolder, false),
      ),
    )
    .orderBy(sql`${documentMetadata.publishedOn} DESC`, asc(documents.title));
  type Row = Omit<PublishedFile, "students"> & { students: string };
  return (rows as Row[]).map((row) => ({ ...row, students: readStudents(row.students) }));
}

/** The reader's subscription to a publisher, or `null` if they never had one. */
export async function getSubscription(
  db: Db,
  publisherId: string,
  userId: string,
): Promise<PublisherSubscription | null> {
  await ensurePublisherTables(db);
  const [row] = await db
    .select({ expiresAt: researchPublisherSubscriptions.expiresAt })
    .from(researchPublisherSubscriptions)
    .where(and(eq(researchPublisherSubscriptions.publisherId, publisherId), eq(researchPublisherSubscriptions.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { expiresAt: iso(row.expiresAt), active: row.expiresAt.getTime() > Date.now() };
}

/**
 * Subscribes `userId` to `publisher` for one month. A paid subscription
 * debits the reader and credits the owner the full price, with a ledger line
 * for each. Refused (`PurchaseRefused`) for the owner, for a reader whose
 * month hasn't run out yet, and with 402 when the wallet doesn't cover it.
 */
export async function subscribe(db: Db, publisher: ResearchPublisherRow, userId: string): Promise<PublisherSubscription> {
  await ensurePublisherTables(db);
  if (publisher.ownerId === userId) throw new PurchaseRefused("You run this publisher.", 409);

  const now = new Date();
  const end = subscriptionEnd(now);
  const price = publisher.priceCents;
  const key = and(
    eq(researchPublisherSubscriptions.publisherId, publisher.id),
    eq(researchPublisherSubscriptions.userId, userId),
  );
  const [previous] = await db
    .select({ expiresAt: researchPublisherSubscriptions.expiresAt, startedAt: researchPublisherSubscriptions.startedAt })
    .from(researchPublisherSubscriptions)
    .where(key)
    .limit(1);
  if (previous && previous.expiresAt.getTime() > now.getTime()) {
    throw new PurchaseRefused("You're already subscribed.", 409);
  }

  // Claim the month first: only one of two racing requests gets a row back.
  const claimed = previous
    ? await db
        .update(researchPublisherSubscriptions)
        .set({ expiresAt: end, startedAt: now, priceCents: price })
        .where(and(key, lte(researchPublisherSubscriptions.expiresAt, now)))
        .returning({ expiresAt: researchPublisherSubscriptions.expiresAt })
    : await db
        .insert(researchPublisherSubscriptions)
        .values({ publisherId: publisher.id, userId, priceCents: price, startedAt: now, expiresAt: end })
        .onConflictDoNothing()
        .returning({ expiresAt: researchPublisherSubscriptions.expiresAt });
  if (claimed.length === 0) throw new PurchaseRefused("You're already subscribed.", 409);

  if (price > 0) {
    await ensureWallet(db, userId);
    if (!(await debit(db, userId, price))) {
      // Give the claim back so the reader can try again after topping up.
      if (previous) {
        await db
          .update(researchPublisherSubscriptions)
          .set({ expiresAt: previous.expiresAt, startedAt: previous.startedAt })
          .where(key);
      } else {
        await db.delete(researchPublisherSubscriptions).where(key);
      }
      throw new PurchaseRefused("Your wallet doesn't cover this subscription. Add money and try again.", 402);
    }
    await credit(db, publisher.ownerId, price);
    const stamp = now.getTime();
    await db.insert(walletTransactions).values([
      {
        id: crypto.randomUUID(),
        userId,
        kind: "subscription",
        amountCents: -price,
        ref: `subscription:${publisher.id}:${userId}:${stamp}`,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        userId: publisher.ownerId,
        kind: "subscription_sale",
        amountCents: price,
        ref: `subscription-sale:${publisher.id}:${userId}:${stamp}`,
        createdAt: now,
      },
    ]);
  }
  return { expiresAt: end.toISOString(), active: true };
}

/**
 * Saves a copy of one of `publisher`'s files into `userId`'s files. Open to
 * the owner and to readers with a live subscription. Returns the copy's id.
 */
export async function copyPublishedFile(
  db: Db,
  publisher: ResearchPublisherRow,
  documentId: number,
  userId: string,
): Promise<number> {
  if (publisher.ownerId !== userId && !(await getSubscription(db, publisher.id, userId))?.active) {
    throw new PurchaseRefused("Subscribe to save this publisher's files.", 402);
  }
  await ensureDocumentColumns(db).catch(() => undefined);
  const [file] = await db
    .select({ title: documents.title, content: documents.content, format: documents.format, author: documents.author })
    .from(documentMetadata)
    .innerJoin(documents, eq(documents.id, documentMetadata.documentId))
    .where(
      and(
        eq(documentMetadata.documentId, documentId),
        eq(documentMetadata.publisherId, publisher.id),
        eq(documents.userId, publisher.ownerId),
        eq(documents.isFolder, false),
      ),
    )
    .limit(1);
  if (!file) throw new PurchaseRefused("That file isn't published here.", 404);
  const [created] = await db
    .insert(documents)
    .values({
      title: file.title,
      content: file.content,
      format: file.format,
      author: file.author || publisher.name,
      userId,
      parentId: null,
      isFolder: false,
      ...(await fileStatColumns(file.content, file.format)),
    })
    .returning({ id: documents.id });
  return created.id;
}

/** A file's details as the sidebar note and the metadata dialog read them. */
export async function getFileMetadata(db: Db, documentId: number, viewerId: string | null): Promise<FileMetadataResponse> {
  await ensurePublisherTables(db);
  await ensureDocumentColumns(db).catch(() => undefined);
  const [row] = await db
    .select({
      author: documents.author,
      publisherId: documentMetadata.publisherId,
      researchGroup: documentMetadata.researchGroup,
      students: documentMetadata.students,
      years: documentMetadata.years,
      publishedOn: documentMetadata.publishedOn,
      summary: documentMetadata.summary,
    })
    .from(documents)
    .leftJoin(documentMetadata, eq(documentMetadata.documentId, documents.id))
    .where(eq(documents.id, documentId))
    .limit(1);
  const metadata: FileMetadata = {
    author: row?.author ?? "",
    publisherId: row?.publisherId ?? null,
    researchGroup: row?.researchGroup ?? "",
    students: readStudents(row?.students),
    years: row?.years ?? "",
    publishedOn: row?.publishedOn ?? "",
    summary: row?.summary ?? "",
  };
  let publisher: PublisherSummary | null = null;
  if (metadata.publisherId) {
    const [found] = await db
      .select()
      .from(researchPublishers)
      .where(eq(researchPublishers.id, metadata.publisherId))
      .limit(1);
    publisher = found ? toSummary(found) : null;
  }
  return {
    metadata,
    publisher,
    ownPublishers: viewerId ? await listOwnPublishers(db, viewerId) : [],
    canEdit: viewerId !== null,
  };
}

/**
 * Saves a file's details. The publisher, when set, must be one the viewer
 * owns — nobody can publish under someone else's name.
 */
export async function saveFileMetadata(
  db: Db,
  documentId: number,
  viewerId: string,
  metadata: FileMetadata,
): Promise<FileMetadataResponse> {
  await ensurePublisherTables(db);
  await ensureDocumentColumns(db);
  if (metadata.publisherId) {
    const [owned] = await db
      .select({ id: researchPublishers.id })
      .from(researchPublishers)
      .where(and(eq(researchPublishers.id, metadata.publisherId), eq(researchPublishers.ownerId, viewerId)))
      .limit(1);
    if (!owned) throw new PurchaseRefused("You can only publish under a publisher you run.", 403);
  }
  const now = new Date();
  await db
    .update(documents)
    .set({ author: metadata.author || null })
    .where(eq(documents.id, documentId));
  const values = {
    publisherId: metadata.publisherId,
    researchGroup: metadata.researchGroup,
    students: JSON.stringify(metadata.students),
    years: metadata.years,
    publishedOn: metadata.publishedOn,
    summary: metadata.summary,
    updatedAt: now,
  };
  await db
    .insert(documentMetadata)
    .values({ documentId, ...values })
    .onConflictDoUpdate({ target: documentMetadata.documentId, set: values });
  return getFileMetadata(db, documentId, viewerId);
}

/** Everything a publisher's page shows, for `viewerId` (or a signed-out reader). */
export async function publisherPage(
  db: Db,
  row: ResearchPublisherRow,
  viewerId: string | null,
): Promise<PublisherPageResponse> {
  const viewer = viewerId ? await getMarketViewer(db, viewerId) : null;
  return {
    publisher: await describePublisher(db, row),
    files: await listPublishedFiles(db, row),
    subscription: viewer ? await getSubscription(db, row.id, viewer.id) : null,
    isOwner: viewer?.id === row.ownerId,
    wallet: viewer && !viewer.isAnonymous ? await ensureWallet(db, viewer.id) : null,
  };
}
