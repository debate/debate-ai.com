import { describe, expect, it } from "vitest";
import {
  CaselistApiError,
  caselistRoundLabel,
  caselistSideLabel,
  caselistsForFormat,
  createCaselistClient,
  listCaselistTeams,
  matchCaselistSchool,
  matchCaselistTeam,
  rankedTeamLastNames,
  scrapeTeam,
  tokenFromSetCookie,
  type CaselistInfo,
  type CaselistTeam,
} from "../../src/caselist/caselist-api";
import { citesMarkdown, parseFormat, parseTeamsArgs } from "../../src/caselist/caselist-teams-cli";

const team = (name: string, last1: string, last2?: string): CaselistTeam => ({
  team_id: 1,
  school_id: 1,
  name,
  display_name: `Harker ${name}`,
  debater1_first: "A",
  debater1_last: last1,
  debater2_first: last2 ? "B" : null,
  debater2_last: last2 ?? null,
});

/** A fake API: routes by path, records every request. */
function fakeApi(routes: Record<string, unknown>, options: { loginCookie?: string } = {}) {
  const calls: { url: string; cookie: string | null; method: string }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, cookie: headers.get("cookie"), method: init?.method ?? "GET" });
    const path = url.replace("https://api.opencaselist.com/v1", "");
    if (path === "/login") {
      return new Response("{}", {
        status: 201,
        headers: options.loginCookie ? { "set-cookie": options.loginCookie } : {},
      });
    }
    if (!(path in routes)) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    const body = routes[path];
    if (body instanceof Uint8Array) return new Response(new Blob([body as Uint8Array<ArrayBuffer>]));
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe("createCaselistClient", () => {
  it("sends the token as the caselist_token cookie and encodes path segments", async () => {
    const { calls, fetchImpl } = fakeApi({ "/caselists/hspf25/schools/Glenbrook%20North/teams": [] });
    const client = createCaselistClient({ token: "abc", fetch: fetchImpl });
    await client.teams("hspf25", "Glenbrook North");
    expect(calls[0]).toMatchObject({ cookie: "caselist_token=abc" });
  });

  it("logs in with Tabroom credentials once and reuses the token", async () => {
    const { calls, fetchImpl } = fakeApi(
      { "/caselists": [], "/caselists/hspf25/schools": [] },
      { loginCookie: "caselist_token=tok123; Path=/; SameSite=Lax" },
    );
    const client = createCaselistClient({ username: "u", password: "p", fetch: fetchImpl });
    await client.caselists();
    await client.schools("hspf25");
    expect(calls.filter((call) => call.url.endsWith("/login"))).toHaveLength(1);
    expect(calls.at(-1)?.cookie).toBe("caselist_token=tok123");
  });

  it("throws a 401 CaselistApiError without a token or credentials", async () => {
    const client = createCaselistClient({ fetch: fakeApi({}).fetchImpl });
    await expect(client.caselists()).rejects.toMatchObject({ name: "CaselistApiError", status: 401 });
  });

  it("surfaces the server's message on an error", async () => {
    const client = createCaselistClient({ token: "t", fetch: fakeApi({}).fetchImpl });
    const error = await client.schools("nope").catch((e) => e);
    expect(error).toBeInstanceOf(CaselistApiError);
    expect(error.status).toBe(404);
  });
});

describe("tokenFromSetCookie", () => {
  it("finds the token among several cookies", () => {
    expect(tokenFromSetCookie("caselist_user_id=1; Path=/, caselist_token=xyz; Path=/")).toBe("xyz");
    expect(tokenFromSetCookie(null)).toBeNull();
  });
});

describe("scrapeTeam", () => {
  const base = "/caselists/hspf25/schools/Harker/teams/LiLe";
  const routes = {
    [base]: team("LiLe", "Lin", "Lee"),
    [`${base}/rounds`]: [
      { round_id: 1, team_id: 1, side: "A", tournament: "Blake", round: "1", opponent: "X", judge: "J", report: "1AC Space", opensource: "hspf25/Harker/LiLe/a.docx", video: null },
      { round_id: 2, team_id: 1, side: "N", tournament: "Blake", round: "13", opponent: "Y", judge: null, report: null, opensource: null, video: null },
    ],
    [`${base}/cites`]: [{ cite_id: 9, round_id: 1, title: "1AC - Space", cites: "**Smith 21**", side: "A", tournament: "Blake", round: "1" }],
    "/download?path=hspf25%2FHarker%2FLiLe%2Fa.docx": new Uint8Array([1, 2, 3]),
  };

  it("returns the team, rounds and cites without downloading by default", async () => {
    const { calls, fetchImpl } = fakeApi(routes);
    const page = await scrapeTeam(createCaselistClient({ token: "t", fetch: fetchImpl }), "hspf25", "Harker", "LiLe");
    expect(page.rounds).toHaveLength(2);
    expect(page.cites[0].title).toBe("1AC - Space");
    expect(page.files).toEqual([]);
    expect(calls.some((call) => call.url.includes("/download"))).toBe(false);
  });

  it("downloads each open-source file when asked", async () => {
    const { fetchImpl } = fakeApi(routes);
    const page = await scrapeTeam(createCaselistClient({ token: "t", fetch: fetchImpl }), "hspf25", "Harker", "LiLe", {
      downloadFiles: true,
      downloadDelayMs: 0,
    });
    expect(page.files).toHaveLength(1);
    expect(page.files[0]).toMatchObject({ fileName: "a.docx" });
    expect([...page.files[0].bytes]).toEqual([1, 2, 3]);
  });

  it("renders the cites as markdown grouped by side", async () => {
    const { fetchImpl } = fakeApi(routes);
    const page = await scrapeTeam(createCaselistClient({ token: "t", fetch: fetchImpl }), "hspf25", "Harker", "LiLe");
    const markdown = citesMarkdown(page, "pf");
    expect(markdown).toContain("## Pro");
    expect(markdown).toContain("### 1AC - Space");
    expect(markdown).toContain("_Blake | R1_");
  });
});

describe("listCaselistTeams", () => {
  it("lists every team of every school, skipping a school that fails", async () => {
    const { fetchImpl } = fakeApi({
      "/caselists/hspf25/schools": [
        { school_id: 1, caselist_id: 1, name: "Harker", display_name: "Harker", state: "CA" },
        { school_id: 2, caselist_id: 1, name: "Broken", display_name: "Broken", state: null },
      ],
      "/caselists/hspf25/schools/Harker/teams": [team("LiLe", "Lin", "Lee")],
    });
    const rows = await listCaselistTeams(createCaselistClient({ token: "t", fetch: fetchImpl }), "hspf25");
    expect(rows).toEqual([
      {
        caselist: "hspf25",
        school: "Harker",
        schoolDisplayName: "Harker",
        team: "LiLe",
        teamDisplayName: "Harker LiLe",
        debaters: ["Lin", "Lee"],
      },
    ]);
  });
});

describe("matching a ranked team", () => {
  it("splits ranked team names into surnames", () => {
    expect(rankedTeamLastNames("Lin & Lee")).toEqual(["Lin", "Lee"]);
    expect(rankedTeamLastNames("Jane Smith")).toEqual(["Smith"]);
    expect(rankedTeamLastNames("Lin-Lee")).toEqual(["Lin", "Lee"]);
  });

  it("matches schools by display name, then loosely", () => {
    const schools = [
      { name: "GlenbrookNorth", display_name: "Glenbrook North" },
      { name: "Harker", display_name: "Harker" },
    ];
    expect(matchCaselistSchool(schools, "Glenbrook North")?.name).toBe("GlenbrookNorth");
    expect(matchCaselistSchool(schools, "The Harker School")?.name).toBe("Harker");
    expect(matchCaselistSchool(schools, "Nowhere")).toBeNull();
  });

  it("matches teams by surnames in any order, then by team code", () => {
    const teams = [team("LiLe", "Lin", "Lee"), team("SmJo", "Smith", "Jones")];
    expect(matchCaselistTeam(teams, ["Lee", "Lin"])?.name).toBe("LiLe");
    const masked = [{ ...team("SmJo", "Sm.....", "Jo....."), name: "SmJo" }];
    expect(matchCaselistTeam(masked, ["Smith", "Jones"])?.name).toBe("SmJo");
    expect(matchCaselistTeam(teams, ["Nobody"])).toBeNull();
  });
});

describe("formats and labels", () => {
  const caselists = [
    { name: "ndtceda25", event: "cx", level: "college", year: 2025 },
    { name: "hspolicy25", event: "cx", level: "hs", year: 2025 },
    { name: "hspf24", event: "pf", level: "hs", year: 2024 },
    { name: "hspf25", event: "pf", level: "hs", year: 2025 },
  ] as CaselistInfo[];

  it("picks caselists by format, newest first", () => {
    expect(caselistsForFormat(caselists, "pf").map((c) => c.name)).toEqual(["hspf25", "hspf24"]);
    expect(caselistsForFormat(caselists, "policy", "college").map((c) => c.name)).toEqual(["ndtceda25"]);
    expect(parseFormat("ceda")).toEqual({ event: "policy", level: "college" });
  });

  it("labels rounds and sides", () => {
    expect(caselistRoundLabel("3")).toBe("R3");
    expect(caselistRoundLabel("13")).toBe("Quarters");
    expect(caselistSideLabel("A", "pf")).toBe("Pro");
    expect(caselistSideLabel("N", "cx")).toBe("Neg");
  });

  it("parses CLI arguments", () => {
    expect(parseTeamsArgs(["team", "hspf25", "Harker", "LiLe", "--files", "--out=x"])).toEqual({
      command: "team",
      positional: ["hspf25", "Harker", "LiLe"],
      flags: { files: true, out: "x" },
    });
  });
});
