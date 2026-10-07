/**
 * @fileoverview Pins the next-season topic-area poll's shared rules: which
 * season is polled, what a ranked ballot must hold, Borda scoring, the option order, and the
 * client calls' wire shape.
 */

import { describe, it, expect, vi } from "vitest";
import { TOPIC_AREAS } from "../src/lib/topic-areas/topic-areas";
import {
  castTopicAreaVote,
  currentSeason,
  fetchTopicAreaPoll,
  nextPollSeason,
  MAX_RANKED_CHOICES,
  parseVoteBody,
  pointsForRank,
  rankPollOptions,
  seasonRangeLabel,
} from "../src/lib/topic-areas/topic-area-poll";

const OCT_2026 = new Date(Date.UTC(2026, 9, 7));
const MAY_2026 = new Date(Date.UTC(2026, 4, 1));

describe("seasons", () => {
  it("labels a season by its spring year, rolling over in July", () => {
    expect(currentSeason(OCT_2026)).toBe(2027);
    expect(currentSeason(MAY_2026)).toBe(2026);
    expect(nextPollSeason(OCT_2026)).toBe(2028);
    expect(seasonRangeLabel(2028)).toBe("2027–28");
  });
});

describe("parseVoteBody", () => {
  const [a, b, c, d, e, f] = TOPIC_AREAS.map((area) => area.name);

  it("accepts one to five distinct known areas for next season, best first", () => {
    expect(parseVoteBody({ season: 2028, ranking: [a] }, OCT_2026)).toEqual({ ok: true, season: 2028, ranking: [a] });
    expect(parseVoteBody({ season: 2028, ranking: [c, a, b, e, d] }, OCT_2026)).toEqual({
      ok: true,
      season: 2028,
      ranking: [c, a, b, e, d],
    });
  });

  it("rejects another season, an unknown area, duplicates, too many, none, or no body", () => {
    expect(parseVoteBody({ season: 2027, ranking: [a] }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody({ season: 2028, ranking: ["Underwater Basketweaving"] }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody({ season: 2028, ranking: [a, a] }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody({ season: 2028, ranking: [a, b, c, d, e, f] }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody({ season: 2028, ranking: [] }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody({ season: 2028, area: a }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody(null, OCT_2026).ok).toBe(false);
  });
});

describe("pointsForRank", () => {
  it("gives a first choice the most points, down to 1 for the last ranked choice", () => {
    expect(MAX_RANKED_CHOICES).toBe(5);
    expect([1, 2, 3, 4, 5].map(pointsForRank)).toEqual([5, 4, 3, 2, 1]);
    expect(pointsForRank(6)).toBe(0);
  });
});

describe("rankPollOptions", () => {
  it("lists every area, most points first, ties by first choices then explorer order", () => {
    const [a, b, c, d] = TOPIC_AREAS;
    const ranked = rankPollOptions({ [c!.name]: 5, [b!.name]: 1, [d!.name]: 5 }, { [d!.name]: 1 });
    expect(ranked).toHaveLength(TOPIC_AREAS.length);
    expect(ranked.slice(0, 4).map((o) => o.name)).toEqual([d!.name, c!.name, b!.name, a!.name]);
    expect(ranked[3]!.points).toBe(0);
  });
});

describe("client", () => {
  const body = { season: 2028, points: {}, firstChoices: {}, total: 0, myRanking: [], signedIn: false };

  it("reads the tally for a season", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body)));
    await expect(fetchTopicAreaPoll(2028, fetchImpl as unknown as typeof fetch)).resolves.toEqual(body);
    expect(fetchImpl).toHaveBeenCalledWith("/api/topic-area-poll?season=2028", expect.anything());
  });

  it("PUTs a vote and surfaces the server's error", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to vote." }), { status: 401 }));
    await expect(castTopicAreaVote(2028, ["x", "y"], fetchImpl as unknown as typeof fetch)).rejects.toThrow("Sign in to vote.");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ season: 2028, ranking: ["x", "y"] });
  });
});
