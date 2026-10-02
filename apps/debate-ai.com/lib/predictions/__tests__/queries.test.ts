/**
 * @fileoverview The prediction-market queries, run against a real SQLite
 * database built from the app schema plus `debate-tournaments`' Tabroom
 * tables and demo seed — the data hosted markets settle from.
 *
 * The pricing and settlement rules are tested as pure functions in
 * `debate-predictions`; this covers what only a database can show: the
 * guarded writes (an overdraft, a stale price, a double settlement), the
 * wallet arithmetic end to end, and the raw Tabroom reads.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RATING_OUTCOMES, STARTING_BALANCE, manualOutcomes } from "debate-predictions";

import {
  BetRefused,
  ensureWallet,
  entryOutcomes,
  getMarket,
  getMarketRow,
  getPanelEntries,
  insertMarket,
  listEventEntries,
  listLeaders,
  listMarkets,
  listOpenPanels,
  listTabroomEvents,
  placeBet,
  resolveDueMarkets,
  settleMarket,
} from "@/lib/predictions/queries";
import * as schema from "@/lib/database/schema";
import { notifications, predictionBets, predictionMarkets, predictionWallets } from "@/lib/database/schema";
import { applySchema, schemaStatements } from "@/lib/database/__tests__/schema-sql";
import { splitStatements } from "@/lib/database/migration-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const TABROOM = join(REPO_ROOT, "packages/debate-tournaments");
const PREDICTIONS_MIGRATION = join(REPO_ROOT, "packages/debate-predictions/migrations/0001_prediction_markets.sql");

let directory: string;
let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;
// The queries take the app's D1-or-libSQL union; the libSQL half is what runs here.
const q = () => db as never;

const NOW = Math.floor(Date.now() / 1000);
const DAY = 24 * 60 * 60;

async function addUser(id: string, name: string): Promise<void> {
  await client.execute({
    sql: "INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, unixepoch(), unixepoch())",
    args: [id, name, `${id}@example.test`],
  });
}

async function openManual(id: string, creatorId = "ana", labels = ["Aff", "Neg"], closesAt = NOW + DAY) {
  await insertMarket(q(), {
    id,
    creatorId,
    kind: "debate",
    title: `Market ${id}`,
    description: "",
    outcomes: manualOutcomes(labels),
    source: { type: "manual" },
    closesAt,
  });
  return (await getMarketRow(q(), id))!;
}

async function balance(userId: string): Promise<number> {
  return (await ensureWallet(q(), userId)).balance;
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "prediction-queries-"));
  client = createClient({ url: `file:${join(directory, "db.sqlite")}` });
  db = drizzle(client, { schema });
  await applySchema(client);
  await client.executeMultiple(readFileSync(join(TABROOM, "migrations/0001_tabroom_schema.sql"), "utf8"));
  await client.executeMultiple(readFileSync(join(TABROOM, "seed/demo.sql"), "utf8"));
});

afterAll(() => {
  client.close();
  rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.delete(notifications);
  await db.delete(predictionBets);
  await db.delete(predictionMarkets);
  await db.delete(predictionWallets);
  await client.execute("DELETE FROM user");
  await addUser("ana", "Ana Ruiz");
  await addUser("ben", "Ben Okafor");
  await addUser("cy", "Cy Lee");
});

describe("the migration shipped in debate-predictions", () => {
  it("creates exactly what schema.ts declares for the prediction tables", async () => {
    const fromSchema = (await schemaStatements())
      .filter((statement) => statement.includes("`prediction_"))
      .map((statement) => statement.replace(/^CREATE (TABLE|INDEX) /, "CREATE $1 IF NOT EXISTS ").trim().replace(/;$/, ""));
    const shipped = splitStatements(readFileSync(PREDICTIONS_MIGRATION, "utf8"));
    expect(shipped).toEqual(fromSchema);
  });
});

describe("wallets", () => {
  it("grants the starting balance once", async () => {
    expect(await ensureWallet(q(), "ana")).toMatchObject({ balance: STARTING_BALANCE });
    await db.update(predictionWallets).set({ balance: 10 }).where(eq(predictionWallets.userId, "ana"));
    expect(await balance("ana")).toBe(10);
  });

  it("ranks the leaders by balance", async () => {
    await ensureWallet(q(), "ana");
    await ensureWallet(q(), "ben");
    await db.update(predictionWallets).set({ balance: 1500 }).where(eq(predictionWallets.userId, "ben"));
    expect((await listLeaders(q())).map((leader) => [leader.id, leader.balance])).toEqual([
      ["ben", 1500],
      ["ana", 1000],
    ]);
  });
});

describe("placeBet", () => {
  it("debits the stake, records the shares and moves the price", async () => {
    const market = await openManual("m1");
    await ensureWallet(q(), "ben");
    const shares = await placeBet(q(), { market, userId: "ben", outcomeId: "o1", stake: 100, now: NOW });

    expect(shares).toBeGreaterThan(100);
    expect(await balance("ben")).toBe(STARTING_BALANCE - 100);
    const view = (await getMarket(q(), "m1", { id: "ben", isStaff: false }))!;
    expect(view.volume).toBe(100);
    expect(view.outcomes[0].price).toBeGreaterThan(0.5);
    expect(view.positions).toEqual([{ outcomeId: "o1", shares, staked: 100 }]);
    // Holding a position takes away the creator-style right to settle; ben isn't the creator anyway.
    expect(view.canResolve).toBe(false);
  });

  it("refuses an overdraft without touching the market", async () => {
    const market = await openManual("m1");
    await ensureWallet(q(), "ben");
    await expect(placeBet(q(), { market, userId: "ben", outcomeId: "o1", stake: 5000, now: NOW })).rejects.toBeInstanceOf(BetRefused);
    expect((await getMarketRow(q(), "m1"))!.version).toBe(0);
  });

  it("refunds a bet priced off a share vector another bet already moved", async () => {
    const stale = await openManual("m1");
    await ensureWallet(q(), "ben");
    await ensureWallet(q(), "cy");
    await placeBet(q(), { market: stale, userId: "ben", outcomeId: "o1", stake: 100, now: NOW });

    await expect(placeBet(q(), { market: stale, userId: "cy", outcomeId: "o2", stake: 100, now: NOW })).rejects.toThrow(/odds moved/);
    expect(await balance("cy")).toBe(STARTING_BALANCE);
    expect(await db.select().from(predictionBets).where(eq(predictionBets.userId, "cy"))).toEqual([]);
  });

  it("refuses bets once betting has closed", async () => {
    const market = await openManual("m1");
    await ensureWallet(q(), "ben");
    await expect(placeBet(q(), { market, userId: "ben", outcomeId: "o1", stake: 10, now: NOW + 2 * DAY })).rejects.toThrow(/closed/);
  });
});

describe("settleMarket", () => {
  it("pays winners a point a share, records each bet's payout and notifies every bettor", async () => {
    const market = await openManual("m1");
    await ensureWallet(q(), "ben");
    await ensureWallet(q(), "cy");
    const benShares = await placeBet(q(), { market, userId: "ben", outcomeId: "o1", stake: 200, now: NOW });
    const moved = (await getMarketRow(q(), "m1"))!;
    await placeBet(q(), { market: moved, userId: "cy", outcomeId: "o2", stake: 300, now: NOW });

    expect(await settleMarket(q(), "m1", "o1", "Aff won 3-0.")).toBe(true);
    expect(await balance("ben")).toBe(STARTING_BALANCE - 200 + Math.floor(benShares));
    expect(await balance("cy")).toBe(STARTING_BALANCE - 300);

    const benView = (await getMarket(q(), "m1", { id: "ben", isStaff: false }))!;
    expect(benView).toMatchObject({ status: "resolved", resolvedOutcome: "o1", payout: Math.floor(benShares), resolutionNote: "Aff won 3-0." });
    expect((await getMarket(q(), "m1", { id: "cy", isStaff: false }))!.payout).toBe(0);
    const sent = await db.select().from(notifications);
    expect(sent.map((row) => row.userId).sort()).toEqual(["ben", "cy"]);
    expect(sent.find((row) => row.userId === "ben")!.body).toContain(`You won ${Math.floor(benShares)} points.`);
  });

  it("settles once, however many times it is asked", async () => {
    const market = await openManual("m1");
    await ensureWallet(q(), "ben");
    await placeBet(q(), { market, userId: "ben", outcomeId: "o1", stake: 50, now: NOW });
    expect(await settleMarket(q(), "m1", "o1", "")).toBe(true);
    const after = await balance("ben");
    expect(await settleMarket(q(), "m1", "o1", "")).toBe(false);
    expect(await settleMarket(q(), "m1", null, "")).toBe(false);
    expect(await balance("ben")).toBe(after);
  });

  it("refunds every stake when voided", async () => {
    const market = await openManual("m1");
    await ensureWallet(q(), "ben");
    await placeBet(q(), { market, userId: "ben", outcomeId: "o2", stake: 75, now: NOW });
    await settleMarket(q(), "m1", null, "Round cancelled.");
    expect(await balance("ben")).toBe(STARTING_BALANCE);
    expect((await getMarketRow(q(), "m1"))!.status).toBe("void");
  });
});

describe("canResolve on the board", () => {
  it("lets the creator settle their own manual market until they bet on it", async () => {
    const market = await openManual("m1", "ana");
    expect((await listMarkets(q(), { id: "ana", isStaff: false }))[0].canResolve).toBe(true);
    await ensureWallet(q(), "ana");
    await placeBet(q(), { market, userId: "ana", outcomeId: "o1", stake: 10, now: NOW });
    expect((await listMarkets(q(), { id: "ana", isStaff: false }))[0].canResolve).toBe(false);
    expect((await listMarkets(q(), { id: "ben", isStaff: true }))[0].canResolve).toBe(true);
  });
});

describe("hosted Tabroom data", () => {
  it("lists the demo events, their entries and a round's two entries", async () => {
    const events = await listTabroomEvents(q());
    expect(events.map((event) => event.id)).toContain(90001);
    const entries = await listEventEntries(q(), 90001);
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(await getPanelEntries(q(), 90001)).toEqual([
      { id: 90001, label: "LO MC" },
      { id: 90002, label: "PA JP" },
    ]);
  });

  it("offers only undecided rounds", async () => {
    expect(await listOpenPanels(q(), 90001)).toEqual([]);
    // An unscored round 3 pairing between the first two entries.
    await client.executeMultiple(`
      INSERT OR REPLACE INTO panel (id, letter, flight, bye, bracket, publish, room, round) VALUES (99001, '9', 1, 0, 0, 1, 90001, 90004);
      INSERT OR REPLACE INTO ballot (id, side, speakerorder, chair, bye, forfeit, audit, judge, panel, entry) VALUES
        (99001, 1, 1, 0, 0, 0, 0, 90001, 99001, 90001),
        (99002, 2, 2, 0, 0, 0, 0, 90001, 99001, 90002);
    `);
    const open = await listOpenPanels(q(), 90001);
    expect(open).toEqual([{ id: 99001, label: "Round 3: LO MC vs PA JP", entries: [{ id: 90001, label: "LO MC" }, { id: 90002, label: "PA JP" }] }]);
    await client.executeMultiple("DELETE FROM ballot WHERE panel = 99001; DELETE FROM panel WHERE id = 99001;");
  });
});

describe("resolveDueMarkets", () => {
  const noRatings = async () => null;

  it("settles a market on a hosted round from its ballots, even before betting closes", async () => {
    const entries = (await getPanelEntries(q(), 90001))!;
    await insertMarket(q(), {
      id: "hosted",
      creatorId: "ana",
      kind: "debate",
      title: "Chen v Patel",
      description: "",
      outcomes: entryOutcomes(entries),
      source: { type: "tabroom-panel", panelId: 90001 },
      closesAt: NOW + DAY,
    });
    await ensureWallet(q(), "ben");
    const shares = await placeBet(q(), { market: (await getMarketRow(q(), "hosted"))!, userId: "ben", outcomeId: "entry:90001", stake: 100, now: NOW });

    expect(await resolveDueMarkets(q(), NOW, noRatings)).toBe(1);
    expect((await getMarketRow(q(), "hosted"))!).toMatchObject({ status: "resolved", resolvedOutcome: "entry:90001" });
    expect(await balance("ben")).toBe(STARTING_BALANCE - 100 + Math.floor(shares));
  });

  it("leaves a hosted event without final results open", async () => {
    await insertMarket(q(), {
      id: "event",
      creatorId: "ana",
      kind: "tournament",
      title: "Who wins VLD?",
      description: "",
      outcomes: entryOutcomes(await listEventEntries(q(), 90001)),
      source: { type: "tabroom-event", eventId: 90001 },
      closesAt: NOW + DAY,
    });
    // The demo event only publishes prelim seeds.
    expect(await resolveDueMarkets(q(), NOW, noRatings)).toBe(0);
    expect((await getMarketRow(q(), "event"))!.status).toBe("open");
  });

  it("settles a rating market once it closes, against the rating it opened at", async () => {
    const source = { type: "rating", dataset: "hspf", hash: "abc0123456789def", name: "Falk & Sabnani", school: "College Prep", baseline: 80 } as const;
    await insertMarket(q(), {
      id: "rating",
      creatorId: "ana",
      kind: "rating",
      title: "Will Falk & Sabnani gain rating?",
      description: "",
      outcomes: [...RATING_OUTCOMES],
      source,
      closesAt: NOW + DAY,
    });
    const lookup = async () => 85;
    expect(await resolveDueMarkets(q(), NOW, lookup)).toBe(0);
    expect(await resolveDueMarkets(q(), NOW + 2 * DAY, lookup)).toBe(1);
    expect((await getMarketRow(q(), "rating"))!).toMatchObject({ status: "resolved", resolvedOutcome: "yes" });
  });

  it("never touches manual markets", async () => {
    await openManual("m1", "ana", ["A", "B"], NOW + 600);
    expect(await resolveDueMarkets(q(), NOW + 2 * DAY, noRatings)).toBe(0);
  });
});
