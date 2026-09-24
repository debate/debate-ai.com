/**
 * @fileoverview Validates URLs from debate card citations.
 *
 * Walks `debate_cards` in id order, extracts the source URL from each card's
 * citation using `debate-card-parser`, and makes an HTTP HEAD request to
 * check if the URL is still accessible. Returns paginated results so a corpus
 * of millions of rows can be checked incrementally.
 *
 * `POST { afterId?: number, limit?: number, timeoutMs?: number }` →
 * `{ processed, checked, valid, invalid, errors, nextAfterId, done }`.
 *
 * @module app/api/admin/debate-cards/validate-urls/route
 */
import { NextRequest, NextResponse } from "next/server";
import { asc, gt } from "drizzle-orm";
import { authorizeCardImport } from "@/lib/admin/debate-card-import";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards } from "@/lib/database/schema";
import { buildParquetCardReuseEntry } from "debate-research-evidence";

const DEFAULT_PAGE_ROWS = 500;
const MAX_PAGE_ROWS = 2_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_TIMEOUT_MS = 30_000;

interface UrlCheckResult {
  cardId: number;
  url: string;
  status: "valid" | "invalid" | "error";
  statusCode?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  const access = await authorizeCardImport(request);
  if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { afterId?: unknown; limit?: unknown; timeoutMs?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Empty body starts from the beginning with defaults.
  }
  const afterId = Math.max(0, Math.trunc(Number(body.afterId) || 0));
  const limit = Math.min(MAX_PAGE_ROWS, Math.max(1, Math.trunc(Number(body.limit) || DEFAULT_PAGE_ROWS)));
  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(1_000, Math.trunc(Number(body.timeoutMs) || DEFAULT_TIMEOUT_MS)));

  const db = await getDBFromContext();
  // Only fetch the cite columns needed to extract URLs.
  const cards = await db
    .select({
      id: debateCards.id,
      cite: debateCards.cite,
      fullcite: debateCards.fullcite,
      caselistDisplayName: debateCards.caselistDisplayName,
    })
    .from(debateCards)
    .where(gt(debateCards.id, afterId))
    .orderBy(asc(debateCards.id))
    .limit(limit);

  const results: UrlCheckResult[] = [];
  let valid = 0;
  let invalid = 0;
  let errors = 0;

  for (const card of cards) {
    const entry = buildParquetCardReuseEntry({
      id: card.id,
      tag: "",
      cite: card.cite,
      fullcite: card.fullcite,
      caselistDisplayName: card.caselistDisplayName,
    });
    if (!entry) {
      // Card has no extractable URL; skip without counting.
      continue;
    }

    const url = entry.sourceUrl;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        results.push({ cardId: card.id, url, status: "valid", statusCode: response.status });
        valid++;
      } else {
        results.push({
          cardId: card.id,
          url,
          status: "invalid",
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        });
        invalid++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (error instanceof DOMException && error.name === "AbortError") {
        results.push({ cardId: card.id, url, status: "error", error: `Timeout after ${timeoutMs}ms` });
      } else {
        results.push({ cardId: card.id, url, status: "error", error: message });
      }
      errors++;
    }
  }

  const last = cards[cards.length - 1];
  return NextResponse.json({
    processed: cards.length,
    checked: results.length,
    valid,
    invalid,
    errors,
    results,
    nextAfterId: last ? last.id : afterId,
    done: cards.length < limit,
  });
}