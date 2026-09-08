import { beforeEach, describe, expect, it } from "vitest";
import {
  buildStandingsFromStore,
  bulkImportTournamentResults,
  deleteTournamentResult,
  listTournamentResults,
  listTournamentResultsForTeam,
  saveTournamentResult,
  type TournamentResultRecord,
} from "../src/state/tournamentResults";
import { savePersistedQualificationPointsTable } from "../src/state/qualificationPointsTable";
import type { QualificationPointsTable } from "../src/rankings/ndca-standings";

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

  it("scores with a persisted custom qualification points table when none is passed explicitly", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    const defaultScored = buildStandingsFromStore();

    const customTable: QualificationPointsTable = {
      outroundPoints: {
        champion: 0,
        finalist: 0,
        semifinalist: 0,
        quarterfinalist: 1000,
        octofinalist: 0,
        doubleOctofinalist: 0,
        tripleOctofinalist: 0,
        prelims: 0,
      },
      pointsPerPrelimWin: 0,
      bidLevelBonusRate: 0,
    };
    savePersistedQualificationPointsTable(customTable);

    const customScored = buildStandingsFromStore();
    expect(customScored[0].totalPoints).toBe(1000);
    expect(customScored[0].totalPoints).not.toBe(defaultScored[0].totalPoints);
  });

  it("still honors an explicitly passed pointsTable over a persisted custom one", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    savePersistedQualificationPointsTable({
      outroundPoints: {
        champion: 999,
        finalist: 999,
        semifinalist: 999,
        quarterfinalist: 999,
        octofinalist: 999,
        doubleOctofinalist: 999,
        tripleOctofinalist: 999,
        prelims: 999,
      },
      pointsPerPrelimWin: 999,
      bidLevelBonusRate: 999,
    });

    const explicitTable: QualificationPointsTable = {
      outroundPoints: {
        champion: 0,
        finalist: 0,
        semifinalist: 0,
        quarterfinalist: 7,
        octofinalist: 0,
        doubleOctofinalist: 0,
        tripleOctofinalist: 0,
        prelims: 0,
      },
      pointsPerPrelimWin: 0,
      bidLevelBonusRate: 0,
    };

    expect(buildStandingsFromStore({ pointsTable: explicitTable })[0].totalPoints).toBe(7);
  });
});

describe("bulkImportTournamentResults", () => {
  it("imports every well-formed row and appends to existing history", () => {
    saveTournamentResult(WXYZ_BERKELEY);
    const csv = [
      "teamId,tournamentName,date,division,bidLevel,finish,prelimWins,prelimLosses",
      "abcd,Harvard,2026-02-01,PF,1,finalist,5,1",
    ].join("\n");

    const result = bulkImportTournamentResults(csv);

    expect(result).toEqual({ importedCount: 1, skippedCount: 0, errors: [] });
    expect(listTournamentResults()).toHaveLength(2);
    expect(listTournamentResultsForTeam("abcd")[0]).toMatchObject({
      teamId: "abcd",
      tournamentName: "Harvard",
      finish: "finalist",
    });
  });

  it("assigns a unique id per imported row so re-importing the same batch doesn't collide", () => {
    const csv = [
      "teamId,tournamentName,date,division,finish",
      "wxyz,Berkeley,2026-01-10,PF,champion",
      "wxyz,Berkeley,2026-01-10,PF,champion",
    ].join("\n");

    bulkImportTournamentResults(csv);

    const ids = listTournamentResults().map((record) => record.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("reports skipped rows without importing anything from them", () => {
    const csv = ["teamId,tournamentName,date,division,finish", ",Berkeley,2026-01-10,PF,champion"].join(
      "\n",
    );

    const result = bulkImportTournamentResults(csv);

    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(listTournamentResults()).toEqual([]);
  });

  it("makes newly imported results count toward standings", () => {
    const csv = ["teamId,tournamentName,date,division,finish", "wxyz,Berkeley,2026-01-10,PF,champion"].join(
      "\n",
    );

    bulkImportTournamentResults(csv);

    const standings = buildStandingsFromStore();
    expect(standings).toHaveLength(1);
    expect(standings[0].teamId).toBe("wxyz");
    expect(standings[0].bestFinish).toBe("champion");
  });
});
