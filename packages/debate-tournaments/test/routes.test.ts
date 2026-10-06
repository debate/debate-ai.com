import { describe, expect, it } from "vitest";
import { matchTournamentRoute, tournamentHrefs, tournamentSlug, tournamentSlugOf } from "../src/routes";

describe("matchTournamentRoute", () => {
  const yale = { year: 2026, slug: "yale-invitational" };
  it.each([
    [[], { page: "upcoming" }],
    [["host"], { page: "host" }],
    [["2026", "yale-invitational"], { page: "tournament", tourn: yale }],
    [["2026", "Yale-Invitational", "rounds"], { page: "rounds", tourn: yale }],
    [["2026", "yale-invitational", "rounds", "LD", "3"], { page: "round", tourn: yale, eventAbbr: "LD", roundName: "3" }],
    [["2026", "yale-invitational", "results"], { page: "results", tourn: yale }],
    [["2026", "yale-invitational", "results", "99"], { page: "resultSet", tourn: yale, resultSetId: 99 }],
    [["2026", "yale-invitational", "tabroom"], { page: "tabroom", tourn: yale }],
    [["2026", "yale-invitational", "admin"], { page: "admin", tourn: yale }],
    // The id form still resolves, including four-digit ids before a section.
    [["12"], { page: "tournament", tourn: { tournId: 12 } }],
    [["38436", "rounds"], { page: "rounds", tourn: { tournId: 38436 } }],
    [["12", "rounds", "LD", "3"], { page: "round", tourn: { tournId: 12 }, eventAbbr: "LD", roundName: "3" }],
    [["12", "results", "99"], { page: "resultSet", tourn: { tournId: 12 }, resultSetId: 99 }],
    [["5000", "results"], { page: "results", tourn: { tournId: 5000 } }],
    [["2026"], { page: "tournament", tourn: { tournId: 2026 } }],
    [["abc"], { page: "notFound" }],
    [["host", "x"], { page: "notFound" }],
    [["12", "results", "x"], { page: "notFound" }],
    [["12", "nope"], { page: "notFound" }],
    [["12", "tabroom", "extra"], { page: "notFound" }],
    [["2026", "yale-invitational", "nope"], { page: "notFound" }],
  ])("%j", (segments, route) => {
    expect(matchTournamentRoute(segments)).toEqual(route);
  });
});

describe("tournamentSlug", () => {
  it.each([
    ["Yale Invitational", "yale-invitational"],
    ["Heart of Texas Invitational", "heart-of-texas-invitational"],
    ["  St. Mark's — Greenhill Fall Classic  ", "st-marks-greenhill-fall-classic"],
    ["Café Cup & Gala 2026", "cafe-cup-and-gala-2026"],
  ])("%s → %s", (name, slug) => {
    expect(tournamentSlug(name)).toBe(slug);
  });

  it("dates a tournament by the UTC year it starts", () => {
    expect(tournamentSlugOf({ name: "Yale Invitational", start: "2026-10-02T12:00:00.000Z" })).toEqual({ year: 2026, slug: "yale-invitational" });
    expect(tournamentSlugOf({ name: "Yale Invitational", start: null })).toBeNull();
    expect(tournamentSlugOf({ name: "!!!", start: "2026-10-02T12:00:00.000Z" })).toBeNull();
  });
});

describe("tournamentHrefs", () => {
  const named = tournamentHrefs("/tournaments/", (id) => (id === 38436 ? { year: 2026, slug: "yale-invitational" } : null));

  it("links a named tournament by year and slug", () => {
    expect(named.tournament(38436)).toBe("/tournaments/2026/yale-invitational");
    expect(named.results(38436)).toBe("/tournaments/2026/yale-invitational/results");
    expect(named.resultSet(38436, 7)).toBe("/tournaments/2026/yale-invitational/results/7");
    expect(named.admin(38436)).toBe("/tournaments/2026/yale-invitational/admin");
  });

  it("falls back to the id for a tournament it cannot name", () => {
    expect(named.results(40242)).toBe("/tournaments/40242/results");
    expect(tournamentHrefs().rounds(12)).toBe("/tournaments/12/rounds");
  });

  it("round-trips hrefs", () => {
    const href = named.round(38436, "Public Forum", 2);
    expect(href).toBe("/tournaments/2026/yale-invitational/rounds/Public%20Forum/2");
    const route = matchTournamentRoute(href.split("/").slice(2));
    expect(route).toEqual({ page: "round", tourn: { year: 2026, slug: "yale-invitational" }, eventAbbr: "Public Forum", roundName: "2" });
    if (route.page !== "round") throw new Error("expected a round");
    expect(named.forRoute(route, 38436)).toBe(href);
    expect(named.forRoute({ page: "results", tourn: { tournId: 38436 } }, 38436)).toBe("/tournaments/2026/yale-invitational/results");
  });
});
