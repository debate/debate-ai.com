import { describe, expect, it, vi } from "vitest";
import {
  TabroomAuthRequiredError,
  collectChampionshipRounds,
  parseRoundResults,
  pickChampionshipEvents,
  syncChampionshipSideBias,
  type TabroomEventInfo,
} from "../../src/sync/championship-side-bias-sync";

const entry = (side: number, ...ballots: ("W" | "L")[]) => ({
  side,
  Ballots: Object.fromEntries(ballots.map((winloss, i) => [String(i + 1), { winloss }])),
});

const section = (aff: ReturnType<typeof entry>, neg: ReturnType<typeof entry>, judges = 1, extra = {}) => ({
  Judges: Object.fromEntries(Array.from({ length: judges }, (_, i) => [String(i + 1), {}])),
  Entries: { a: aff, b: neg },
  ...extra,
});

describe("parseRoundResults", () => {
  it("takes the side with the majority of ballots", () => {
    const rounds = parseRoundResults(
      {
        Sections: {
          s1: section(entry(1, "W"), entry(2, "L")),
          s2: section(entry(1, "L", "L", "W"), entry(2, "W", "W", "L"), 3),
        },
      },
      true,
    );
    expect(rounds).toEqual([
      { winner: "aff", elim: true },
      { winner: "neg", elim: true },
    ]);
  });

  it("skips byes, missing ballots, ties and same-side pairings", () => {
    const rounds = parseRoundResults(
      {
        Sections: {
          bye: section(entry(1, "W"), entry(2, "L"), 1, { bye: 1 }),
          missing: section(entry(1), entry(2)),
          tie: section(entry(1, "W", "L"), entry(2, "L", "W"), 2),
          sameSide: section(entry(1, "W"), entry(1, "L")),
          partial: { Judges: { 1: {}, 2: {} }, Entries: { a: entry(1, "W"), b: entry(2, "L") } },
        },
      },
      false,
    );
    expect(rounds).toEqual([]);
  });

  it("reads string sides", () => {
    const aff = { side: "1" as unknown as number, Ballots: { 1: { winloss: "L" as const } } };
    const neg = { side: "2" as unknown as number, Ballots: { 1: { winloss: "W" as const } } };
    expect(parseRoundResults({ Sections: { s: section(aff, neg) } }, false)).toEqual([{ winner: "neg", elim: false }]);
  });
});

describe("pickChampionshipEvents", () => {
  const events: TabroomEventInfo[] = [
    { id: 1, name: "Lincoln-Douglas", abbr: "LD", type: "debate" },
    { id: 2, name: "Policy Debate", abbr: "CX", type: "debate" },
    { id: 3, name: "Public Forum Gold", abbr: "PF-G", type: "debate" },
    { id: 4, name: "Public Forum Silver (Online)", abbr: "PF-S", type: "debate" },
    { id: 5, name: "Congressional Debate", abbr: "CD", type: "congress" },
    { id: 6, name: "Open", abbr: "Open", type: "debate" },
  ];

  it("picks the top-division event of each high school format", () => {
    expect(pickChampionshipEvents("pf", events).map((e) => e.id)).toEqual([3]);
    expect(pickChampionshipEvents("ld", events).map((e) => e.id)).toEqual([1]);
    expect(pickChampionshipEvents("policy", events).map((e) => e.id)).toEqual([2]);
  });

  it("takes every debate event for college", () => {
    expect(pickChampionshipEvents("college", [events[5], events[4]]).map((e) => e.id)).toEqual([6]);
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeTabroom(authed: boolean) {
  return vi.fn(async (input: string) => {
    const path = input.replace("https://api.tabroom.com/v1", "");
    if (path.endsWith("/invite")) return json({ Events: [{ id: 9, name: "Public Forum Gold", abbr: "PF-G", type: "debate" }] });
    if (!authed) return json({ detail: "User not Authenticated" }, 401);
    if (path.endsWith("/rounds")) {
      return json([
        { id: 1, type: "prelim", name: 1, Event: { id: 9, abbr: "PF-G" } },
        { id: 2, type: "final", name: 2, Event: { id: 9, abbr: "PF-G" } },
        { id: 3, type: "prelim", name: 1, Event: { id: 10, abbr: "LD" } },
      ]);
    }
    if (path.endsWith("/PF-G/1/results")) return json({ Sections: { s: section(entry(1, "W"), entry(2, "L")) } });
    if (path.endsWith("/PF-G/2/results")) return json({ Sections: { s: section(entry(1, "L"), entry(2, "W")) } });
    return json({}, 404);
  });
}

describe("collectChampionshipRounds", () => {
  it("reads each round of the format's event and marks elims", async () => {
    const fetcher = fakeTabroom(true);
    const rounds = await collectChampionshipRounds(fetcher, 36156, "pf");
    expect(rounds).toEqual([
      { winner: "aff", elim: false },
      { winner: "neg", elim: true },
    ]);
    expect(fetcher.mock.calls.map((c) => c[0])).not.toContain(expect.stringContaining("/LD/"));
  });

  it("throws an auth error rather than reading 401 as an empty season", async () => {
    await expect(collectChampionshipRounds(fakeTabroom(false), 36156, "pf")).rejects.toBeInstanceOf(TabroomAuthRequiredError);
  });
});

describe("syncChampionshipSideBias", () => {
  it("merges synced seasons into the existing rows, skipping unregistered seasons", async () => {
    const progress: string[] = [];
    const result = await syncChampionshipSideBias({
      fetcher: fakeTabroom(true),
      formats: ["pf"],
      years: [2016, 2026],
      existing: {
        generatedAt: null,
        records: [{ format: "ld", year: 2025, tabroomId: 34644, rounds: 10, affWins: 5, elimRounds: 2, elimAffWins: 1 }],
      },
      now: () => new Date("2026-06-01T00:00:00Z"),
      onProgress: (m) => progress.push(m),
    });
    expect(result.generatedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(result.records.map((r) => `${r.format}${r.year}`)).toEqual(["ld2025", "pf2026"]);
    expect(result.records[1]).toMatchObject({ tabroomId: 36156, rounds: 2, affWins: 1, elimRounds: 1, elimAffWins: 0 });
    expect(progress[0]).toContain("no championship registered");
  });

  it("propagates an auth failure and writes nothing", async () => {
    await expect(
      syncChampionshipSideBias({ fetcher: fakeTabroom(false), formats: ["pf"], years: [2026] }),
    ).rejects.toBeInstanceOf(TabroomAuthRequiredError);
  });
});
