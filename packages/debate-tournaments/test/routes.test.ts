import { describe, expect, it } from "vitest";
import { matchTournamentRoute, tournamentHrefs } from "../src/routes";

describe("matchTournamentRoute", () => {
  it.each([
    [[], { page: "upcoming" }],
    [["12"], { page: "tournament", tournId: 12 }],
    [["12", "rounds"], { page: "rounds", tournId: 12 }],
    [["12", "rounds", "LD", "3"], { page: "round", tournId: 12, eventAbbr: "LD", roundName: "3" }],
    [["12", "results"], { page: "results", tournId: 12 }],
    [["12", "results", "99"], { page: "resultSet", tournId: 12, resultSetId: 99 }],
    [["abc"], { page: "notFound" }],
    [["12", "results", "x"], { page: "notFound" }],
    [["12", "nope"], { page: "notFound" }],
  ])("%j", (segments, route) => {
    expect(matchTournamentRoute(segments)).toEqual(route);
  });

  it("round-trips hrefs", () => {
    const hrefs = tournamentHrefs("/tournaments/");
    const href = hrefs.round(12, "Public Forum", 2);
    expect(href).toBe("/tournaments/12/rounds/Public%20Forum/2");
    const segments = href.split("/").slice(2);
    expect(matchTournamentRoute(segments)).toEqual({ page: "round", tournId: 12, eventAbbr: "Public Forum", roundName: "2" });
  });
});
