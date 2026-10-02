import { describe, expect, it } from "vitest";
import {
  decideEvent,
  decidePanel,
  decideRating,
  entryOutcomeId,
  positionsFromBets,
  settlePayouts,
  type PanelBallot,
} from "../src/settle";

describe("settlePayouts", () => {
  const bets = [
    { userId: "a", outcomeId: "yes", stake: 100, shares: 150.6 },
    { userId: "a", outcomeId: "yes", stake: 50, shares: 60.6 },
    { userId: "b", outcomeId: "no", stake: 200, shares: 300 },
  ];

  it("pays one point per winning share, rounded down once per person", () => {
    expect(settlePayouts(bets, "yes")).toEqual(new Map([["a", 211]]));
  });

  it("pays nothing to losers", () => {
    expect(settlePayouts(bets, "no")).toEqual(new Map([["b", 300]]));
  });

  it("refunds every stake when voided", () => {
    expect(settlePayouts(bets, null)).toEqual(new Map([["a", 150], ["b", 200]]));
  });
});

describe("positionsFromBets", () => {
  it("sums shares and stakes per outcome", () => {
    expect(
      positionsFromBets([
        { outcomeId: "o1", stake: 10, shares: 15 },
        { outcomeId: "o1", stake: 5, shares: 6 },
        { outcomeId: "o2", stake: 1, shares: 2 },
      ]),
    ).toEqual([
      { outcomeId: "o1", shares: 21, staked: 15 },
      { outcomeId: "o2", shares: 2, staked: 1 },
    ]);
  });
});

const ballot = (judge: number, entry: number, win: boolean | null, extra: Partial<PanelBallot> = {}): PanelBallot => ({
  judge,
  entry,
  win,
  bye: false,
  forfeit: false,
  ...extra,
});

describe("decidePanel", () => {
  it("waits for ballots", () => {
    expect(decidePanel([])).toEqual({ status: "pending" });
    expect(decidePanel([ballot(1, 10, null), ballot(1, 11, null)])).toEqual({ status: "pending" });
  });

  it("waits until every judge on a panel has voted", () => {
    expect(
      decidePanel([ballot(1, 10, true), ballot(1, 11, false), ballot(2, 10, null), ballot(2, 11, null)]),
    ).toEqual({ status: "pending" });
  });

  it("gives a one-judge round to the winning ballot", () => {
    const decision = decidePanel([ballot(1, 10, false), ballot(1, 11, true)]);
    expect(decision).toMatchObject({ status: "winner", outcomeId: entryOutcomeId(11) });
  });

  it("gives a panel to the majority", () => {
    const decision = decidePanel([
      ballot(1, 10, true), ballot(1, 11, false),
      ballot(2, 10, false), ballot(2, 11, true),
      ballot(3, 10, true), ballot(3, 11, false),
    ]);
    expect(decision).toEqual({ status: "winner", outcomeId: "entry:10", note: "Won on 2 of 3 ballots." });
  });

  it("voids byes, forfeits and even splits", () => {
    expect(decidePanel([ballot(1, 10, true, { bye: true })]).status).toBe("void");
    expect(decidePanel([ballot(1, 10, true, { forfeit: true })]).status).toBe("void");
    expect(
      decidePanel([ballot(1, 10, true), ballot(1, 11, false), ballot(2, 10, false), ballot(2, 11, true)]).status,
    ).toBe("void");
  });
});

describe("decideEvent", () => {
  it("ignores prelim seeds and unpublished results", () => {
    expect(
      decideEvent([
        { label: "Prelim Seeds", bracket: false, published: true, topEntry: 5 },
        { label: "Final Places", bracket: false, published: false, topEntry: 6 },
      ]),
    ).toEqual({ status: "pending" });
  });

  it("takes the first entry of a published final result set", () => {
    expect(
      decideEvent([
        { label: "Prelim Seeds", bracket: false, published: true, topEntry: 5 },
        { label: "Final Places", bracket: false, published: true, topEntry: 6 },
      ]),
    ).toMatchObject({ status: "winner", outcomeId: "entry:6" });
    expect(decideEvent([{ label: null, bracket: true, published: true, topEntry: 7 }])).toMatchObject({
      outcomeId: "entry:7",
    });
  });
});

describe("decideRating", () => {
  it("waits for the close", () => {
    expect(decideRating(50, 60, false)).toEqual({ status: "pending" });
  });

  it("resolves yes on a rise and no on a fall or no change", () => {
    expect(decideRating(50, 60, true)).toMatchObject({ outcomeId: "yes" });
    expect(decideRating(50, 40, true)).toMatchObject({ outcomeId: "no", note: "Rating fell from 50.0 to 40.0." });
    expect(decideRating(50, 50, true)).toMatchObject({ outcomeId: "no", note: "Rating held at 50.0." });
  });

  it("voids when the team left the rankings", () => {
    expect(decideRating(50, null, true).status).toBe("void");
  });
});
