import { describe, expect, it } from "vitest";
import { marketsRelatedToTeam, teamOutcomeIdPrefix } from "../src/related-markets";
import type { PredictionMarket } from "../src/types";

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const market = (over: Partial<PredictionMarket> = {}): PredictionMarket => ({
  id: "m1",
  title: "Test market",
  kind: "debate",
  status: "open",
  closesAt: 100,
  description: "",
  createdAt: 0,
  creator: null,
  resolvedAt: null,
  preset: null,
  volume: 0,
  liquidity: 100,
  outcomes: [{ id: "o1", label: "Aff", price: 0.5, shares: 0 }],
  positions: [],
  canResolve: false,
  resolvedOutcome: null,
  payout: null,
  resolutionNote: null,
  source: { type: "manual" },
  ...over,
});

describe("teamOutcomeIdPrefix", () => {
  it("uses the first 16 hex chars lowercased", () => {
    expect(teamOutcomeIdPrefix(HASH_A)).toBe("team:aaaaaaaaaaaaaaaa");
    expect(teamOutcomeIdPrefix("ABCD" + "0".repeat(60))).toBe("team:abcd000000000000");
  });
});

describe("marketsRelatedToTeam", () => {
  const ratingA = market({
    id: "rating-a",
    kind: "rating",
    title: "A rating up?",
    source: {
      type: "rating",
      dataset: "hspf",
      hash: HASH_A,
      name: "A",
      school: "School A",
      baseline: 2000,
    },
    closesAt: 50,
  });
  const ratingC = market({
    id: "rating-c",
    kind: "rating",
    title: "C rating up?",
    source: {
      type: "rating",
      dataset: "hspf",
      hash: HASH_C,
      name: "C",
      school: "School C",
      baseline: 1900,
    },
  });
  const tournamentOpen = market({
    id: "toc-open",
    kind: "tournament",
    title: "TOC open",
    status: "open",
    closesAt: 200,
    outcomes: [
      { id: teamOutcomeIdPrefix(HASH_A), label: "Team A", price: 0.4, shares: 0 },
      { id: "field", label: "Anyone else", price: 0.6, shares: 0 },
    ],
  });
  const tournamentResolved = market({
    id: "ndt-done",
    kind: "tournament",
    title: "NDT done",
    status: "resolved",
    closesAt: 10,
    outcomes: [
      { id: teamOutcomeIdPrefix(HASH_B), label: "Team B", price: 0.3, shares: 0 },
      { id: "field", label: "Anyone else", price: 0.7, shares: 0 },
    ],
    resolvedOutcome: "field",
  });
  const unrelated = market({ id: "other", title: "Unrelated" });

  it("returns nothing without hashes", () => {
    expect(marketsRelatedToTeam([ratingA, tournamentOpen], [])).toEqual([]);
  });

  it("matches rating markets by hash and tournament outcomes by prefix", () => {
    const related = marketsRelatedToTeam(
      [unrelated, ratingC, tournamentResolved, tournamentOpen, ratingA],
      [HASH_A, HASH_B],
    );
    expect(related.map((item) => item.market.id)).toEqual(["rating-a", "toc-open", "ndt-done"]);
    expect(related.map((item) => item.relation)).toEqual(["rating", "tournament", "tournament"]);
  });

  it("ignores case on hashes", () => {
    const related = marketsRelatedToTeam([ratingA], [HASH_A.toUpperCase()]);
    expect(related).toHaveLength(1);
    expect(related[0]?.relation).toBe("rating");
  });
});
