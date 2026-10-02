/**
 * @fileoverview The read and write side of prediction markets, over the
 * `prediction_wallets`, `prediction_markets` and `prediction_bets` tables in
 * `lib/database/schema.ts`. Pricing, payouts, validation and the settlement
 * rules are the `debate-predictions` package; this file only moves rows.
 *
 * ## Points are play money
 *
 * Every account gets `STARTING_BALANCE` points once, the first time it opens
 * the markets. Nothing buys more and nothing cashes out; a balance moves only
 * by a bet, a payout or a refund. Guest (anonymous) accounts can browse but
 * get no wallet.
 *
 * ## Why every write is guarded
 *
 * D1 has no interactive transactions, so a bet is three guarded statements:
 *
 * 1. Debit the wallet `WHERE balance >= stake` — a bet you cannot afford
 *    matches no row.
 * 2. Write the market's new share vector `WHERE version = <the version the
 *    price was computed from> AND status = 'open'` — two bets priced off the
 *    same shares cannot both land; the loser is refunded and asked to retry.
 * 3. Record the bet.
 *
 * Settling claims the market first (`WHERE status = 'open'`), so a market is
 * paid out exactly once even if a moderator and the auto-resolver race.
 *
 * ## Auto-resolution
 *
 * {@link resolveDueMarkets} runs on every board read, a few markets at a time.
 * Hosted Tabroom rounds and events are checked whether or not betting has
 * closed — a result that is in should stop the betting — while rating markets
 * settle only once their close time has passed.
 *
 * @module lib/predictions/queries
 */

import { and, asc, desc, eq, inArray, lte, ne, or, sql, like } from "drizzle-orm";
import {
  DEFAULT_LIQUIDITY,
  STARTING_BALANCE,
  canResolveMarket,
  decideEvent,
  decidePanel,
  decideRating,
  entryOutcomeId,
  lmsrPrices,
  lmsrSharesForStake,
  parsePresetId,
  positionsFromBets,
  readStoredArray,
  readStoredSource,
  settlePayouts,
  type Decision,
  type EventResultSet,
  type MarketOutcome,
  type MarketPerson,
  type MarketSource,
  type PanelBallot,
  type PredictionLeader,
  type PredictionMarket,
  type PredictionWallet,
  type TabroomEntryOption,
  type TabroomEventOption,
  type TabroomPanelOption,
} from "@debate/predictions";

import type { getDBFromContext } from "@/lib/database/context";
import {
  notifications,
  predictionBets,
  predictionMarkets,
  predictionWallets,
  user,
  type PredictionMarketRow,
} from "@/lib/database/schema";

type Db = Awaited<ReturnType<typeof getDBFromContext>>;

/** Where every prediction-market notification sends its reader. */
export const PREDICTIONS_LINK = "/practice/predictions";

/** The most open markets one board read lists. */
const OPEN_LIMIT = 200;
/** The most settled markets one board read lists. */
const SETTLED_LIMIT = 30;
/** How many wallets the leaderboard shows. */
const LEADER_LIMIT = 10;
/** The most markets one board read tries to settle. */
const RESOLVE_BATCH = 20;
/** Hosted tournaments that ended longer ago than this are not offered as sources. */
const SOURCE_EVENT_GRACE_DAYS = 14;

function toWireTime(value: Date): number;
function toWireTime(value: Date | null): number | null;
function toWireTime(value: Date | null): number | null {
  return value ? Math.floor(value.getTime() / 1000) : null;
}

/** The viewer's public fields and whether they are a guest, or `null` if the row is gone. */
export async function getViewer(
  db: Db,
  viewerId: string,
): Promise<(MarketPerson & { isAnonymous: boolean }) | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, image: user.image, isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, viewerId))
    .limit(1);
  if (!row) return null;
  return { id: row.id, name: row.name, imageUrl: row.image ?? null, isAnonymous: Boolean(row.isAnonymous) };
}

async function hydratePeople(db: Db, ids: Iterable<string | null>): Promise<Map<string, MarketPerson>> {
  const unique = [...new Set([...ids].filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows: { id: string; name: string; image: string | null }[] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, unique));
  return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name, imageUrl: row.image ?? null }]));
}

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

/** The account's wallet, granting the starting balance the first time. */
export async function ensureWallet(db: Db, userId: string): Promise<PredictionWallet> {
  const read = async () =>
    (
      await db
        .select({ balance: predictionWallets.balance, grantedAt: predictionWallets.grantedAt })
        .from(predictionWallets)
        .where(eq(predictionWallets.userId, userId))
        .limit(1)
    )[0];
  let row = await read();
  if (!row) {
    // `onConflictDoNothing`: two first visits at once grant the points once.
    await db
      .insert(predictionWallets)
      .values({ userId, balance: STARTING_BALANCE, grantedAt: new Date(), updatedAt: new Date() })
      .onConflictDoNothing();
    row = await read();
  }
  return { balance: row!.balance, grantedAt: toWireTime(row!.grantedAt) };
}

/** Takes `amount` from the wallet if it holds that much; `false` when it does not. */
async function debitWallet(db: Db, userId: string, amount: number): Promise<boolean> {
  const rows = await db
    .update(predictionWallets)
    .set({ balance: sql`${predictionWallets.balance} - ${amount}`, updatedAt: new Date() })
    .where(and(eq(predictionWallets.userId, userId), sql`${predictionWallets.balance} >= ${amount}`))
    .returning({ balance: predictionWallets.balance });
  return rows.length > 0;
}

async function creditWallet(db: Db, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(predictionWallets)
    .set({ balance: sql`${predictionWallets.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(predictionWallets.userId, userId));
}

/** The richest wallets, highest first. */
export async function listLeaders(db: Db): Promise<PredictionLeader[]> {
  const rows: { id: string; name: string; image: string | null; balance: number }[] = await db
    .select({ id: user.id, name: user.name, image: user.image, balance: predictionWallets.balance })
    .from(predictionWallets)
    .innerJoin(user, eq(user.id, predictionWallets.userId))
    .orderBy(desc(predictionWallets.balance), asc(predictionWallets.grantedAt))
    .limit(LEADER_LIMIT);
  return rows.map((row) => ({ id: row.id, name: row.name, imageUrl: row.image ?? null, balance: row.balance }));
}

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

/** Who is looking, for the per-viewer fields of a market. */
export interface MarketViewer {
  id: string;
  isStaff: boolean;
}

type BetSummary = { marketId: string; outcomeId: string; stake: number; shares: number; payout: number | null };

function toMarket(
  row: PredictionMarketRow,
  people: Map<string, MarketPerson>,
  viewer: MarketViewer | null,
  viewerBets: readonly BetSummary[],
): PredictionMarket {
  const outcomes = readStoredArray<MarketOutcome>(row.outcomes);
  const shares = readStoredArray<number>(row.shares, outcomes.map(() => 0));
  const prices = lmsrPrices(shares, row.liquidity);
  const source = readStoredSource(row.source);
  const positions = positionsFromBets(viewerBets);
  const settled = viewerBets.length > 0 && viewerBets.every((bet) => bet.payout !== null);
  return {
    id: row.id,
    kind: row.kind as PredictionMarket["kind"],
    title: row.title,
    description: row.description,
    status: row.status as PredictionMarket["status"],
    outcomes: outcomes.map((outcome, index) => ({ ...outcome, price: prices[index] ?? 0, shares: shares[index] ?? 0 })),
    liquidity: row.liquidity,
    closesAt: toWireTime(row.closesAt),
    createdAt: toWireTime(row.createdAt),
    creator: row.creatorId ? (people.get(row.creatorId) ?? null) : null,
    source,
    volume: row.volume,
    resolvedOutcome: row.resolvedOutcome,
    resolvedAt: toWireTime(row.resolvedAt),
    resolutionNote: row.resolutionNote,
    positions,
    payout: settled ? viewerBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0) : null,
    canResolve: viewer
      ? canResolveMarket({
          status: row.status as PredictionMarket["status"],
          source,
          isCreator: row.creatorId === viewer.id,
          isStaff: viewer.isStaff,
          holdsPosition: positions.length > 0,
        })
      : false,
    preset: parsePresetId(row.id),
  };
}

async function viewerBetsFor(db: Db, viewerId: string, marketIds: string[]): Promise<BetSummary[]> {
  if (marketIds.length === 0) return [];
  return db
    .select({
      marketId: predictionBets.marketId,
      outcomeId: predictionBets.outcomeId,
      stake: predictionBets.stake,
      shares: predictionBets.shares,
      payout: predictionBets.payout,
    })
    .from(predictionBets)
    .where(and(eq(predictionBets.userId, viewerId), inArray(predictionBets.marketId, marketIds)));
}

async function toMarkets(db: Db, rows: PredictionMarketRow[], viewer: MarketViewer | null): Promise<PredictionMarket[]> {
  const [people, bets] = await Promise.all([
    hydratePeople(db, rows.map((row) => row.creatorId)),
    viewer ? viewerBetsFor(db, viewer.id, rows.map((row) => row.id)) : Promise.resolve([] as BetSummary[]),
  ]);
  return rows.map((row) => toMarket(row, people, viewer, bets.filter((bet) => bet.marketId === row.id)));
}

/** Open markets (closing soonest first), then recently settled ones. */
export async function listMarkets(db: Db, viewer: MarketViewer | null): Promise<PredictionMarket[]> {
  const [open, settled] = await Promise.all([
    db
      .select()
      .from(predictionMarkets)
      .where(eq(predictionMarkets.status, "open"))
      .orderBy(asc(predictionMarkets.closesAt))
      .limit(OPEN_LIMIT),
    db
      .select()
      .from(predictionMarkets)
      .where(ne(predictionMarkets.status, "open"))
      .orderBy(desc(predictionMarkets.resolvedAt))
      .limit(SETTLED_LIMIT),
  ]);
  return toMarkets(db, [...open, ...settled], viewer);
}

export async function getMarketRow(db: Db, marketId: string): Promise<PredictionMarketRow | null> {
  const [row] = await db.select().from(predictionMarkets).where(eq(predictionMarkets.id, marketId)).limit(1);
  return row ?? null;
}

/** One market as the board shows it to `viewer`. */
export async function getMarket(db: Db, marketId: string, viewer: MarketViewer | null): Promise<PredictionMarket | null> {
  const row = await getMarketRow(db, marketId);
  return row ? (await toMarkets(db, [row], viewer))[0] : null;
}

/** How many open markets an account has created. */
export async function countOpenMarketsBy(db: Db, creatorId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(predictionMarkets)
    .where(and(eq(predictionMarkets.creatorId, creatorId), eq(predictionMarkets.status, "open")));
  return Number(row?.count ?? 0);
}

/** Opens a market with every outcome priced equally. */
export async function insertMarket(
  db: Db,
  input: {
    id: string;
    /** Null for the markets the site opens itself (see `presets.ts`). */
    creatorId: string | null;
    kind: PredictionMarket["kind"];
    title: string;
    description: string;
    outcomes: MarketOutcome[];
    source: MarketSource;
    closesAt: number;
  },
): Promise<void> {
  await db.insert(predictionMarkets).values({
    id: input.id,
    kind: input.kind,
    title: input.title,
    description: input.description,
    creatorId: input.creatorId,
    status: "open",
    outcomes: JSON.stringify(input.outcomes),
    shares: JSON.stringify(input.outcomes.map(() => 0)),
    liquidity: DEFAULT_LIQUIDITY,
    version: 0,
    volume: 0,
    source: JSON.stringify(input.source),
    closesAt: new Date(input.closesAt * 1000),
    createdAt: new Date(),
  });
}

/** Why a bet did not land, in words fit for the reader. */
export class BetRefused extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Places a bet of `stake` points on `outcomeId`, returning the shares bought.
 * Throws {@link BetRefused} when the market has closed, the wallet cannot
 * cover it, or another bet moved the price first.
 */
export async function placeBet(
  db: Db,
  input: { market: PredictionMarketRow; userId: string; outcomeId: string; stake: number; now: number },
): Promise<number> {
  const { market, userId, outcomeId, stake } = input;
  if (market.status !== "open" || toWireTime(market.closesAt) <= input.now) {
    throw new BetRefused("Betting on this market has closed.", 409);
  }
  const outcomes = readStoredArray<MarketOutcome>(market.outcomes);
  const index = outcomes.findIndex((outcome) => outcome.id === outcomeId);
  if (index === -1) throw new BetRefused("Pick an outcome to bet on.", 400);
  const shares = readStoredArray<number>(market.shares, outcomes.map(() => 0));
  const bought = lmsrSharesForStake(shares, market.liquidity, index, stake);
  if (!(bought > 0) || !Number.isFinite(bought)) throw new BetRefused("That bet is too small to buy any shares.", 400);

  if (!(await debitWallet(db, userId, stake))) {
    throw new BetRefused("You don't have enough points for that bet.", 409);
  }

  const next = shares.slice();
  next[index] += bought;
  const moved = await db
    .update(predictionMarkets)
    .set({
      shares: JSON.stringify(next),
      version: market.version + 1,
      volume: sql`${predictionMarkets.volume} + ${stake}`,
    })
    .where(
      and(
        eq(predictionMarkets.id, market.id),
        eq(predictionMarkets.version, market.version),
        eq(predictionMarkets.status, "open"),
      ),
    )
    .returning({ id: predictionMarkets.id });
  if (moved.length === 0) {
    await creditWallet(db, userId, stake);
    throw new BetRefused("The odds moved while you were betting. Check the new price and try again.", 409);
  }

  await db.insert(predictionBets).values({
    id: crypto.randomUUID(),
    marketId: market.id,
    userId,
    outcomeId,
    stake,
    shares: bought,
    payout: null,
    createdAt: new Date(),
  });
  return bought;
}

/**
 * Settles a market: `winner` is the winning outcome id, or `null` to void it
 * and refund every stake. Returns `false` when it had already been settled.
 */
export async function settleMarket(
  db: Db,
  marketId: string,
  winner: string | null,
  note: string,
): Promise<boolean> {
  const claimed = await db
    .update(predictionMarkets)
    .set({
      status: winner === null ? "void" : "resolved",
      resolvedOutcome: winner,
      resolvedAt: new Date(),
      resolutionNote: note || null,
    })
    .where(and(eq(predictionMarkets.id, marketId), eq(predictionMarkets.status, "open")))
    .returning({ title: predictionMarkets.title, outcomes: predictionMarkets.outcomes });
  if (claimed.length === 0) return false;

  const bets: { id: string; userId: string; outcomeId: string; stake: number; shares: number }[] = await db
    .select({
      id: predictionBets.id,
      userId: predictionBets.userId,
      outcomeId: predictionBets.outcomeId,
      stake: predictionBets.stake,
      shares: predictionBets.shares,
    })
    .from(predictionBets)
    .where(eq(predictionBets.marketId, marketId));

  const owed = settlePayouts(bets, winner);
  for (const [userId, amount] of owed) await creditWallet(db, userId, amount);

  // Record each bet's share of its owner's payout: the per-person total is
  // what was credited, so the remainder lands on that person's last bet.
  const lastBet = new Map(bets.map((bet) => [bet.userId, bet.id]));
  const remaining = new Map(owed);
  for (const bet of bets) {
    const paid = winner === null ? bet.stake : bet.outcomeId === winner ? Math.floor(bet.shares) : 0;
    const left = remaining.get(bet.userId) ?? 0;
    const recorded = lastBet.get(bet.userId) === bet.id ? left : Math.min(paid, left);
    remaining.set(bet.userId, left - recorded);
    await db.update(predictionBets).set({ payout: recorded }).where(eq(predictionBets.id, bet.id));
  }

  const title = claimed[0].title;
  const outcomes = readStoredArray<MarketOutcome>(claimed[0].outcomes);
  const winnerLabel = outcomes.find((outcome) => outcome.id === winner)?.label;
  const bettors = [...new Set(bets.map((bet) => bet.userId))];
  if (bettors.length > 0) {
    const now = new Date();
    await db.insert(notifications).values(
      bettors.map((userId) => {
        const amount = owed.get(userId) ?? 0;
        return {
          userId,
          type: "prediction_market",
          title: winner === null ? `Market voided: ${title}` : `Market settled: ${title}`,
          body:
            winner === null
              ? `Your ${amount} points were refunded.`
              : `${winnerLabel ?? "The result is in"}. ${amount > 0 ? `You won ${amount} points.` : "Your bet didn't pay out."}`,
          link: PREDICTIONS_LINK,
          createdAt: now,
        };
      }),
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Hosted Tabroom data (the debate-tournaments tables in the same D1)
// ---------------------------------------------------------------------------

/**
 * Raw reads over the vendored Tabroom tables. They are not in this app's
 * drizzle schema (they are `debate-tournaments`' migration), and a database
 * without them — a local one that never ran that migration — reads as "no
 * hosted data" rather than an error.
 */
async function tabroomRows<T>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  try {
    return (await db.all(query)) as T[];
  } catch (error) {
    if (/no such table/i.test(String((error as Error)?.message) + String((error as { cause?: unknown })?.cause))) return [];
    throw error;
  }
}

function entryLabel(row: { code: string | null; name: string | null; id: number }): string {
  return (row.code || row.name || `Entry ${row.id}`).trim();
}

/** Hosted events whose tournament has not been over for long. */
export async function listTabroomEvents(db: Db): Promise<TabroomEventOption[]> {
  const rows = await tabroomRows<{ id: number; event: string | null; tourn: string; start: string | null; end: string | null }>(
    db,
    sql`SELECT ev.id AS id, ev.name AS event, t.name AS tourn, t.start AS start, t."end" AS "end"
        FROM event ev JOIN tourn t ON t.id = ev.tourn
        WHERE t.hidden = 0 AND (t."end" IS NULL OR t."end" >= datetime('now', ${`-${SOURCE_EVENT_GRACE_DAYS} days`}))
        ORDER BY t.start, ev.name LIMIT 200`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    tournament: row.tourn,
    event: row.event ?? `Event ${row.id}`,
    start: row.start,
    end: row.end,
  }));
}

/** An event's entries, still in the tournament. */
export async function listEventEntries(db: Db, eventId: number): Promise<TabroomEntryOption[]> {
  const rows = await tabroomRows<{ id: number; code: string | null; name: string | null }>(
    db,
    sql`SELECT id, code, name FROM entry WHERE event = ${eventId} AND dropped = 0 ORDER BY code, name`,
  );
  return rows.map((row) => ({ id: Number(row.id), label: entryLabel({ ...row, id: Number(row.id) }) }));
}

type BallotRow = {
  panel: number;
  round_label: string | null;
  round_name: number | null;
  judge: number | null;
  entry: number | null;
  code: string | null;
  name: string | null;
  bye: number;
  forfeit: number;
  win: number | null;
};

function ballotsQuery(where: ReturnType<typeof sql>) {
  return sql`SELECT b.panel AS panel, r.label AS round_label, r.name AS round_name, b.judge AS judge, b.entry AS entry,
               e.code AS code, e.name AS name, b.bye AS bye, b.forfeit AS forfeit,
               (SELECT s.value FROM score s WHERE s.ballot = b.id AND s.tag = 'winloss' LIMIT 1) AS win
             FROM ballot b
             JOIN panel p ON p.id = b.panel
             JOIN round r ON r.id = p.round
             LEFT JOIN entry e ON e.id = b.entry
             WHERE ${where}`;
}

function toPanelBallot(row: BallotRow): PanelBallot {
  return {
    judge: row.judge === null ? null : Number(row.judge),
    entry: row.entry === null ? null : Number(row.entry),
    win: row.win === null ? null : Number(row.win) >= 1,
    bye: Boolean(Number(row.bye)),
    forfeit: Boolean(Number(row.forfeit)),
  };
}

function groupPanels(rows: BallotRow[]): TabroomPanelOption[] {
  const panels = new Map<number, { label: string; entries: Map<number, string>; ballots: PanelBallot[] }>();
  for (const row of rows) {
    const id = Number(row.panel);
    const panel = panels.get(id) ?? {
      label: row.round_label?.trim() || (row.round_name !== null ? `Round ${row.round_name}` : `Round`),
      entries: new Map<number, string>(),
      ballots: [],
    };
    if (row.entry !== null) panel.entries.set(Number(row.entry), entryLabel({ ...row, id: Number(row.entry) }));
    panel.ballots.push(toPanelBallot(row));
    panels.set(id, panel);
  }
  return [...panels.entries()]
    .filter(([, panel]) => panel.entries.size === 2 && decidePanel(panel.ballots).status === "pending")
    .map(([id, panel]) => {
      const entries = [...panel.entries.entries()].map(([entryId, label]) => ({ id: entryId, label }));
      return { id, label: `${panel.label}: ${entries.map((e) => e.label).join(" vs ")}`, entries };
    });
}

/** An event's undecided head-to-head rounds. */
export async function listOpenPanels(db: Db, eventId: number): Promise<TabroomPanelOption[]> {
  const rows = await tabroomRows<BallotRow>(db, ballotsQuery(sql`r.event = ${eventId} AND p.bye = 0`));
  return groupPanels(rows);
}

/** One hosted round's two entries, or `null` if it is not a head-to-head round. */
export async function getPanelEntries(db: Db, panelId: number): Promise<TabroomEntryOption[] | null> {
  const rows = await tabroomRows<BallotRow>(db, ballotsQuery(sql`b.panel = ${panelId}`));
  const entries = new Map<number, string>();
  for (const row of rows) if (row.entry !== null) entries.set(Number(row.entry), entryLabel({ ...row, id: Number(row.entry) }));
  return entries.size === 2 ? [...entries.entries()].map(([id, label]) => ({ id, label })) : null;
}

async function decideHostedPanel(db: Db, panelId: number): Promise<Decision> {
  const rows = await tabroomRows<BallotRow>(db, ballotsQuery(sql`b.panel = ${panelId}`));
  return decidePanel(rows.map(toPanelBallot));
}

async function decideHostedEvent(db: Db, eventId: number): Promise<Decision> {
  const rows = await tabroomRows<{ label: string | null; bracket: number; published: number; top_entry: number | null }>(
    db,
    sql`SELECT rs.label AS label, rs.bracket AS bracket, rs.published AS published,
          (SELECT r.entry FROM result r WHERE r.result_set = rs.id AND r.rank = 1 ORDER BY r.id LIMIT 1) AS top_entry
        FROM result_set rs WHERE rs.event = ${eventId}
        ORDER BY rs.generated DESC, rs.id DESC`,
  );
  const sets: EventResultSet[] = rows.map((row) => ({
    label: row.label,
    bracket: Boolean(Number(row.bracket)),
    published: Boolean(Number(row.published)),
    topEntry: row.top_entry === null ? null : Number(row.top_entry),
  }));
  return decideEvent(sets);
}

/** The outcomes of a market backed by hosted entries. */
export function entryOutcomes(entries: readonly TabroomEntryOption[]): MarketOutcome[] {
  return entries.map((entry) => ({ id: entryOutcomeId(entry.id), label: entry.label }));
}

// ---------------------------------------------------------------------------
// Auto-resolution
// ---------------------------------------------------------------------------

/** Looks a rankings entry up by dataset and hash: its current site-scale rating, or `null` if gone. */
export type RatingLookup = (dataset: string, hash: string) => Promise<number | null>;

/** What one market's rule decided, given its source. */
export async function decideMarket(
  db: Db,
  row: PredictionMarketRow,
  now: number,
  lookupRating: RatingLookup,
): Promise<Decision> {
  const source = readStoredSource(row.source);
  const closed = toWireTime(row.closesAt) <= now;
  switch (source.type) {
    case "tabroom-panel":
      return decideHostedPanel(db, source.panelId);
    case "tabroom-event":
      return decideHostedEvent(db, source.eventId);
    case "rating":
      return closed ? decideRating(source.baseline, await lookupRating(source.dataset, source.hash), true) : { status: "pending" };
    default:
      return { status: "pending" };
  }
}

/**
 * Settles every open market whose result is in, a batch at a time. A result
 * naming an entry the market does not list (an entry added after it opened)
 * voids it. Returns how many markets settled.
 */
export async function resolveDueMarkets(db: Db, now: number, lookupRating: RatingLookup): Promise<number> {
  const due = await db
    .select()
    .from(predictionMarkets)
    .where(
      and(
        eq(predictionMarkets.status, "open"),
        or(
          like(predictionMarkets.source, `{"type":"tabroom-%`),
          and(eq(predictionMarkets.kind, "rating"), lte(predictionMarkets.closesAt, new Date(now * 1000))),
        ),
      ),
    )
    .orderBy(asc(predictionMarkets.closesAt))
    .limit(RESOLVE_BATCH);

  let settled = 0;
  for (const row of due) {
    const decision = await decideMarket(db, row, now, lookupRating);
    if (decision.status === "pending") continue;
    if (decision.status === "void") {
      if (await settleMarket(db, row.id, null, decision.note)) settled += 1;
      continue;
    }
    const listed = readStoredArray<MarketOutcome>(row.outcomes).some((outcome) => outcome.id === decision.outcomeId);
    const ok = listed
      ? await settleMarket(db, row.id, decision.outcomeId, decision.note)
      : await settleMarket(db, row.id, null, "The winner wasn't one of this market's outcomes.");
    if (ok) settled += 1;
  }
  return settled;
}
