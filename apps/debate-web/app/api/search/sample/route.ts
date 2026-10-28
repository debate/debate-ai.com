/**
 * A small slice of the imported card corpus for the Coaching and Research
 * workspaces' "Load sample data" button (`@debate-ai/webview/lib/sample-data`).
 *
 * Reads a run of `debate_cards` rows by primary key from a random point in the
 * table (a PK range read, never a sort of the whole corpus), keeps the ones
 * with a tag and a body, and returns them trimmed to the `SampleCard` shape.
 * Each Worker isolate keeps the answer for a few minutes, and it is not
 * metered against card searches: it is a fixed demo sample, not a search.
 */
import { NextResponse } from "next/server";
import { and, asc, gte, ne, sql } from "drizzle-orm";
import { getDBFromContext } from "@/lib/database/context";
import { debateCards, type DebateCardRow } from "@/lib/database/schema";
import { hydrateCardText } from "@/lib/search/card-text-store";
import {
  SAMPLE_CARD_COUNT,
  pickSampleCards,
  toSampleCard,
  type SampleCard,
} from "@debate-ai/webview/lib/sample-data/sample-cards";

const CACHE_TTL_MS = 10 * 60 * 1000;
/** Rows read per attempt; most have a tag and body, and both sides are wanted. */
const READ_ROWS = 120;

let cache: { at: number; cards: SampleCard[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ cards: cache.cards });
  }
  try {
    const db = await getDBFromContext();
    const [bounds] = await db
      .select({ min: sql<number>`min(${debateCards.id})`, max: sql<number>`max(${debateCards.id})` })
      .from(debateCards);
    const min = Number(bounds?.min) || 0;
    const max = Number(bounds?.max) || 0;
    if (max <= 0) return NextResponse.json({ cards: [] });

    const read = (from: number) =>
      db
        .select()
        .from(debateCards)
        .where(and(gte(debateCards.id, from), ne(debateCards.tag, "")))
        .orderBy(asc(debateCards.id))
        .limit(READ_ROWS) as Promise<DebateCardRow[]>;

    // Start far enough from the end that a full read is still there.
    const span = Math.max(max - min - READ_ROWS * 4, 0);
    let rows = await read(min + Math.floor(Math.random() * span));
    if (rows.length < READ_ROWS / 2) rows = await read(min);

    // A card's body lives in R2 once moved off D1; only the candidates with a
    // tag are read back, and the answer is cached per isolate.
    rows = await hydrateCardText(rows);
    const cards = pickSampleCards(
      rows.map(toSampleCard).filter((card): card is SampleCard => card !== null),
      SAMPLE_CARD_COUNT,
    );
    if (cards.length > 0) cache = { at: Date.now(), cards };
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Sample cards failed:", error);
    return NextResponse.json({ cards: [], error: "Couldn't read the card database." }, { status: 500 });
  }
}
