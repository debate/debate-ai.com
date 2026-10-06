import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TournamentsApp } from "../src/ui";
import { createTournamentsClient } from "../src/ui/client";
import { ResultSetView } from "../src/ui/pages/ResultSetPage";

describe("TournamentsApp", () => {
  it("server-renders the loading state for a tournament page", () => {
    const html = renderToString(<TournamentsApp segments={["12", "rounds"]} />);
    expect(html).toContain("Loading");
  });

  it("renders a not-found note for unknown paths", () => {
    expect(renderToString(<TournamentsApp segments={["nope"]} />)).toContain("does not exist");
  });
});

describe("ResultSetView", () => {
  // Real payload from api.tabroom.com for tourn 40663 / result set 461590: a
  // bracket set carrying `rounds` and no `results` key, which used to throw
  // `Cannot read properties of undefined (reading 'length')`.
  const bracket = { id: 461590, tag: "bracket", label: "Bracket", Event: { id: 386573, name: "Open", abbr: "CX-O" }, rounds: { 7: {} } };

  it("renders a bracket set that has no results array", () => {
    const html = renderToString(<ResultSetView set={bracket} />);
    expect(html).toContain("Open — ");
    expect(html).toContain("Bracket");
    expect(html).toContain("Tabroom Classic");
  });

  it("renders an empty note when results are missing on a scored set", () => {
    expect(renderToString(<ResultSetView set={{ id: 1, tag: "rank", label: "Rank" }} />)).toContain("No results in this set");
  });

  it("renders the placement table when results are present", () => {
    const html = renderToString(
      <ResultSetView
        set={{ id: 1, tag: "rank", label: "Rank", results: [{ place: "1st", Entry: { id: 7, code: "AAA", name: null }, School: { id: 2, code: null, name: "State" } }] }}
      />,
    );
    expect(html).toContain("1st");
    expect(html).toContain("AAA");
    expect(html).toContain("State");
  });

  it("adds Tabroom's tiebreak columns from the set's headers", () => {
    const html = renderToString(
      <ResultSetView
        set={{
          id: 1,
          tag: "final",
          label: "Final Places",
          headers: { "2": { tag: "Pts", description: "Speaker points" }, "1": { tag: "W", description: "Wins" } },
          results: [{ place: "1st", Entry: { id: 7, code: "AAA", name: null }, values: { "1": "5", "2": "57.6" } }],
        }}
      />,
    );
    expect(html.indexOf(">W<")).toBeLessThan(html.indexOf(">Pts<"));
    expect(html).toContain("57.6");
  });

  it("draws a bracket set's rounds, bolding the entries that advanced", () => {
    const html = renderToString(
      <ResultSetView
        set={{
          id: 2,
          tag: "bracket",
          label: "Elimination Bracket",
          rounds: {
            9: { label: "Semifinals", order: 1, Sections: { 1: { Entries: { 1: { id: 1, code: "AA" }, 2: { id: 2, code: "BB" } } }, 2: { Entries: { 1: { id: 3, code: "CC" }, 2: { id: 4, code: "DD" } } } } },
            10: { label: "Finals", order: 2, Sections: { 1: { room: "Auditorium", Entries: { 1: { id: 1, code: "AA" }, 2: { id: 4, code: "DD" } } } } },
          },
        }}
      />,
    );
    expect(html.indexOf("Semifinals")).toBeLessThan(html.indexOf("Finals<"));
    expect(html).toMatch(/font-semibold">AA</);
    expect(html).toMatch(/text-muted-foreground">BB</);
    expect(html).toContain("Auditorium");
    expect(html).not.toContain("Tabroom Classic");
  });

  it("names the speaker on speaker-award rows", () => {
    const html = renderToString(
      <ResultSetView
        set={{
          id: 3,
          tag: "entry",
          label: "Speaker Awards",
          results: [{ place: "1st Speaker", Student: { id: 9, first: "Maya", last: "Chen" }, Entry: { id: 7, code: "BV CR", name: "Chen & Ramirez" } }],
        }}
      />,
    );
    expect(html).toContain("Speaker</th>");
    expect(html).toContain("Maya Chen");
  });

  it("notes a missing result set", () => {
    expect(renderToString(<ResultSetView set={undefined} />)).toContain("not found");
  });
});

describe("createTournamentsClient", () => {
  it("builds API paths and surfaces problem details", async () => {
    const calls: string[] = [];
    const client = createTournamentsClient("/api/t/", async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ detail: "No such tournament found" }), { status: 404 });
    });
    await expect(client.round(3, "PF", "2")).rejects.toThrow("No such tournament found");
    // Live Tabroom serves a round only under `/results`, so a 404 tries that too.
    expect(calls).toEqual(["/api/t/pages/invite/3/PF/2", "/api/t/pages/invite/3/PF/2/results"]);
  });
});

describe("createTournamentsClient with live Tabroom", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const row = (tournId: number, name: string) => ({ id: `${tournId}-0`, tournId, name, webname: null, location: null, state: null, country: null, start: "", end: "" });

  function fakeApis(routes: Record<string, unknown>) {
    const calls: string[] = [];
    const client = createTournamentsClient(
      "/api/tabroom",
      async (url) => {
        calls.push(String(url));
        const body = routes[String(url)];
        return body === undefined ? json({ detail: "Not found" }, 404) : json(body);
      },
      { liveApiBase: "/api/tabroom-beta" },
    );
    return { client, calls };
  }

  it("lists hosted tournaments first, then live ones, each tagged with its source", async () => {
    const { client, calls } = fakeApis({
      "/api/tabroom/host/demo": { tournId: 90001 },
      "/api/tabroom/pages/invite/upcoming": [row(90001, "Bay Area Invitational")],
      "/api/tabroom-beta/pages/invite/upcoming": [row(38436, "Yale Invitational"), row(90001, "Clash")],
    });
    const rows = await client.upcoming();
    expect(rows.map((r) => [r.tournId, r.source])).toEqual([
      [90001, "hosted"],
      [38436, "tabroom"],
    ]);
    expect(calls).toContain("/api/tabroom/host/demo");
    expect(client.sourceOf(38436)).toBe("tabroom");
  });

  it("still lists live tournaments when the hosted API is down", async () => {
    const { client } = fakeApis({ "/api/tabroom-beta/pages/invite/upcoming": [row(38436, "Yale Invitational")] });
    expect((await client.upcoming()).map((r) => r.tournId)).toEqual([38436]);
  });

  it("reads a tournament this site does not host from live Tabroom", async () => {
    const { client, calls } = fakeApis({
      "/api/tabroom-beta/rest/tourns/38436/invite": { id: 38436, name: "Yale Invitational" },
      "/api/tabroom-beta/rest/tourns/38436/results": {},
    });
    expect((await client.invite(38436)).name).toBe("Yale Invitational");
    await client.results(38436);
    expect(calls).toEqual([
      "/api/tabroom/rest/tourns/38436/invite",
      "/api/tabroom-beta/rest/tourns/38436/invite",
      "/api/tabroom-beta/rest/tourns/38436/results",
    ]);
    expect(client.sourceOf(38436)).toBe("tabroom");
  });

  it("prefers the hosted copy of a tournament", async () => {
    const { client, calls } = fakeApis({
      "/api/tabroom/rest/tourns/90001/invite": { id: 90001, name: "Bay Area Invitational" },
      "/api/tabroom/rest/tourns/90001/rounds": [],
    });
    await client.rounds(90001);
    expect(calls).toEqual(["/api/tabroom/rest/tourns/90001/invite", "/api/tabroom/rest/tourns/90001/rounds"]);
    expect(client.sourceOf(90001)).toBe("hosted");
  });

  it("links posted documents to Tabroom's file store", () => {
    const { client } = fakeApis({});
    expect(client.fileUrl(38436, { id: 71154, filename: "HST2026W9.pdf" })).toBe(
      "https://s3.amazonaws.com/tabroom-files/tourns/38436/postings/71154/HST2026W9.pdf",
    );
    expect(client.fileUrl(38436, { id: 1, filename: null })).toBeNull();
  });
});
