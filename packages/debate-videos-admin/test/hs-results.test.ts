import { describe, expect, it } from "vitest";
import { parseJudgePanel, planCollegeResultUpdate } from "../src/lib/college-results";
import {
  TABROOM_API,
  TabroomAuthError,
  entryMatches,
  eventRoundKeys,
  hsTournamentTokens,
  lookupHsResult,
  pickEvents,
  pickHsTournament,
  sectionDecision,
  type TabroomEvent,
  type TabroomRound,
  type TabroomTourn,
} from "../src/lib/hs-results";

// Tournament names and events as Tabroom lists them for the 2024-25 season
// (TOC is tourn 34644); round results follow the shape of Tabroom's
// `/pages/invite/:tourn/:event/:round/results` (vendored resultsController).
const SEASON: TabroomTourn[] = [
  { id: 34644, name: "53rd Annual Tournament of Champions", start: "2025-04-25T12:00:00.000Z" },
  { id: 35121, name: "9th Annual Middle School Tournament of Champions", start: "2025-05-09T12:00:00.000Z" },
  { id: 34485, name: "National Debate Coaches Association National Championships", start: "2025-04-12T12:00:00.000Z" },
  { id: 35467, name: "National Speech and Debate Tournament", start: "2025-06-15T12:00:00.000Z" },
  { id: 31548, name: "Harvard National Speech and Debate Tournament", start: "2025-02-15T12:00:00.000Z" },
  { id: 34234, name: "Harvard Westlake Debates", start: "2025-01-10T12:00:00.000Z" },
  { id: 35020, name: "Glenbrooks Speech and Debate Tournament", start: "2024-11-22T12:30:00.000Z" },
];

const TOC_EVENTS: TabroomEvent[] = [
  { id: 326778, abbr: "CD", name: "Congressional Debate", type: "congress", NSDACategory: { name: "Congressional Debate" } },
  { id: 326784, abbr: "LD", name: "Lincoln-Douglas", type: "debate", NSDACategory: { name: "Lincoln-Douglas Debate" } },
  { id: 326787, abbr: "CX", name: "Policy Debate", type: "debate", NSDACategory: { name: "Policy Debate" } },
  { id: 326789, abbr: "PF-G", name: "Public Forum Gold", type: "debate", NSDACategory: { name: "Public Forum Debate" } },
  { id: 326790, abbr: "PF-S", name: "Public Forum Silver", type: "debate", NSDACategory: { name: "Public Forum Debate" } },
  { id: 326791, abbr: "WSD", name: "World Schools", type: "wsdc", NSDACategory: { name: "World Schools Debate" } },
];

const CX_ROUNDS: TabroomRound[] = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: 1000 + n, type: "prelim", name: n, label: null, Event: { abbr: "CX" } })),
  { id: 1008, type: "elim", name: 8, label: "Doubles", Event: { abbr: "CX" } },
  { id: 1009, type: "elim", name: 9, label: "Octos", Event: { abbr: "CX" } },
  { id: 1010, type: "elim", name: 10, label: null, Event: { abbr: "CX" } },
  { id: 1011, type: "elim", name: 11, label: null, Event: { abbr: "CX" } },
  { id: 1012, type: "final", name: 12, label: null, Event: { abbr: "CX" } },
  { id: 2001, type: "prelim", name: 1, label: "R1", Event: { abbr: "LD" } },
];

const entry = (side: string, code: string, name: string, school: string, ballots: Record<string, string>) => ({
  id: Math.floor(Math.random() * 1e6),
  code,
  name,
  side,
  schoolName: school,
  Ballots: Object.fromEntries(Object.entries(ballots).map(([judge, winloss]) => [judge, { winloss }])),
});

/** The TOC policy final: Westminster (Neg) beats Harker 2-1, Lee squirrels. */
const FINAL = {
  id: 1012,
  name: 12,
  label: "Round 12",
  Event: { Settings: { affLabel: "Aff", negLabel: "Neg" } },
  Sections: {
    "77": {
      id: 77,
      letter: "1",
      Judges: {
        "501": { first: "Ann", last: "Lee" },
        "502": { first: "Bo", last: "Kim" },
        "503": { first: "Cy", last: "Diaz" },
      },
      Entries: {
        "1": entry("Aff", "Harker AB", "Able & Baker", "The Harker School", { "501": "W", "502": "L", "503": "L" }),
        "2": entry("Neg", "Westminster CD", "Cole & Dunn", "The Westminster Schools", { "501": "L", "502": "W", "503": "W" }),
      },
    },
  },
};

/** CX round 3, with one judge per section. */
const ROUND3 = {
  id: 1003,
  name: 3,
  Event: { Settings: { affLabel: "Aff", negLabel: "Neg" } },
  Sections: {
    "10": {
      id: 10,
      Judges: { "601": { first: "Dee", last: "Judge" } },
      Entries: {
        "1": entry("Aff", "Westminster CD", "Cole & Dunn", "The Westminster Schools", { "601": "W" }),
        "2": entry("Neg", "Harker AB", "Able & Baker", "The Harker School", { "601": "L" }),
      },
    },
    "11": { id: 11, bye: 1, Entries: { "1": entry("", "Bye Team XY", "X & Y", "Somewhere", {}) } },
  },
};

function tabroomFetch(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    "/rest/tourns/34644/invite": { id: 34644, name: SEASON[0].name, Events: TOC_EVENTS },
    "/rest/tourns/34644/rounds": CX_ROUNDS,
    "/pages/invite/34644/CX/12/results": FINAL,
    "/pages/invite/34644/CX/3/results": ROUND3,
    ...overrides,
  };
  const requested: string[] = [];
  const fetcher = async (url: string) => {
    const path = url.slice(TABROOM_API.length);
    requested.push(path);
    if (path.startsWith("/rest/tourns?")) {
      const params = new URLSearchParams(path.slice("/rest/tourns?".length));
      const after = Date.parse(params.get("startAfter")!);
      const before = Date.parse(params.get("startBefore")!);
      const inRange = SEASON.filter((t) => Date.parse(t.start!) >= after && Date.parse(t.start!) < before);
      return new Response(JSON.stringify(Number(params.get("offset")) > 0 ? [] : inRange), { status: 200 });
    }
    if (path in routes) {
      const body = routes[path];
      if (typeof body === "number") return new Response("{}", { status: body });
      return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response(JSON.stringify({ detail: "No public results" }), { status: 404 });
  };
  return { fetcher, requested };
}

describe("hsTournamentTokens / pickHsTournament", () => {
  it("expands high school shorthand", () => {
    expect(hsTournamentTokens("TOC 2025")).toEqual(["tournament", "champions"]);
    expect(hsTournamentTokens("NSDA Nationals 2025")).toEqual(["national", "speech", "debate", "tournament"]);
    expect(hsTournamentTokens("NDCA")).toEqual(["national", "debate", "coaches", "association"]);
  });

  it("settles TOC on the varsity tournament, skipping the middle school one", () => {
    expect(pickHsTournament("TOC", SEASON).map((t) => t.id)).toEqual([34644]);
    expect(pickHsTournament("Middle School TOC", SEASON).map((t) => t.id)).toEqual([35121]);
  });

  it("prefers the name with no extra words: NSDA Nationals is not Harvard's", () => {
    expect(pickHsTournament("NSDA Nationals", SEASON).map((t) => t.id)).toEqual([35467]);
  });

  it("refuses to guess between tournaments sharing a word, unless the posting date settles it", () => {
    expect(pickHsTournament("Harvard", SEASON)).toHaveLength(2);
    expect(pickHsTournament("Harvard", SEASON, "2025-01-12").map((t) => t.id)).toEqual([34234]);
  });
});

describe("pickEvents", () => {
  it("finds each style's events, the top division only", () => {
    expect(pickEvents(1, TOC_EVENTS).map((e) => e.abbr)).toEqual(["CX"]);
    expect(pickEvents(2, TOC_EVENTS).map((e) => e.abbr)).toEqual(["PF-G"]);
    expect(pickEvents(3, TOC_EVENTS).map((e) => e.abbr)).toEqual(["LD"]);
    expect(pickEvents(4, TOC_EVENTS)).toEqual([]);
  });

  it("keeps varsity over novice and JV", () => {
    const events: TabroomEvent[] = [
      { id: 1, abbr: "NCX", name: "Novice Policy", type: "debate" },
      { id: 2, abbr: "VCX", name: "Varsity Policy", type: "debate" },
      { id: 3, abbr: "JVLD", name: "JV Lincoln Douglas", type: "debate" },
    ];
    expect(pickEvents(1, events).map((e) => e.abbr)).toEqual(["VCX"]);
    expect(pickEvents(3, events).map((e) => e.abbr)).toEqual(["JVLD"]);
  });
});

describe("eventRoundKeys", () => {
  it("names labelled rounds and counts unlabelled elims back from the final", () => {
    const keys = eventRoundKeys(CX_ROUNDS.filter((r) => r.Event?.abbr === "CX"));
    expect(keys.get(1003)).toBe("round 3");
    expect(keys.get(1008)).toBe("doubles");
    expect(keys.get(1009)).toBe("octas");
    expect(keys.get(1010)).toBe("quarters");
    expect(keys.get(1011)).toBe("semis");
    expect(keys.get(1012)).toBe("final");
  });
});

describe("entryMatches", () => {
  const harker = entry("Aff", "Harker AB", "Ann Able & Bo Baker", "The Harker School", {});
  it("matches the entry code, debaters' last names, or school plus initials", () => {
    expect(entryMatches("Harker AB", harker)).toBe(true);
    expect(entryMatches("Harker BA", harker)).toBe(true);
    expect(entryMatches("Harker Able & Baker", harker)).toBe(true);
    expect(entryMatches("Harker AC", harker)).toBe(false);
    const numeric = entry("Aff", "1042", "Ann Able & Bo Baker", "The Harker School", {});
    expect(entryMatches("Harker AB", numeric)).toBe(true);
    expect(entryMatches("Westminster AB", numeric)).toBe(false);
  });
});

describe("sectionDecision", () => {
  it("counts W/L ballots and stars the judges who voted for the loser", () => {
    const section = FINAL.Sections["77"];
    const decision = sectionDecision(section, section.Entries["1"], section.Entries["2"]);
    expect(decision).toEqual({ side: "neg", ballots: "2-1", judges: "Ann Lee*, Bo Kim, Cy Diaz" });
    expect(parseJudgePanel(decision.judges, decision.ballots)).toEqual({ judges: ["Ann Lee", "Bo Kim", "Cy Diaz"], squirrels: ["Ann Lee"] });
  });

  it("reports no winner while a ballot is missing or a forfeit", () => {
    const aff = entry("Aff", "A", "", "", { "1": "W", "2": "W" });
    const neg = entry("Neg", "B", "", "", { "1": "L" });
    expect(sectionDecision({ Judges: { "1": { first: "A", last: "B" }, "2": { first: "C", last: "D" }, "3": { first: "E", last: "F" } } }, aff, neg).side).toBeNull();
    expect(sectionDecision({}, entry("Aff", "A", "", "", { "1": "Fft" }), entry("Neg", "B", "", "", { "1": "Fft" })).side).toBeNull();
  });
});

describe("lookupHsResult", () => {
  const toc = { style: 1, tournament: "TOC", seasonYear: 2025, publishedAt: "2025-05-01" };

  it("finds the final and reads the decision from the ballots", async () => {
    const { fetcher, requested } = tabroomFetch();
    const result = await lookupHsResult({ ...toc, roundLevel: "Finals", affTeam: "Harker AB", negTeam: "Westminster CD" }, fetcher);
    expect(result.status).toBe("verified");
    expect(result.winnerSide).toBe("neg");
    expect(result.winnerTeam).toBe("Westminster CD");
    expect(result.ballots).toBe("2-1");
    expect(result.sidesSwapped).toBe(false);
    expect(result.match?.judges).toBe("Ann Lee*, Bo Kim, Cy Diaz");
    expect(result.match?.affDebaters).toBe("Able, Baker");
    expect(result.tournament?.url).toContain("round_id=1012");
    expect(result.message).toBe("Round 12: Westminster CD won on the NEG 2-1.");
    // Only the final's results are requested, not every round.
    expect(requested.filter((p) => p.startsWith("/pages/"))).toEqual(["/pages/invite/34644/CX/12/results"]);
    expect(planCollegeResultUpdate({ affWin: null, judgeDecision: null }, result)).toMatchObject({
      status: "verified",
      affWin: false,
      judgeDecision: "2-1",
      judges: "Ann Lee, Bo Kim, Cy Diaz",
      squirrels: "Ann Lee",
      tournamentId: 34644,
    });
  });

  it("flags swapped sides", async () => {
    const { fetcher } = tabroomFetch();
    const result = await lookupHsResult({ ...toc, roundLevel: "Round 3", affTeam: "Harker AB", negTeam: "Westminster CD" }, fetcher);
    expect(result.status).toBe("verified");
    expect(result.sidesSwapped).toBe(true);
    expect(result.winnerSide).toBe("aff");
    expect(result.ballots).toBe("1-0");
  });

  it("refuses a pairing that met more than once when the round is unknown", async () => {
    const { fetcher } = tabroomFetch();
    const result = await lookupHsResult({ ...toc, roundLevel: "", affTeam: "Harker AB", negTeam: "Westminster CD" }, fetcher);
    expect(result.status).toBe("ambiguous");
    expect(result.message).toContain("met 2 times");
  });

  it("says when the tournament or the debate isn't there", async () => {
    const { fetcher } = tabroomFetch();
    expect((await lookupHsResult({ ...toc, tournament: "Nowhere Classic", affTeam: "A B", negTeam: "C D" }, fetcher)).status).toBe("not_found");
    const missing = await lookupHsResult({ ...toc, roundLevel: "Semis", affTeam: "Harker AB", negTeam: "Westminster CD" }, fetcher);
    expect(missing.status).toBe("not_found");
    expect(missing.tournament?.id).toBe(34644);
    expect((await lookupHsResult({ ...toc, style: 4, affTeam: "A", negTeam: "B" }, fetcher)).message).toContain("high school");
  });

  it("throws a clear error when Tabroom wants the site's session", async () => {
    const { fetcher } = tabroomFetch({ "/rest/tourns/34644/rounds": 401 });
    await expect(
      lookupHsResult({ ...toc, roundLevel: "Finals", affTeam: "Harker AB", negTeam: "Westminster CD" }, fetcher),
    ).rejects.toBeInstanceOf(TabroomAuthError);
  });
});
