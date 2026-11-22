/** @fileoverview Debate History's search, result filter, tally and labels. */
import { describe, expect, it } from "vitest";
import {
  DEBATE_HISTORY_RESULT_OPTIONS,
  debateHistoryCountLabel,
  debateHistoryRecordLabel,
  debateHistoryResult,
  filterDebateHistory,
  tallyDebateHistory,
  toDebateHistoryResultFilter,
} from "../src/ui/history-filter";

const verdict = (winner: string) => JSON.stringify({ verdict: { winner, reason: "" } });

const rounds = [
  { id: "1", topic: "Tariffs on steel", botName: "Kant", outcome: verdict("User") },
  { id: "2", topic: "Nuclear deterrence", botName: "Machiavelli", outcome: verdict("Bot") },
  { id: "3", topic: "Tariffs on cars", botName: "Socrates", outcome: "User conceded" },
  { id: "4", topic: "Universal basic income", botName: "Kant", outcome: verdict("Draw") },
  { id: "5", topic: "Space colonization", botName: "Kant", outcome: "" },
];

describe("debateHistoryResult", () => {
  it("reads blank, concede and judged outcomes", () => {
    expect(debateHistoryResult(undefined)).toBe("inProgress");
    expect(debateHistoryResult("")).toBe("inProgress");
    expect(debateHistoryResult("User conceded")).toBe("conceded");
    expect(debateHistoryResult(verdict("User"))).toBe("won");
    expect(debateHistoryResult(verdict("bot"))).toBe("lost");
    expect(debateHistoryResult(verdict("DRAW"))).toBe("draw");
  });
});

describe("filterDebateHistory", () => {
  const ids = (list: { id: string }[]) => list.map((r) => r.id);

  it("returns every round, in order, with no filter", () => {
    expect(ids(filterDebateHistory(rounds))).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids(filterDebateHistory(rounds, { query: "   " }))).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("matches the topic or the opponent, case-insensitively, every word required", () => {
    expect(ids(filterDebateHistory(rounds, { query: "TARIFFS" }))).toEqual(["1", "3"]);
    expect(ids(filterDebateHistory(rounds, { query: "kant" }))).toEqual(["1", "4", "5"]);
    expect(ids(filterDebateHistory(rounds, { query: "tariffs kant" }))).toEqual(["1"]);
    expect(filterDebateHistory(rounds, { query: "fracking" })).toEqual([]);
  });

  it("narrows by result and combines with the search", () => {
    expect(ids(filterDebateHistory(rounds, { result: "won" }))).toEqual(["1"]);
    expect(ids(filterDebateHistory(rounds, { result: "conceded" }))).toEqual(["3"]);
    expect(ids(filterDebateHistory(rounds, { result: "inProgress" }))).toEqual(["5"]);
    expect(ids(filterDebateHistory(rounds, { query: "kant", result: "draw" }))).toEqual(["4"]);
    expect(filterDebateHistory(rounds, { query: "nuclear", result: "won" })).toEqual([]);
  });

  it("does not mutate the input", () => {
    const copy = [...rounds];
    filterDebateHistory(rounds, { query: "kant", result: "won" });
    expect(rounds).toEqual(copy);
  });
});

describe("toDebateHistoryResultFilter", () => {
  it("keeps a known option and falls back to all", () => {
    for (const { value } of DEBATE_HISTORY_RESULT_OPTIONS) expect(toDebateHistoryResultFilter(value)).toBe(value);
    expect(toDebateHistoryResultFilter("victory")).toBe("all");
    expect(toDebateHistoryResultFilter(undefined)).toBe("all");
  });
});

describe("tally and labels", () => {
  it("counts each result", () => {
    expect(tallyDebateHistory(rounds)).toEqual({ won: 1, lost: 1, draw: 1, conceded: 1, inProgress: 1 });
    expect(tallyDebateHistory([])).toEqual({ won: 0, lost: 0, draw: 0, conceded: 0, inProgress: 0 });
  });

  it("writes the record, leaving out zero draws and concedes", () => {
    expect(debateHistoryRecordLabel(tallyDebateHistory(rounds))).toBe("Record: 1–1 · 1 draw · 1 conceded");
    expect(debateHistoryRecordLabel({ won: 4, lost: 2, draw: 2, conceded: 0, inProgress: 3 })).toBe(
      "Record: 4–2 · 2 draws",
    );
    expect(debateHistoryRecordLabel({ won: 0, lost: 0, draw: 0, conceded: 0, inProgress: 2 })).toBeNull();
  });

  it("counts rounds, saying how many of the total a filter shows", () => {
    expect(debateHistoryCountLabel(1, 1)).toBe("1 round");
    expect(debateHistoryCountLabel(12, 12)).toBe("12 rounds");
    expect(debateHistoryCountLabel(3, 12)).toBe("3 of 12 rounds");
    expect(debateHistoryCountLabel(0, 1)).toBe("0 of 1 round");
  });
});
