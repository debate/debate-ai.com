import { describe, expect, it } from "vitest";
import {
  TABROOM_RESULTS_API,
  decisionFromSection,
  entrySide,
  eventMatchesStyle,
  lookupTabroomResult,
  pickTabroomTournament,
  planTabroomResultUpdate,
  seasonDateRange,
  tabroomTeamMatches,
  tournamentTokens,
  type TabroomTournament,
} from "../src/lib/tabroom-results";
import ucla from "./fixtures/tabroom-results-ucla-2026.json";

/** Serves the UCLA fixture for the Tabroom paths the lookup requests. */
function fixtureFetch(overrides: Record<string, unknown> = {}) {
  const seasonQuery = (() => {
    const range = seasonDateRange("2025-2026")!;
    return `/rest/tourns?${new URLSearchParams({
      startAfter: range.startAfter,
      startBefore: range.startBefore,
      publishedResults: "true",
      limit: "500",
      offset: "0",
      fields: "id,name,start,end,city,state,webname",
    })}`;
  })();
  const routes: Record<string, unknown> = {
    [seasonQuery]: ucla.season,
    "/rest/tourns/35001/rounds": ucla.rounds,
    ...Object.fromEntries(
      Object.entries(ucla.results).map(([name, body]) => [
        `/pages/invite/35001/OPLD/${name}/results`,
        body,
      ]),
    ),
    ...overrides,
  };
  const requested: string[] = [];
  const fetcher = async (url: string) => {
    const path = url.slice(TABROOM_RESULTS_API.length);
    requested.push(path);
    if (path in routes) return new Response(JSON.stringify(routes[path]), { status: 200 });
    if (path.startsWith("/rest/tourns?") && path.includes("offset=500")) {
      return new Response("[]", { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };
  return { fetcher, requested };
}

const tournament = (overrides: Partial<TabroomTournament>): TabroomTournament => ({
  id: 1,
  name: "",
  start: null,
  ...overrides,
});

describe("seasonDateRange", () => {
  it("spans August of the start year to August of the end year", () => {
    expect(seasonDateRange("2025-2026")).toEqual({
      startAfter: new Date(Date.UTC(2025, 7, 1) - 1).toISOString(),
      startBefore: new Date(Date.UTC(2026, 7, 1)).toISOString(),
    });
    expect(seasonDateRange("bad")).toBeNull();
  });
});

describe("tournamentTokens", () => {
  it("expands HS shorthand", () => {
    expect(tournamentTokens("UCLA")).toContain("ucla");
    expect(tournamentTokens("Greenhill RR")).toEqual(expect.arrayContaining(["greenhill", "round", "robin"]));
    // "tournament" / "of" are stop-words; TOC still matches "Tournament of Champions".
    expect(tournamentTokens("TOC 2026")).toEqual(["champions"]);
  });
});

describe("pickTabroomTournament", () => {
  const season = [
    tournament({ id: 1, name: "UCLA Invitational", start: "2026-01-17 08:00:00" }),
    tournament({ id: 2, name: "UCLA Round Robin", start: "2026-01-16 08:00:00" }),
    tournament({ id: 3, name: "Yale Invitational", start: "2026-09-18 08:00:00" }),
    tournament({ id: 4, name: "Greenhill Fall Classic", start: "2025-09-12 08:00:00" }),
    tournament({ id: 5, name: "Greenhill World Universities Debating", start: "2025-10-01 08:00:00" }),
  ];
  const ids = (query: string, publishedAt?: string) => pickTabroomTournament(query, season, publishedAt).map((t) => t.id);

  it("resolves the library's shorthand", () => {
    expect(ids("Yale")).toEqual([3]);
    expect(ids("UCLA RR")).toEqual([2]);
    // Prefer the non-round-robin when the query doesn't ask for one.
    expect(ids("UCLA")).toEqual([1]);
  });

  it("returns every candidate when the name is ambiguous, unless the date settles it", () => {
    expect(ids("Greenhill")).toEqual([4, 5]);
    expect(ids("Greenhill", "2025-09-13")).toEqual([4]);
    expect(ids("Nonexistent")).toEqual([]);
  });
});

describe("eventMatchesStyle", () => {
  it("matches LD / PF / Policy / Parli by abbr or name", () => {
    expect(eventMatchesStyle({ abbr: "OPLD", name: "Lincoln Douglas (Open)" }, 3)).toBe(true);
    expect(eventMatchesStyle({ abbr: "VPF", name: "Public Forum" }, 2)).toBe(true);
    expect(eventMatchesStyle({ abbr: "VCX", name: "Policy Debate" }, 1)).toBe(true);
    expect(eventMatchesStyle({ abbr: "OPLD", name: "Lincoln Douglas (Open)" }, 1)).toBe(false);
    expect(eventMatchesStyle({ abbr: "DI", name: "Dramatic Interp" }, null)).toBe(false);
  });
});

describe("entrySide and tabroomTeamMatches", () => {
  it("reads Aff/Neg labels and numeric sides", () => {
    expect(entrySide("Aff")).toBe("aff");
    expect(entrySide(2)).toBe("neg");
    expect(entrySide("Gov", "Gov", "Opp")).toBe("aff");
  });

  it("matches a Tabroom code or debater name", () => {
    expect(
      tabroomTeamMatches("Valley Christian YN", {
        id: 1,
        code: "Valley Christian YN",
        name: "Yohaan Narayanan",
        schoolName: "Valley Christian High School",
      }),
    ).toBe(true);
    expect(
      tabroomTeamMatches("Mission San Jose Lagisetty", {
        id: 2,
        code: "Mission San Jose SL",
        name: "Siddharth Lagisetty",
        schoolName: "Mission San Jose High School",
      }),
    ).toBe(true);
    expect(
      tabroomTeamMatches("Westlake AB", {
        id: 3,
        code: "Westlake SS",
        name: "Simran Suri",
        schoolName: "Westlake High School",
      }),
    ).toBe(false);
  });
});

describe("decisionFromSection", () => {
  it("counts a 3-0 final and marks no squirrels", () => {
    const finals = (ucla.results as Record<string, (typeof ucla.results)[keyof typeof ucla.results]>)["10"];
    const section = Object.values(finals.Sections)[0];
    expect(decisionFromSection(section)).toMatchObject({
      side: "neg",
      ballots: "3-0",
      squirrels: [],
    });
  });

  it("marks minority judges with a trailing star", () => {
    const octas = (ucla.results as Record<string, (typeof ucla.results)[keyof typeof ucla.results]>)["7"];
    const section = Object.values(octas.Sections)[0];
    const decision = decisionFromSection(section);
    expect(decision).toMatchObject({ side: "neg", ballots: "2-1" });
    expect(decision.judges).toContain("Amy Chen*");
  });
});

describe("lookupTabroomResult", () => {
  it("finds the 2026 UCLA LD final and its decision", async () => {
    const { fetcher } = fixtureFetch();
    const result = await lookupTabroomResult(
      {
        tournament: "UCLA",
        roundLevel: "Final",
        affTeam: "Mission San Jose SL",
        negTeam: "Valley Christian YN",
        seasonYear: 2026,
        style: 3,
        publishedAt: "2026-01-19",
      },
      fetcher,
    );
    expect(result).toMatchObject({
      status: "verified",
      round: "Finals",
      winnerSide: "neg",
      winnerTeam: "Valley Christian YN",
      ballots: "3-0",
      sidesSwapped: false,
      tournament: { id: 35001, name: "UCLA Invitational", season: "2025-2026" },
      match: { affTeam: "Mission San Jose SL", negTeam: "Valley Christian YN", decision: "NEG" },
    });
    expect(result.tournament?.url).toContain("tourn_id=35001");
  });

  it("reports swapped sides relative to the form", async () => {
    const { fetcher } = fixtureFetch();
    const result = await lookupTabroomResult(
      {
        tournament: "UCLA",
        roundLevel: "Finals",
        affTeam: "Valley Christian YN",
        negTeam: "Mission San Jose SL",
        seasonYear: 2026,
        style: 3,
        publishedAt: "2026-01-19",
      },
      fetcher,
    );
    expect(result).toMatchObject({ status: "verified", sidesSwapped: true, winnerSide: "neg", winnerTeam: "Valley Christian YN" });
  });

  it("says when the pairing isn't in that round", async () => {
    const { fetcher } = fixtureFetch();
    const result = await lookupTabroomResult(
      {
        tournament: "UCLA",
        roundLevel: "Finals",
        affTeam: "Westlake SS",
        negTeam: "Valley Christian YN",
        seasonYear: 2026,
        style: 3,
        publishedAt: "2026-01-19",
      },
      fetcher,
    );
    expect(result.status).toBe("not_found");
    expect(result.winnerSide).toBeNull();
  });

  it("asks for the tournament and teams before searching", async () => {
    const { fetcher, requested } = fixtureFetch();
    const result = await lookupTabroomResult({ tournament: "", affTeam: "A", negTeam: "B", seasonYear: 2026 }, fetcher);
    expect(result.status).toBe("not_found");
    expect(requested).toEqual([]);
  });

  it("refuses to guess when several tournaments match", async () => {
    const range = seasonDateRange("2025-2026")!;
    const seasonPath = `/rest/tourns?${new URLSearchParams({
      startAfter: range.startAfter,
      startBefore: range.startBefore,
      publishedResults: "true",
      limit: "500",
      offset: "0",
      fields: "id,name,start,end,city,state,webname",
    })}`;
    const { fetcher } = fixtureFetch({
      [seasonPath]: [
        { id: 1, name: "Greenhill Fall Classic", start: "2025-09-12 08:00:00" },
        { id: 2, name: "Greenhill World Universities Debating", start: "2025-10-01 08:00:00" },
      ],
    });
    const result = await lookupTabroomResult(
      { tournament: "Greenhill", roundLevel: "Finals", affTeam: "A", negTeam: "B", seasonYear: 2026 },
      fetcher,
    );
    expect(result.status).toBe("ambiguous");
    expect(result.candidates.map((c) => c.id).sort()).toEqual([1, 2]);
  });
});

describe("planTabroomResultUpdate", () => {
  const verified = {
    status: "verified" as const,
    message: "",
    tournament: { id: 35001, name: "UCLA", season: "2025-2026", startDate: null, url: "" },
    round: "Finals",
    match: {
      affTeam: "Mission San Jose SL",
      affDebaters: "",
      negTeam: "Valley Christian YN",
      negDebaters: "",
      judges: "Emilio Lois, Angelina Tan, Tanisha Sonkusare",
      decision: "NEG",
    },
    sidesSwapped: false,
    winnerSide: "neg" as const,
    winnerTeam: "Valley Christian YN",
    ballots: "3-0",
    candidates: [],
  };

  it("fills only a missing winner and decision", () => {
    expect(planTabroomResultUpdate({ affWin: null, judgeDecision: null }, verified)).toEqual({
      status: "verified",
      affWin: false,
      judgeDecision: "3-0",
      judges: "Emilio Lois, Angelina Tan, Tanisha Sonkusare",
      squirrels: "",
      tournamentId: 35001,
    });
  });
});
