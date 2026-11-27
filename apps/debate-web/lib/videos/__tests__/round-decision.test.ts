/**
 * @fileoverview `resolveRoundDecision`: a round's overall decision and its
 * judges' votes from what the library stores, else a live College Debate
 * Results / Tabroom lookup, else unknown — with the 2026 Shirley fixture and
 * a stubbed Tabroom TOC final.
 */
import { describe, expect, it, vi } from "vitest";
import { COLLEGE_RESULTS_API } from "@debate-ai/videos-admin/src/lib/college-results";
import { TABROOM_API } from "@debate-ai/videos-admin/src/lib/hs-results";
import shirley from "../../../../../packages/debate-videos-admin/test/fixtures/college-results-shirley-2026.json";
import {
  liveDecisionLookup,
  resolveRoundDecision,
  resultsSourceFor,
  type DecisionLookup,
  type RoundDecisionRow,
} from "../round-decision";

const ballots = (votes: Record<string, string>) =>
  Object.fromEntries(Object.entries(votes).map(([judge, winloss]) => [judge, { winloss }]));

const TABROOM: Record<string, unknown> = {
  "/rest/tourns/34644/invite": { id: 34644, Events: [{ id: 1, abbr: "CX", name: "Policy Debate", type: "debate" }] },
  "/rest/tourns/34644/rounds": [{ id: 1012, type: "final", name: 12, label: "Finals", Event: { abbr: "CX" } }],
  "/pages/invite/34644/CX/12/results": {
    id: 1012,
    name: 12,
    label: "Finals",
    Event: { Settings: { affLabel: "Aff", negLabel: "Neg" } },
    Sections: {
      "77": {
        id: 77,
        Judges: { "1": { first: "Ann", last: "Lee" }, "2": { first: "Bo", last: "Kim" }, "3": { first: "Cy", last: "Diaz" } },
        Entries: {
          "1": { code: "Harker AB", name: "Able & Baker", side: "Aff", schoolName: "The Harker School", Ballots: ballots({ "1": "W", "2": "L", "3": "L" }) },
          "2": { code: "Westminster CD", name: "Cole & Dunn", side: "Neg", schoolName: "The Westminster Schools", Ballots: ballots({ "1": "L", "2": "W", "3": "W" }) },
        },
      },
    },
  },
};

const COLLEGE: Record<string, unknown> = {
  "/tournaments?season=2026-2027&page=1": shirley.season,
  "/tournaments/2014/rounds": shirley.rounds,
  "/tournaments/2014/rounds/Finals": shirley.finals,
  "/tournaments/2014/rounds/Semis": shirley.semis,
  "/tournaments/2014/elims": shirley.elims,
};

function stubFetch(): typeof fetch {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.startsWith(COLLEGE_RESULTS_API)) {
      const path = href.slice(COLLEGE_RESULTS_API.length);
      if (path in COLLEGE) return new Response(JSON.stringify(COLLEGE[path]), { status: 200 });
      if (path.startsWith("/tournaments/2014/rounds/")) return new Response("[]", { status: 200 });
      return new Response("{}", { status: 404 });
    }
    const path = href.slice(TABROOM_API.length);
    if (path.startsWith("/rest/tourns?")) {
      const offset = Number(new URLSearchParams(path.split("?")[1]).get("offset"));
      const list = offset > 0 ? [] : [{ id: 34644, name: "53rd Annual Tournament of Champions", start: "2025-04-25T12:00:00.000Z" }];
      return new Response(JSON.stringify(list), { status: 200 });
    }
    if (path in TABROOM) return new Response(JSON.stringify(TABROOM[path]), { status: 200 });
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

const live = () => {
  const fetchImpl = stubFetch();
  return liveDecisionLookup({ fetch: fetchImpl, tabroomFetch: () => fetchImpl as never });
};

const row = (overrides: Partial<RoundDecisionRow> = {}): RoundDecisionRow => ({
  style: 1,
  tournament: "TOC",
  roundLevel: "Finals",
  affTeam: "Harker AB",
  negTeam: "Westminster CD",
  seasonYear: 2025,
  publishedAt: "2025-05-01",
  affWin: null,
  judgeDecision: null,
  resultsJudges: null,
  resultsSquirrels: null,
  ...overrides,
});

const college = (overrides: Partial<RoundDecisionRow> = {}) =>
  row({
    style: 4,
    tournament: "Shirley",
    seasonYear: 2027,
    publishedAt: "2026-11-17",
    affTeam: "Michigan BS",
    negTeam: "Emory GY",
    ...overrides,
  });

const neverCalled: DecisionLookup = async () => {
  throw new Error("lookup should not run");
};

describe("resultsSourceFor", () => {
  it("covers college on College Debate Results and Policy / PF / LD / Parli on Tabroom", () => {
    expect(resultsSourceFor(4)).toBe("college-debate-results");
    for (const style of [1, 2, 3, 8]) expect(resultsSourceFor(style)).toBe("tabroom");
    expect(resultsSourceFor(null)).toBeNull();
    expect(resultsSourceFor(5)).toBeNull();
  });
});

describe("resolveRoundDecision", () => {
  it("answers from the stored decision and judges with no request", async () => {
    const { decision, settled } = await resolveRoundDecision(
      row({ affWin: false, judgeDecision: "2-1", resultsJudges: "Ann Lee, Bo Kim, Cy Diaz", resultsSquirrels: "Ann Lee" }),
      neverCalled,
    );
    expect(settled).toBe(true);
    expect(decision).toMatchObject({ status: "known", source: "stored", affWin: false, decision: "2-1" });
    expect(decision.judges).toEqual([
      { name: "Ann Lee", side: "aff", squirreled: true },
      { name: "Bo Kim", side: "neg", squirreled: false },
      { name: "Cy Diaz", side: "neg", squirreled: false },
    ]);
  });

  it("reads the winner from a stored decision text when no winner is stored", async () => {
    const { decision } = await resolveRoundDecision(row({ judgeDecision: "3-0 Neg", style: 5 }), neverCalled);
    expect(decision).toMatchObject({ status: "known", affWin: false, decision: "3-0 Neg", judges: [] });
  });

  it("leaves stored judges' sides unnamed when their squirrels were never worked out", async () => {
    const { decision } = await resolveRoundDecision(
      row({ affWin: true, judgeDecision: "2-1", resultsJudges: "Ann Lee, Bo Kim", resultsSquirrels: null }),
      neverCalled,
    );
    expect(decision.judges.map((judge) => judge.side)).toEqual([null, null]);
  });

  it("looks a college round with no decision up on College Debate Results", async () => {
    const { decision, settled } = await resolveRoundDecision(college(), live());
    expect(settled).toBe(true);
    expect(decision).toMatchObject({ status: "known", source: "college-debate-results", affWin: false, decision: "3-2" });
    expect(decision.url).toContain("collegedebateresults");
    expect(decision.judges).toEqual([
      { name: "Jacob Wilkus", side: "neg", squirreled: false },
      { name: "Cade Blenden", side: "aff", squirreled: true },
      { name: "Jared Spiers", side: "aff", squirreled: true },
      { name: "AJ Byrne", side: "neg", squirreled: false },
      { name: "David Griffith", side: "neg", squirreled: false },
    ]);
  });

  it("looks a high school round up on Tabroom, with the squirrel on the other side", async () => {
    const { decision } = await resolveRoundDecision(row(), live());
    expect(decision).toMatchObject({ status: "known", source: "tabroom", affWin: false, decision: "2-1" });
    expect(decision.url).toContain("tabroom.com");
    expect(decision.judges).toEqual([
      { name: "Ann Lee", side: "aff", squirreled: true },
      { name: "Bo Kim", side: "neg", squirreled: false },
      { name: "Cy Diaz", side: "neg", squirreled: false },
    ]);
  });

  it("translates the winner when the video's sides are the site's reverse", async () => {
    const { decision } = await resolveRoundDecision(row({ affTeam: "Westminster CD", negTeam: "Harker AB" }), live());
    expect(decision.affWin).toBe(true);
    expect(decision.judges[0]).toEqual({ name: "Ann Lee", side: "neg", squirreled: true });
  });

  it("keeps a stored decision and adds the judges the site names", async () => {
    const { decision } = await resolveRoundDecision(row({ affWin: false, judgeDecision: "2-1" }), live());
    expect(decision).toMatchObject({ source: "stored", affWin: false, decision: "2-1" });
    expect(decision.judges.map((judge) => judge.name)).toEqual(["Ann Lee", "Bo Kim", "Cy Diaz"]);
    expect(decision.judges[0].side).toBe("aff");
  });

  it("never overrides a stored winner the site contradicts, and names no sides then", async () => {
    const { decision } = await resolveRoundDecision(row({ affWin: true, judgeDecision: "2-1" }), live());
    expect(decision.affWin).toBe(true);
    expect(decision.judges.map((judge) => judge.side)).toEqual([null, null, null]);
  });

  it("is unknown when the site has no such round", async () => {
    const { decision, settled } = await resolveRoundDecision(row({ affTeam: "Glenbrook North XY" }), live());
    expect(settled).toBe(true);
    expect(decision).toMatchObject({ status: "unknown", affWin: null, decision: null, judges: [] });
  });

  it("is unknown, without calling a site, for a round it can't look up", async () => {
    for (const unlookable of [row({ style: 5 }), row({ tournament: "" }), row({ negTeam: null }), row({ style: null })]) {
      const { decision, settled } = await resolveRoundDecision(unlookable, neverCalled);
      expect(settled).toBe(true);
      expect(decision.status).toBe("unknown");
    }
  });

  it("is unknown and unsettled when the lookup fails, so it is retried soon", async () => {
    const { decision, settled } = await resolveRoundDecision(row(), async () => {
      throw new Error("Tabroom is down");
    });
    expect(settled).toBe(false);
    expect(decision.status).toBe("unknown");
  });

  it("keeps a stored decision when the lookup for judges fails", async () => {
    const { decision, settled } = await resolveRoundDecision(row({ affWin: true }), async () => {
      throw new Error("Tabroom is down");
    });
    expect(settled).toBe(false);
    expect(decision).toMatchObject({ status: "known", source: "stored", affWin: true });
  });
});
