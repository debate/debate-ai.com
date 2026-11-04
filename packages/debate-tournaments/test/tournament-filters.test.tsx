import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { TournamentsApp } from "../src/ui";
import { createTournamentsClient, pastDates } from "../src/ui/client";
import { circuitChoices, circuitsOf, filterTournaments, stateChoices } from "../src/ui/pages/UpcomingTournamentsPage";

const row = (name: string, state: string | null, circuits: string | null) => ({
  name,
  state,
  circuits,
  location: null,
  events: null,
  eventTypes: null,
});

describe("tournament list filters", () => {
  const rows = [row("Yale", "CT", "NDCA, TOC"), row("Glenbrooks", "IL", "TOC"), row("Local", "IL", null), row("Overseas", null, "WSDC")];

  it("filters by state and circuit, case-insensitively", () => {
    expect(filterTournaments(rows, { state: "il" }).map((t) => t.name)).toEqual(["Glenbrooks", "Local"]);
    expect(filterTournaments(rows, { circuit: "toc" }).map((t) => t.name)).toEqual(["Yale", "Glenbrooks"]);
    expect(filterTournaments(rows, { state: "IL", circuit: "TOC" }).map((t) => t.name)).toEqual(["Glenbrooks"]);
    expect(filterTournaments(rows, { query: "yale", circuit: "TOC" }).map((t) => t.name)).toEqual(["Yale"]);
    expect(filterTournaments(rows, {})).toHaveLength(4);
  });

  it("lists each state once, alphabetically", () => {
    expect(stateChoices(rows)).toEqual(["CT", "IL"]);
  });

  it("merges active circuits with circuits the upcoming list names", () => {
    expect(circuitsOf(rows[0])).toEqual(["NDCA", "TOC"]);
    const choices = circuitChoices(
      [{ abbr: "NDCA", name: "National Debate Coaches Association", state: null, country: "US", tournCount: 1, ids: { tabroom: 7 } }],
      rows,
    );
    expect(choices.map((c) => c.abbr)).toEqual(["NDCA", "TOC", "WSDC"]);
    expect(choices[0].name).toBe("National Debate Coaches Association");
  });
});

describe("past tournaments and circuits", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  function fake(routes: (url: string) => unknown) {
    const calls: string[] = [];
    const client = createTournamentsClient(
      "/api/tabroom",
      async (url) => {
        calls.push(String(url));
        const body = routes(String(url));
        return body === undefined ? new Response(JSON.stringify({ detail: "Not found" }), { status: 404 }) : json(body);
      },
      { liveApiBase: "/api/tabroom-beta" },
    );
    return { client, calls };
  }

  it("lists past tournaments with results from both sources, newest first", async () => {
    const { client, calls } = fake((url) => {
      if (url.startsWith("/api/tabroom/rest/tourns?")) return [{ id: 1, name: "Hosted Classic", start: "2026-10-01 14:00:00", end: "2026-10-02 23:00:00", city: "Austin", state: "TX" }];
      if (url.startsWith("/api/tabroom-beta/rest/tourns?"))
        return [
          { id: 2, name: "Old Open", start: "2026-09-20 14:00:00", end: "2026-09-21 23:00:00", state: "CA" },
          { id: 3, name: "New Open", start: "2026-10-20 14:00:00", end: "2026-10-20 23:00:00", state: "IL" },
        ];
      return undefined;
    });
    const rows = await client.pastTournaments({ now: new Date("2026-11-04T00:00:00Z") });
    expect(rows.map((r) => [r.tournId, r.source])).toEqual([
      [3, "tabroom"],
      [1, "hosted"],
      [2, "tabroom"],
    ]);
    expect(rows[1]).toMatchObject({ location: "Austin", state: "TX", fullDates: "Oct 1, 2026 – Oct 2, 2026" });
    const query = new URL(calls[0], "http://x").searchParams;
    expect(query.get("publishedResults")).toBe("true");
    expect(query.get("startBefore")).toBe("2026-11-04T00:00:00.000Z");
    expect(query.get("startAfter")).toBe("2026-09-05T00:00:00.000Z");
    expect(client.sourceOf(3)).toBe("tabroom");
  });

  it("sends a circuit upstream by each source's id and skips sources without it", async () => {
    const { client, calls } = fake((url) => (url.includes("/rest/tourns?") ? [] : undefined));
    await client.pastTournaments({ circuit: { abbr: "TOC", name: "TOC", state: null, country: null, tournCount: 3, ids: { tabroom: 42 } } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/api/tabroom-beta/rest/tourns?");
    expect(new URL(calls[0], "http://x").searchParams.get("circuit")).toBe("42");
  });

  it("merges active circuits by abbreviation across sources", async () => {
    const { client } = fake((url) => {
      if (url.startsWith("/api/tabroom/rest/circuits/active")) return [{ id: 5, abbr: "TOC", name: "Tournament of Champions", tournCount: 1 }];
      if (url.startsWith("/api/tabroom-beta/rest/circuits/active"))
        return [
          { id: 42, abbr: "toc", name: "Tournament of Champions", tournCount: 30 },
          { id: 9, abbr: "NSDA", name: "National Speech & Debate Association", tournCount: 80 },
        ];
      return undefined;
    });
    const circuits = await client.activeCircuits();
    expect(circuits.map((c) => [c.abbr, c.tournCount, c.ids])).toEqual([
      ["NSDA", 80, { tabroom: 9 }],
      ["TOC", 31, { hosted: 5, tabroom: 42 }],
    ]);
  });

  it("formats past dates", () => {
    expect(pastDates("2026-10-20 14:00:00", "2026-10-20 23:00:00")).toBe("Oct 20, 2026");
    expect(pastDates(null, null)).toBe("");
  });
});

describe("Tournaments top bar", () => {
  it("server-renders the state and circuit dropdowns and the Results button", () => {
    const html = renderToString(<TournamentsApp segments={[]} />);
    expect(html).toContain('aria-label="Filter by state"');
    expect(html).toContain("All states");
    expect(html).toContain('aria-label="Filter by circuit"');
    expect(html).toContain("All circuits");
    expect(html).toContain("Results");
  });
});
