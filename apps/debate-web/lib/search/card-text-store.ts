/**
 * @fileoverview Where a card's full text lives: the `CARD_TEXT` R2 bucket,
 * one JSON object per card.
 *
 * A card's `fulltext` and `markup` (its Verbatim HTML) are most of a
 * `debate_cards` row's size, and millions of them pushed D1 toward its size
 * limit. So the Parquet import writes them here instead, and D1 keeps only
 * the card's metadata and its highlighted text (`spoken`), which is what
 * the highlight-scoped search and the FTS index read. Cards imported before
 * this held their text in D1; the admin panel's "Move card text to R2"
 * button (`/api/admin/debate-cards/move-text`) copies it here and empties
 * the D1 columns.
 *
 * A row whose `fulltext` and `markup` are both empty is read back from R2 by
 * {@link hydrateCardText} wherever a route shows a card's body. Without the
 * binding (local dev, tests) the importer keeps the text in D1 as before,
 * and hydration is a no-op.
 *
 * Keys are `cards/<id>.json` holding `{ fulltext, markup }`.
 *
 * The caselist speech docs behind card search's Outlines toggle live here
 * too, as `caselist-docs/<id>.html`: `caselist_documents.html` is emptied
 * by the same admin button and read back by {@link hydrateCaselistDocHtml}.
 * @module lib/search/card-text-store
 */

import { getCloudflareContext } from "@/lib/database/context";

/** The slice of the R2 binding this module uses. */
export interface CardTextBucket {
  // `any` keeps the existing test doubles (whose `put` only accepts a string)
  // assignable while the Topic Starter sync streams an archive body through.
  put(key: string, value: any, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(
    key: string,
    options?: { range?: { offset: number; length?: number } },
  ): Promise<{ text(): Promise<string>; arrayBuffer?(): Promise<ArrayBuffer> } | null>;
  /** Object metadata without its body; used to read a ZIP's size. */
  head?(key: string): Promise<{ size: number } | null>;
  /** Removes an object; used to clean up an archive after a successful sync. */
  delete?(key: string): Promise<unknown>;
}

/** The part of a card kept in R2. */
export interface StoredCardText {
  fulltext: string;
  markup: string;
}

const PREFIX = "cards";
const CASELIST_DOC_PREFIX = "caselist-docs";

/** R2 calls in flight at once, so a 200-card page doesn't open 200 requests together. */
const R2_CONCURRENCY = 16;

/** The bound bucket, or `null` when this deployment has none. */
export function getCardTextBucket(): CardTextBucket | null {
  const bucket = getCloudflareContext()?.env?.CARD_TEXT as CardTextBucket | undefined;
  return bucket && typeof bucket.put === "function" && typeof bucket.get === "function" ? bucket : null;
}

export function cardTextKey(id: number): string {
  return `${PREFIX}/${id}.json`;
}

/** Whether a stored row's body was moved out to R2 (or never had one). */
export function cardTextIsExternal(card: { fulltext?: string | null; markup?: string | null }): boolean {
  return !card.fulltext && !card.markup;
}

/** Runs `task` over `items` with at most `limit` in flight. */
async function forEachLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Writes each card's full text to R2. Cards with no text are skipped, so a
 * tag-only card costs nothing.
 */
export async function putCardTexts(
  bucket: CardTextBucket,
  cards: readonly ({ id: number } & StoredCardText)[],
): Promise<number> {
  const withText = cards.filter((card) => card.fulltext || card.markup);
  await forEachLimited(withText, R2_CONCURRENCY, async (card) => {
    await bucket.put(cardTextKey(card.id), JSON.stringify({ fulltext: card.fulltext, markup: card.markup }), {
      httpMetadata: { contentType: "application/json" },
    });
  });
  return withText.length;
}

/** Reads the stored text of each card id that has one. */
export async function readCardTexts(
  bucket: CardTextBucket,
  ids: readonly number[],
): Promise<Map<number, StoredCardText>> {
  const found = new Map<number, StoredCardText>();
  await forEachLimited([...new Set(ids)], R2_CONCURRENCY, async (id) => {
    try {
      const object = await bucket.get(cardTextKey(id));
      if (!object) return;
      const parsed = JSON.parse(await object.text()) as Partial<StoredCardText>;
      found.set(id, { fulltext: String(parsed.fulltext ?? ""), markup: String(parsed.markup ?? "") });
    } catch (error) {
      // One unreadable object must not fail a whole page of search results.
      console.error(`card-text-store: could not read card ${id}`, error);
    }
  });
  return found;
}

/**
 * Fills `fulltext` and `markup` back in on rows whose text lives in R2.
 *
 * @param cards - `debate_cards` rows (or a projection with `id`, `fulltext`
 *   and `markup`).
 * @param bucket - The bucket; defaults to the bound one.
 * @returns The same rows, with the text filled in where R2 had it.
 */
export async function hydrateCardText<T extends { id: number; fulltext: string; markup: string }>(
  cards: T[],
  bucket: CardTextBucket | null = getCardTextBucket(),
): Promise<T[]> {
  if (!bucket) return cards;
  const missing = cards.filter(cardTextIsExternal).map((card) => card.id);
  if (missing.length === 0) return cards;
  const texts = await readCardTexts(bucket, missing);
  if (texts.size === 0) return cards;
  return cards.map((card) => {
    const text = texts.get(card.id);
    return text && cardTextIsExternal(card) ? { ...card, ...text } : card;
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/**
 * The highlighted text of a card's Verbatim HTML: the contents of each
 * `<mark>`, tags stripped, joined by spaces. Used for `spoken` when the dump
 * row has none, so a card moved to R2 can still be searched by what is read.
 */
export function extractHighlightedText(markup: string): string {
  if (!markup || !/<mark\b/i.test(markup)) return "";
  const parts: string[] = [];
  for (const match of markup.matchAll(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi)) {
    const text = match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (_entity, name: string) => ENTITIES[name] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) parts.push(text);
  }
  return parts.join(" ");
}

export function caselistDocKey(id: number): string {
  return `${CASELIST_DOC_PREFIX}/${id}.html`;
}

/** Writes each caselist document's HTML to R2, skipping empty ones. */
export async function putCaselistDocHtml(
  bucket: CardTextBucket,
  docs: readonly { id: number; html: string }[],
): Promise<number> {
  const withHtml = docs.filter((doc) => doc.html);
  await forEachLimited(withHtml, R2_CONCURRENCY, async (doc) => {
    await bucket.put(caselistDocKey(doc.id), doc.html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
  });
  return withHtml.length;
}

/**
 * Fills `html` back in on caselist document rows whose HTML was moved to R2
 * (an empty `html` column).
 */
export async function hydrateCaselistDocHtml<T extends { id: number; html: string }>(
  docs: T[],
  bucket: CardTextBucket | null = getCardTextBucket(),
): Promise<T[]> {
  if (!bucket) return docs;
  const missing = [...new Set(docs.filter((doc) => !doc.html).map((doc) => doc.id))];
  if (missing.length === 0) return docs;
  const found = new Map<number, string>();
  await forEachLimited(missing, R2_CONCURRENCY, async (id) => {
    try {
      const object = await bucket.get(caselistDocKey(id));
      if (object) found.set(id, await object.text());
    } catch (error) {
      console.error(`card-text-store: could not read caselist document ${id}`, error);
    }
  });
  if (found.size === 0) return docs;
  return docs.map((doc) => (!doc.html && found.has(doc.id) ? { ...doc, html: found.get(doc.id)! } : doc));
}
