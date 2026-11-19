import { describe, expect, it } from "vitest";
import {
  COLLEGE_RESULTS_API,
  RequestBudgetExceeded,
  createBudgetedFetcher,
  lookupCollegeResult,
  parseJudgePanel,
  planCollegeResultUpdate,
  pickTournament,
  roundKey,
  seasonFor,
  teamMatches,
  type CollegeTournament,
} from "../src/lib/college-results";
// Real responses from the College Debate Results backend for the 2026 Shirley
// (tournament 2014), trimmed to the rounds these tests read.
import shirley from "./fixtures/college-results-shirley-2026.json";

/** Serves the fixture for the backend paths the lookup requests. */
function fixtureFetch(overrides: Record<string, unknown> = {}) {
  const routes: Record<string, unknown> = {
    "/tournaments?season=2026-2027&page=1": shirley.season,
    "/tournaments/2014/rounds": shirley.rounds,
    "/tournaments/2014/rounds/Finals": shirley.finals,
    "/tournaments/2014/rounds/Semis": shirley.semis,
    "/tournaments/2014/rounds/Round%201": shirley.round1,
    "/tournaments/2014/elims": shirley.elims,
    ...overrides,
  };
  const requested: string[] = [];
  const fetcher = async (url: string) => {
    const path = url.slice(COLLEGE_RESULTS_API.length);
    requested.push(path);
    if (path in routes) return new Response(JSON.stringify(routes[path]), { status: 200 });
    // Other rounds exist but hold nothing these tests look for.
    if (path.startsWith("/tournaments/2014/rounds/")) return new Response("[]", { status: 200 });
    return new Response("{}", { status: 404 });
  };
  return { fetcher, requested };
}

const tournament = (overrides: Partial<CollegeTournament>): CollegeTournament => ({
  id: 1,
  name: "",
  display_name: null,
  host_school: null,
  tournament_type: "bracket",
  season: "2025-2026",
  start_date: null,
  ...overrides,
});

describe("seasonFor", () => {
  it("reads the season year, else the publish date", () => {
    expect(seasonFor(2027)).toBe("2026-2027");
    expect(seasonFor(null, "2026-11-17")).toBe("2026-2027");
    expect(seasonFor(0, "2026-03-28")).toBe("2025-2026");
    expect(seasonFor(null, null)).toBeNull();
  });
});

describe("roundKey", () => {
  it("maps the library's round labels and the site's to one key", () => {
    expect(roundKey("Final")).toBe("final");
    expect(roundKey("Finals")).toBe("final");
    expect(roundKey("Semifinals")).toBe(roundKey("Semis"));
    expect(roundKey("Double Octafinals")).toBe("doubles");
    expect(roundKey("Octas")).toBe("octas");
    expect(roundKey("Round 3")).toBe("round 3");
    expect(roundKey("R3")).toBe("round 3");
    expect(roundKey("MSU LM")).toBeNull();
  });
});

describe("teamMatches", () => {
  it("matches a team code, every debater's last name, or an abbreviated school", () => {
    expect(teamMatches("Michigan BS", "Michigan BS", "Barrett (-), Song (-)")).toBe(true);
    expect(teamMatches("Michigan #2 Barrett & Song", "Michigan BS", "Barrett (-), Song (-)")).toBe(true);
    expect(teamMatches("MSU LM", "Michigan State LM", "Lewis (-), Martin (-)")).toBe(true);
    expect(teamMatches("GMU WW", "George Mason WW", null)).toBe(true);
    expect(teamMatches("UC Berkeley BM", "Berkeley BM", null)).toBe(true);
    expect(teamMatches("Kansas UO", "Kansas OU", null)).toBe(true);
  });

  it("never matches on seeds or on only one of two debaters", () => {
    expect(teamMatches("Michigan #2 Barrett", "Michigan BS", "Barrett (-), Song (-)")).toBe(false);
    expect(teamMatches("Michigan BP", "Michigan BS", "Barrett (-), Song (-)")).toBe(false);
    expect(teamMatches("Michigan BS", null, null)).toBe(false);
    expect(teamMatches("Michigan GL", "Michigan State GL", null)).toBe(false);
  });
});

describe("pickTournament", () => {
  const season = [
    tournament({ id: 1, name: "80th National Debate Tournament", host_school: "University of Houston", start_date: "2026-03-26" }),
    tournament({ id: 2, name: "University of Houston College Tournament", display_name: "Houston Tournament", start_date: "2025-10-10" }),
    tournament({ id: 3, name: "D1 NDT Qualifier 2026", tournament_type: "qualifier" }),
    tournament({ id: 4, name: "Kentucky College Tournament", display_name: "Kentucky Tournament", start_date: "2025-09-26" }),
    tournament({ id: 5, name: "Kentucky Round Robin", tournament_type: "round_robin", start_date: "2025-09-23" }),
    tournament({ id: 6, name: "ADA Nationals 2026", start_date: "2026-03-07" }),
    tournament({ id: 7, name: "FR Shirley and ADA Fall Champions at WFU", display_name: "Shirley / ADA Fall Championship", start_date: "2025-11-15" }),
  ];
  const ids = (query: string, publishedAt?: string) => pickTournament(query, season, publishedAt).map((t) => t.id);

  it("resolves the library's shorthand", () => {
    expect(ids("NDT")).toEqual([1]);
    expect(ids("2026 NDT")).toEqual([1]);
    expect(ids("Houston")).toEqual([2]);
    expect(ids("Kentucky")).toEqual([4]);
    expect(ids("KYRR")).toEqual([5]);
    expect(ids("UK RR")).toEqual([5]);
    expect(ids("Shirley")).toEqual([7]);
  });

  it("returns every candidate when the name is ambiguous, unless the date settles it", () => {
    expect(ids("ADA")).toEqual([6, 7]);
    expect(ids("ADA", "2026-03-10")).toEqual([6]);
    expect(ids("Nonexistent")).toEqual([]);
  });
});

describe("lookupCollegeResult", () => {
  it("finds the 2026 Shirley final and its explicit decision", async () => {
    const { fetcher } = fixtureFetch();
    const result = await lookupCollegeResult(
      {
        tournament: "Shirley",
        roundLevel: "Final",
        affTeam: "Michigan #2 Barrett & Song",
        negTeam: "Emory #1 Gallagher & Young",
        seasonYear: 2027,
      },
      fetcher,
    );
    expect(result).toMatchObject({
      status: "verified",
      round: "Finals",
      winnerSide: "neg",
      winnerTeam: "Emory GY",
      ballots: "3-2",
      sidesSwapped: false,
      tournament: { id: 2014, name: "Shirley / ADA Fall Championship", season: "2026-2027" },
      match: { affTeam: "Michigan BS", negTeam: "Emory GY", decision: "NEG" },
    });
    expect(result.tournament?.url).toBe("https://collegedebateresults.vercel.app/tournaments/2014");
  });

  it("reports swapped sides relative to the form", async () => {
    const { fetcher } = fixtureFetch();
    const result = await lookupCollegeResult(
      { tournament: "Shirley", roundLevel: "Semifinals", affTeam: "Northwestern JP", negTeam: "Michigan BS", seasonYear: 2027 },
      fetcher,
    );
    expect(result).toMatchObject({ status: "verified", sidesSwapped: true, winnerSide: "aff", winnerTeam: "Michigan BS", ballots: "4-1" });
  });

  it("searches every round when the round level is unrecognised", async () => {
    const { fetcher, requested } = fixtureFetch();
    const result = await lookupCollegeResult(
      { tournament: "Shirley", roundLevel: "MSU LM", affTeam: "Michigan BS", negTeam: "Emory GY", seasonYear: 2027 },
      fetcher,
    );
    expect(result.round).toBe("Finals");
    expect(requested.filter((path) => path.startsWith("/tournaments/2014/rounds/")).length).toBe(shirley.rounds.length);
  });

  it("does not report a winner the site doesn't state", async () => {
    const finals = shirley.finals.map((row) => ({ ...row, decision: null }));
    const { fetcher } = fixtureFetch({ "/tournaments/2014/rounds/Finals": finals, "/tournaments/2014/elims": [] });
    const result = await lookupCollegeResult(
      { tournament: "Shirley", roundLevel: "Finals", affTeam: "Michigan BS", negTeam: "Emory GY", seasonYear: 2027 },
      fetcher,
    );
    expect(result).toMatchObject({ status: "winner_not_explicit", winnerSide: null, winnerTeam: null, ballots: null });
  });

  it("says when the pairing isn't in that round", async () => {
    const { fetcher } = fixtureFetch();
    const result = await lookupCollegeResult(
      { tournament: "Shirley", roundLevel: "Finals", affTeam: "Kansas OU", negTeam: "Emory GY", seasonYear: 2027 },
      fetcher,
    );
    expect(result.status).toBe("not_found");
    expect(result.winnerSide).toBeNull();
  });

  it("asks for the tournament and teams before searching", async () => {
    const { fetcher, requested } = fixtureFetch();
    const result = await lookupCollegeResult({ tournament: "", affTeam: "A", negTeam: "B", seasonYear: 2027 }, fetcher);
    expect(result.status).toBe("not_found");
    expect(requested).toEqual([]);
  });
});

describe("parseJudgePanel", () => {
  it("names the starred judges as squirrels when they match the minority", () => {
    expect(parseJudgePanel("Jacob Wilkus, Cade Blenden*, Jared Spiers*, AJ Byrne, David Griffith", "3-2")).toEqual({
      judges: ["Jacob Wilkus", "Cade Blenden", "Jared Spiers", "AJ Byrne", "David Griffith"],
      squirrels: ["Cade Blenden", "Jared Spiers"],
    });
    expect(parseJudgePanel("A, B, C", "3-0").squirrels).toEqual([]);
    expect(parseJudgePanel("Duncan Stewart", null)).toEqual({ judges: ["Duncan Stewart"], squirrels: [] });
  });

  it("names nobody when the marks don't add up", () => {
    expect(parseJudgePanel("A*, B, C", "3-0").squirrels).toBeNull();
    expect(parseJudgePanel("A*", null).squirrels).toBeNull();
    expect(parseJudgePanel(null, "3-0")).toEqual({ judges: [], squirrels: null });
  });
});

describe("planCollegeResultUpdate", () => {
  const verified = {
    status: "verified" as const,
    message: "",
    tournament: { id: 2014, name: "Shirley", season: "2026-2027", startDate: null, url: "" },
    round: "Finals",
    match: { affTeam: "Michigan BS", affDebaters: "", negTeam: "Emory GY", negDebaters: "", judges: "A, B*, C*, D, E", decision: "NEG" },
    sidesSwapped: false,
    winnerSide: "neg" as const,
    winnerTeam: "Emory GY",
    ballots: "3-2",
    candidates: [],
  };

  it("fills only a missing winner and decision", () => {
    expect(planCollegeResultUpdate({ affWin: null, judgeDecision: null }, verified)).toEqual({
      status: "verified",
      affWin: false,
      judgeDecision: "3-2",
      judges: "A, B, C, D, E",
      squirrels: "B, C",
      tournamentId: 2014,
    });
    expect(planCollegeResultUpdate({ affWin: false, judgeDecision: "3-2" }, verified)).toEqual({
      status: "verified",
      judges: "A, B, C, D, E",
      squirrels: "B, C",
      tournamentId: 2014,
    });
  });

  it("translates swapped sides and flags a contradicting saved winner", () => {
    expect(planCollegeResultUpdate({ affWin: null, judgeDecision: null }, { ...verified, sidesSwapped: true }).affWin).toBe(true);
    const conflict = planCollegeResultUpdate({ affWin: true, judgeDecision: null }, verified);
    expect(conflict.status).toBe("conflict");
    expect(conflict.affWin).toBeUndefined();
  });

  it("writes no winner for anything but a verified decision", () => {
    const update = planCollegeResultUpdate({ affWin: null, judgeDecision: null }, { ...verified, status: "ambiguous", match: null, winnerSide: null, tournament: null });
    expect(update).toEqual({ status: "ambiguous", judges: null, squirrels: null, tournamentId: null });
  });
});

describe("createBudgetedFetcher", () => {
  it("answers repeats from memory, spaces requests and stops at the budget", async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    const fetcher = createBudgetedFetcher(
      async (url: string) => {
        calls.push(url);
        return new Response(`body ${url}`, { status: 200 });
      },
      { maxRequests: 2, delayMs: 150, sleep: async (ms) => void sleeps.push(ms) },
    );
    expect(await (await fetcher("a")).text()).toBe("body a");
    expect(await (await fetcher("a")).text()).toBe("body a");
    await fetcher("b");
    await expect(fetcher("c")).rejects.toBeInstanceOf(RequestBudgetExceeded);
    expect(calls).toEqual(["a", "b"]);
    expect(sleeps).toEqual([150]);
    expect(fetcher.requests()).toBe(2);
  });
});
