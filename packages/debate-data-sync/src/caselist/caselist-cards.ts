/**
 * @fileoverview Turns a converted caselist document into card-library rows.
 *
 * The card library (`debate_cards`) was built for the published Parquet dump,
 * whose rows arrive with ids, pockets and caselist labels already assigned.
 * A document unpacked from a weekly archive has none of that, so this module
 * supplies it: the outline headings above each card become its pocket, hat
 * and block, the caselist descriptor becomes its event/level/year labels, and
 * the id is a stable hash of where the card came from — so re-importing the
 * same archive, or the same file in next week's dump, upserts the same rows
 * instead of adding duplicates.
 *
 * Output is plain objects in the ingest endpoint's field names; the endpoint
 * re-normalizes every row, so nothing here needs `debate-research-evidence`.
 *
 * @module caselist/caselist-cards
 */
import type { Card, OutlineNode } from "debate-card-parser";
import type { Caselist, CaselistEvent } from "./caselist-config";
import type { CaselistDocument } from "./caselist-archive";

/** One row for the card-library ingest endpoint. */
export interface CaselistCardRow {
  id: number;
  tag: string;
  cite: string;
  fullcite: string;
  summary: string;
  spoken: string;
  fulltext: string;
  textLength: number;
  markup: string;
  pocket: string;
  hat: string;
  block: string;
  bucketId: number;
  duplicateCount: number;
  side: string;
  caselistDisplayName: string;
  year: number;
  event: string;
  level: string;
}

/** Event codes the card library already uses for dump rows. */
const EVENT_CODES: Record<CaselistEvent, string> = { policy: "cx", ld: "ld", pf: "pf" };

/**
 * Lowest id a caselist-sync card is given.
 *
 * The Parquet dump's ids are small sequential integers; hashing into the top
 * of the safe-integer range keeps the two sources from ever colliding.
 */
const ID_FLOOR = 2 ** 51;

/**
 * 52-bit FNV-1a hash of a string, mapped into `[2^51, 2^52)`.
 *
 * Two 32-bit lanes rather than BigInt so it runs unchanged in the Worker, the
 * browser and Bun, and stays inside `Number.MAX_SAFE_INTEGER`.
 *
 * @param input - The provenance key.
 * @returns A stable positive integer id.
 */
export function caselistCardId(input: string): number {
  let high = 0x811c9dc5;
  let low = 0x01000193;
  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index);
    high = Math.imul(high ^ code, 0x01000193) >>> 0;
    low = Math.imul(low ^ (code + index), 0x5bd1e995) >>> 0;
  }
  // 19 bits from one lane and 32 from the other → 51 bits under the floor.
  return ID_FLOOR + (high & 0x7ffff) * 2 ** 32 + low;
}

/**
 * Strips markup to plain text.
 *
 * @param html - Card HTML.
 * @returns Its text, whitespace collapsed.
 */
function plainText(html: string): string {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distinguishes a card from an outline heading. */
function isCard(node: OutlineNode): node is Card {
  return "summary" in node;
}

/**
 * Converts one document's cards into ingest rows.
 *
 * @param document - A document from `loadCaselistArchive` with `parseCards` on.
 * @param caselist - The caselist the archive belongs to.
 * @returns One row per card with any text; empty when the document had none.
 */
export function caselistDocumentToCardRows(
  document: CaselistDocument,
  caselist: Caselist,
): CaselistCardRow[] {
  const outline: OutlineNode[] = document.outline ?? document.cards ?? [];
  const rows: CaselistCardRow[] = [];
  let pocket = "";
  let hat = "";
  let block = "";
  let position = 0;

  for (const node of outline) {
    if (!isCard(node)) {
      // Verbatim heading levels: 1 pocket, 2 hat, 3+ block.
      if (node.type === 1) [pocket, hat, block] = [node.text, "", ""];
      else if (node.type === 2) [hat, block] = [node.text, ""];
      else block = node.text;
      continue;
    }

    const markup = node.html ?? "";
    const fulltext = plainText(markup);
    const tag = String(node.summary ?? "").trim();
    if (!fulltext && !tag) continue;

    const key = [caselist.slug, document.path, position, tag.slice(0, 200)].join("|");
    position += 1;
    rows.push({
      id: caselistCardId(key),
      tag,
      cite: String(node.cite ?? ""),
      fullcite: String(node.cite ?? ""),
      summary: tag,
      spoken: String(node.marked ?? ""),
      fulltext,
      textLength: fulltext.length,
      markup,
      pocket,
      hat,
      block,
      bucketId: 0,
      duplicateCount: 0,
      side: document.side === "Aff" ? "A" : document.side === "Neg" ? "N" : "",
      caselistDisplayName: caselist.label,
      year: caselist.year,
      event: EVENT_CODES[caselist.event],
      level: caselist.level,
    });
  }
  return rows;
}
