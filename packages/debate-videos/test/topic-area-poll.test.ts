/**
 * @fileoverview Pins the next-season topic-area poll's shared rules: which
 * season is polled, what a vote body must hold, the option order, and the
 * client calls' wire shape.
 */

import { describe, it, expect, vi } from "vitest";
import { TOPIC_AREAS } from "../src/lib/topic-areas/topic-areas";
import {
  castTopicAreaVote,
  currentSeason,
  fetchTopicAreaPoll,
  nextPollSeason,
  parseVoteBody,
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
  const area = TOPIC_AREAS[0]!.name;

  it("accepts a known area for next season", () => {
    expect(parseVoteBody({ season: 2028, area }, OCT_2026)).toEqual({ ok: true, season: 2028, area });
  });

  it("rejects another season, an unknown area, or no body", () => {
    expect(parseVoteBody({ season: 2027, area }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody({ season: 2028, area: "Underwater Basketweaving" }, OCT_2026).ok).toBe(false);
    expect(parseVoteBody(null, OCT_2026).ok).toBe(false);
  });
});

describe("rankPollOptions", () => {
  it("lists every area, most votes first, ties in explorer order", () => {
    const [a, b, c] = TOPIC_AREAS;
    const ranked = rankPollOptions({ [c!.name]: 3, [b!.name]: 1 });
    expect(ranked).toHaveLength(TOPIC_AREAS.length);
    expect(ranked.slice(0, 3).map((o) => o.name)).toEqual([c!.name, b!.name, a!.name]);
    expect(ranked[2]!.count).toBe(0);
  });
});

describe("client", () => {
  const body = { season: 2028, counts: {}, total: 0, myVote: null, signedIn: false };

  it("reads the tally for a season", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body)));
    await expect(fetchTopicAreaPoll(2028, fetchImpl as unknown as typeof fetch)).resolves.toEqual(body);
    expect(fetchImpl).toHaveBeenCalledWith("/api/topic-area-poll?season=2028", expect.anything());
  });

  it("PUTs a vote and surfaces the server's error", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to vote." }), { status: 401 }));
    await expect(castTopicAreaVote(2028, "x", fetchImpl as unknown as typeof fetch)).rejects.toThrow("Sign in to vote.");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ season: 2028, area: "x" });
  });
});
