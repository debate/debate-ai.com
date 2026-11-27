/**
 * @fileoverview The prediction-market write routes (`POST /api/predictions/markets`,
 * `.../[marketId]/bets` and `.../[marketId]/resolve`) against a real SQLite
 * database: who may open, bet on and settle a market, and what each refusal says.
 */

import { NextRequest } from "next/server";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_OPEN_MARKETS_PER_CREATOR, STARTING_BALANCE } from "@debate-ai/predictions";

import * as schema from "@/lib/database/schema";
import { freshSchemaClient } from "@/lib/database/__tests__/schema-sql";

let db: ReturnType<typeof drizzle<typeof schema>>;
let signedInAs: string | null = "alex";
let staff = false;
let ratedTeam: { dataset: string; hash: string; name: string; school: string; rating: number } | null = null;

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => db }));
vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }));
vi.mock("@/lib/auth/admin", () => ({ getStaffAccess: async () => ({ canEditContent: staff }) }));
vi.mock("@debate-ai/webview/lib/predictions/ratings", () => ({ findRatedTeam: async () => ratedTeam }));

const markets = await import("@/app/api/predictions/markets/route");
const bets = await import("@/app/api/predictions/markets/[marketId]/bets/route");
const resolve = await import("@/app/api/predictions/markets/[marketId]/resolve/route");

const url = "https://debate-ai.com/api/predictions/markets";
const json = (body: unknown) => (typeof body === "string" ? body : JSON.stringify(body));
const open = (body: unknown) => markets.POST(new NextRequest(url, { method: "POST", body: json(body) }));
const ctx = (marketId: string) => ({ params: Promise.resolve({ marketId }) });
const bet = (marketId: string, body: unknown) =>
  bets.POST(new NextRequest(`${url}/${marketId}/bets`, { method: "POST", body: json(body) }), ctx(marketId));
const settle = (marketId: string, body: unknown) =>
  resolve.POST(new NextRequest(`${url}/${marketId}/resolve`, { method: "POST", body: json(body) }), ctx(marketId));

const closesAt = () => Math.floor(Date.now() / 1000) + 3600;
const debate = (overrides: Record<string, unknown> = {}) => ({
  kind: "debate",
  title: "Who wins the final?",
  outcomes: ["Affirmative", "Negative"],
  closesAt: closesAt(),
  ...overrides,
});

async function openMarket(overrides: Record<string, unknown> = {}) {
  const res = await open(debate(overrides));
  expect(res.status).toBe(201);
  return res.json();
}

describe("prediction market routes", () => {
  beforeEach(async () => {
    signedInAs = "alex";
    staff = false;
    ratedTeam = null;
    db = drizzle(await freshSchemaClient(), { schema });
    const now = new Date();
    await db.insert(schema.user).values([
      ...["alex", "sam", "mod"].map((id) => ({ id, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now })),
      { id: "guest", name: "guest", email: "guest@example.com", isAnonymous: true, createdAt: now, updatedAt: now },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("POST /api/predictions/markets", () => {
    it("requires a signed-in, non-anonymous account", async () => {
      signedInAs = null;
      expect((await open(debate())).status).toBe(401);
      signedInAs = "ghost";
      expect((await open(debate())).status).toBe(401);
      signedInAs = "guest";
      expect((await open(debate())).status).toBe(403);
    });

    it("rejects malformed and invalid requests", async () => {
      expect((await open("{nope")).status).toBe(400);
      expect(await (await open({ kind: "nonsense" })).json()).toEqual({ error: "Pick a market type: debate, tournament or rating." });
      expect((await open(debate({ title: "x" }))).status).toBe(400);
      expect((await open(debate({ outcomes: ["Only one", "Only one"] }))).status).toBe(400);
      expect((await open(debate({ closesAt: Math.floor(Date.now() / 1000) + 5 }))).status).toBe(400);
    });

    it("opens a manual market with equally priced outcomes and returns it", async () => {
      const market = await openMarket();
      expect(market).toMatchObject({ kind: "debate", title: "Who wins the final?", status: "open" });
      expect(market.outcomes.map((o: { id: string; label: string }) => [o.id, o.label])).toEqual([
        ["o1", "Affirmative"],
        ["o2", "Negative"],
      ]);
      const [row] = await db.select().from(schema.predictionMarkets);
      expect(row).toMatchObject({ creatorId: "alex", status: "open" });
    });

    it("caps how many markets one account can hold open", async () => {
      for (let i = 0; i < MAX_OPEN_MARKETS_PER_CREATOR; i++) await openMarket({ title: `Market ${i}` });
      const res = await open(debate({ title: "One too many" }));
      expect(res.status).toBe(429);
      expect((await res.json()).error).toContain(String(MAX_OPEN_MARKETS_PER_CREATOR));

      signedInAs = "sam";
      expect((await open(debate())).status).toBe(201);
    });

    it("opens a rating market for a ranked team, and 404s for an unknown one", async () => {
      const rating = { dataset: "hsld", hash: "a".repeat(32) };
      const body = { kind: "rating", title: "Will they stay on top?", closesAt: closesAt(), rating };

      expect((await open(body)).status).toBe(404);

      ratedTeam = { dataset: "hsld", hash: rating.hash, name: "Lincoln AB", school: "Lincoln", rating: 1650 };
      const market = await (await open(body)).json();
      expect(market.kind).toBe("rating");
      const [row] = await db.select().from(schema.predictionMarkets).where(eq(schema.predictionMarkets.id, market.id));
      expect(JSON.parse(row.source)).toMatchObject({ type: "rating", name: "Lincoln AB", baseline: 1650 });
    });
  });

  describe("POST .../bets", () => {
    it("requires a signed-in, non-anonymous account and an existing market", async () => {
      const { id } = await openMarket();
      signedInAs = null;
      expect((await bet(id, { outcomeId: "o1", stake: 10 })).status).toBe(401);
      signedInAs = "ghost";
      expect((await bet(id, { outcomeId: "o1", stake: 10 })).status).toBe(401);
      signedInAs = "guest";
      expect((await bet(id, { outcomeId: "o1", stake: 10 })).status).toBe(403);
      signedInAs = "sam";
      expect((await bet("missing", { outcomeId: "o1", stake: 10 })).status).toBe(404);
      expect((await bet(id, "{nope")).status).toBe(400);
    });

    it("validates the outcome and stake against the market and wallet", async () => {
      const { id } = await openMarket();
      signedInAs = "sam";
      expect((await bet(id, { outcomeId: "o9", stake: 10 })).status).toBe(400);
      expect((await bet(id, { outcomeId: "o1", stake: 1.5 })).status).toBe(400);
      const tooMuch = await bet(id, { outcomeId: "o1", stake: STARTING_BALANCE + 1 });
      expect(tooMuch.status).toBe(400);
      expect(await tooMuch.json()).toEqual({ error: `You only have ${STARTING_BALANCE} points.` });
    });

    it("buys shares, debits the wallet and moves the price", async () => {
      const market = await openMarket();
      signedInAs = "sam";
      const res = await bet(market.id, { outcomeId: "o1", stake: 100 });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.shares).toBeGreaterThan(0);
      expect(body.wallet.balance).toBe(STARTING_BALANCE - 100);
      expect(body.market.id).toBe(market.id);
      expect(body.market.outcomes[0].price).toBeGreaterThan(body.market.outcomes[1].price);
      expect(await db.select().from(schema.predictionBets)).toHaveLength(1);
    });

    it("refuses a bet on a market whose betting has closed", async () => {
      const market = await openMarket();
      await db.update(schema.predictionMarkets).set({ closesAt: new Date(Date.now() - 60_000) });
      signedInAs = "sam";
      const res = await bet(market.id, { outcomeId: "o1", stake: 10 });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "Betting on this market has closed." });
    });
  });

  describe("POST .../resolve", () => {
    it("requires a session, a body and an existing market", async () => {
      const { id } = await openMarket();
      signedInAs = null;
      expect((await settle(id, { outcomeId: "o1" })).status).toBe(401);
      signedInAs = "alex";
      expect((await settle(id, "{nope")).status).toBe(400);
      expect((await settle("missing", { outcomeId: "o1" })).status).toBe(404);
    });

    it("lets the creator settle while they hold no position, but not a stranger", async () => {
      const { id } = await openMarket();
      signedInAs = "sam";
      const refused = await settle(id, { outcomeId: "o1" });
      expect(refused.status).toBe(403);
      expect((await refused.json()).error).toContain("Only a moderator");

      signedInAs = "alex";
      expect((await settle(id, { outcomeId: "nope" })).status).toBe(400);
      const settled = await (await settle(id, { outcomeId: "o2", note: "Neg took it" })).json();
      expect(settled).toMatchObject({ status: "resolved" });
      const [row] = await db.select().from(schema.predictionMarkets);
      expect(row).toMatchObject({ resolvedOutcome: "o2", resolutionNote: "Neg took it" });
    });

    it("pays out winners when settled and refuses a second settlement", async () => {
      const { id } = await openMarket();
      signedInAs = "sam";
      await bet(id, { outcomeId: "o1", stake: 100 });

      signedInAs = "alex";
      await bet(id, { outcomeId: "o2", stake: 50 });
      const biased = await settle(id, { outcomeId: "o2" });
      expect(biased.status).toBe(403);

      signedInAs = "mod";
      staff = true;
      expect((await settle(id, { outcomeId: "o1" })).status).toBe(200);
      const again = await settle(id, { outcomeId: "o1" });
      expect(again.status).toBe(403);
      expect((await again.json()).error).toBe("This market has already settled.");

      const [wallet] = await db.select().from(schema.predictionWallets).where(eq(schema.predictionWallets.userId, "sam"));
      expect(wallet.balance).toBeGreaterThan(STARTING_BALANCE - 100);
    });

    it("lets staff void a market, with a default note", async () => {
      const { id } = await openMarket();
      signedInAs = "mod";
      staff = true;
      expect((await settle(id, {})).status).toBe(200);
      const [row] = await db.select().from(schema.predictionMarkets);
      expect(row.resolvedOutcome).toBeNull();
      expect(row.resolutionNote).toBe("Voided by hand.");
    });
  });
});
