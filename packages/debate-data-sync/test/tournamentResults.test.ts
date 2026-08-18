import { beforeEach, describe, expect, it } from "vitest";
import {
  buildStandingsFromStore,
  deleteTournamentResult,
  listTournamentResults,
  listTournamentResultsForTeam,
  saveTournamentResult,
  type TournamentResultRecord,
} from "../src/state/tournamentResults";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const WXYZ_BERKELEY: TournamentResultRecord = {
  id: "wxyz-berkeley",
  teamId: "wxyz",
  tournamentName: "Berkeley",
  date: "2026-01-01",
  division: "PF",
  bidLevel: 1,
  finish: "quarterfinalist",
  prelimWins: 5,
  prelimLosses: 1,
};

const WXYZ_HARVARD: TournamentResultRecord = {
  id: "wxyz-harvard",
  teamId: "wxyz",
  tournamentName: "Harvard",
  date: "2026-02-01",
  division: "PF",
  bidLevel: 2,
  finish: "octofinalist",
  prelimWins: 4,
  prelimLosses: 2,
};

const ABCD_BERKELEY: TournamentResultRecord = {
  id: "abcd-berkeley",
  teamId: "abcd",
  tournamentName: "Berkeley",
  date: "2026-01-01",
  division: "PF",
  bidLevel: 1,
  finish: "prelims",
  prelimWins: 2,
  prelimLosses: 4,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listTournamentResults", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listTournamentResults()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("tournamentResults", "{not json");
    expect(listTournamentResults()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("tournamentResults", JSON.stringify({ not: "an array" }));
    expect(listTournamentResults()).toEqual([]);
  });

  it("lists every saved result, in save order", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    saveTournamentResult(ABCD_BERKELEY);
    expect(listTournamentResults()).toEqual([WXYZ_BERKELEY, ABCD_BERKELEY]);
  });
});

describe("saveTournamentResult", () => {
  it("appends rather than overwriting — a team can have many results", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    saveTournamentResult(WXYZ_HARVARD);
    expect(listTournamentResults()).toEqual([WXYZ_BERKELEY, WXYZ_HARVARD]);
  });
});

describe("listTournamentResultsForTeam", () => {
  it("filters to only the given team's results", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    saveTournamentResult(WXYZ_HARVARD);
    saveTournamentResult(ABCD_BERKELEY);

    expect(listTournamentResultsForTeam("wxyz")).toEqual([WXYZ_BERKELEY, WXYZ_HARVARD]);
    expect(listTournamentResultsForTeam("missing")).toEqual([]);
  });
});

describe("deleteTournamentResult", () => {
  it("removes a stored result by id", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    saveTournamentResult(ABCD_BERKELEY);
    deleteTournamentResult("wxyz-berkeley");

    expect(listTournamentResults()).toEqual([ABCD_BERKELEY]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveTournamentResult(ABCD_BERKELEY);
    deleteTournamentResult("missing");
    expect(listTournamentResults()).toEqual([ABCD_BERKELEY]);
  });
});

describe("buildStandingsFromStore", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildStandingsFromStore()).toEqual([]);
  });

  it("groups every persisted result by teamId and ranks the standings", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    saveTournamentResult(WXYZ_HARVARD);
    saveTournamentResult(ABCD_BERKELEY);

    const standings = buildStandingsFromStore();

    expect(standings.map((s) => s.teamId)).toEqual(["wxyz", "abcd"]);
    expect(standings[0].rank).toBe(1);
    expect(standings[0].tournamentsAttended).toBe(2);
    expect(standings[1].rank).toBe(2);
    expect(standings[1].tournamentsAttended).toBe(1);
  });

  it("honors BuildStandingsOptions like countBestN", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    saveTournamentResult(WXYZ_HARVARD);

    const capped = buildStandingsFromStore({ countBestN: 1 });
    const uncapped = buildStandingsFromStore();

    expect(capped[0].tournamentsCounted).toBe(1);
    expect(uncapped[0].tournamentsCounted).toBe(2);
    expect(capped[0].totalPoints).toBeLessThan(uncapped[0].totalPoints);
  });
});
