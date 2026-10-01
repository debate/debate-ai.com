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
    expect(calls).toEqual(["/api/t/pages/invite/3/PF/2"]);
  });
});
