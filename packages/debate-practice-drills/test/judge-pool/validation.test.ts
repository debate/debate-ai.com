/**
 * @fileoverview Judge Pool validation, the hire-request rules, and the
 * organizer's pool filter.
 */

import { describe, expect, it } from "vitest";

import { filterJudgePool } from "../../src/judge-pool/filter";
import type { JudgePoolEntry } from "../../src/judge-pool/types";
import {
  applyHireAction,
  availableHireActions,
  parseHireAction,
  parseHireId,
  parseHireRequest,
  parseJudgeListing,
  readStoredList,
  isUsState,
} from "../../src/judge-pool/validation";

const TODAY = "2026-10-12";
const listing = {
  active: true,
  weekends: ["2026-11-21", "2026-10-17"],
  states: ["CA"],
  canTravel: true,
  formats: ["ld", "pf"],
  philosophy: "  Tech over truth.  ",
};

describe("parseJudgeListing", () => {
  it("accepts a full listing, sorting weekends and trimming the philosophy", () => {
    const parsed = parseJudgeListing(listing, TODAY);
    expect(parsed).toEqual({
      ok: true,
      value: { ...listing, weekends: ["2026-10-17", "2026-11-21"], philosophy: "Tech over truth." },
    });
  });

  it("allows at most three weekends", () => {
    const parsed = parseJudgeListing({ ...listing, weekends: ["2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07"] }, TODAY);
    expect(parsed).toMatchObject({ ok: false, error: "Pick up to 3 weekends." });
  });

  it("refuses a day that isn't a season Saturday, or one that has passed", () => {
    expect(parseJudgeListing({ ...listing, weekends: ["2026-10-18"] }, TODAY).ok).toBe(false);
    expect(parseJudgeListing({ ...listing, weekends: ["2026-10-03"] }, TODAY)).toMatchObject({
      ok: false,
      error: "Pick weekends that haven't happened yet.",
    });
  });

  it("refuses unknown states and formats", () => {
    expect(parseJudgeListing({ ...listing, states: ["XX"] }, TODAY)).toMatchObject({ ok: false, error: "Unknown state: XX." });
    expect(parseJudgeListing({ ...listing, formats: ["chess"] }, TODAY)).toMatchObject({ ok: false });
  });

  it("requires weekends, a state and a format only while listed", () => {
    expect(parseJudgeListing({ ...listing, weekends: [] }, TODAY)).toMatchObject({ ok: false });
    expect(parseJudgeListing({ ...listing, states: [] }, TODAY)).toMatchObject({ ok: false, error: "Pick the state you're in." });
    expect(parseJudgeListing({ active: false }, TODAY)).toMatchObject({ ok: true, value: { active: false, weekends: [] } });
  });
});

describe("readStoredList", () => {
  it("drops ids no longer known and survives bad JSON", () => {
    expect(readStoredList('["CA","ZZ","CA"]', isUsState)).toEqual(["CA"]);
    expect(readStoredList("not json", isUsState)).toEqual([]);
  });
});

describe("parseHireRequest", () => {
  const request = { judgeId: "judge-1", tournamentName: " Bay Area Invitational ", weekend: "2026-10-17", offer: "$300", message: "" };

  it("accepts a request and trims it", () => {
    expect(parseHireRequest(request, TODAY)).toEqual({
      ok: true,
      value: { ...request, tournamentName: "Bay Area Invitational" },
    });
  });

  it("needs a tournament name and an upcoming season weekend", () => {
    expect(parseHireRequest({ ...request, tournamentName: "  " }, TODAY).ok).toBe(false);
    expect(parseHireRequest({ ...request, weekend: "2026-10-03" }, TODAY).ok).toBe(false);
    expect(parseHireRequest({ ...request, judgeId: "" }, TODAY).ok).toBe(false);
  });

  it("reads ids and actions", () => {
    expect(parseHireId("0F8FAD5B-D9CB-469F-A165-70867728950E")).toEqual({ ok: true, value: "0f8fad5b-d9cb-469f-a165-70867728950e" });
    expect(parseHireId("nope").ok).toBe(false);
    expect(parseHireAction({ action: "accept" })).toEqual({ ok: true, value: "accept" });
    expect(parseHireAction({ action: "pay" }).ok).toBe(false);
  });
});

describe("hire actions", () => {
  const pending = { status: "pending" as const, organizerId: "org", judgeId: "judge" };

  it("lets the judge answer a pending request, and the organizer cancel it", () => {
    expect(availableHireActions(pending, "judge")).toEqual(["accept", "decline"]);
    expect(availableHireActions(pending, "org")).toEqual(["cancel"]);
    expect(applyHireAction(pending, "judge", "accept")).toEqual({ ok: true, status: "accepted" });
    expect(applyHireAction(pending, "org", "accept")).toMatchObject({ ok: false, code: 403 });
  });

  it("lets either side call off an accepted request, and nothing else", () => {
    const accepted = { ...pending, status: "accepted" as const };
    expect(availableHireActions(accepted, "judge")).toEqual(["cancel"]);
    expect(availableHireActions(accepted, "org")).toEqual(["cancel"]);
    expect(applyHireAction(accepted, "judge", "decline")).toMatchObject({ ok: false, code: 409 });
  });

  it("refuses strangers and closed requests", () => {
    expect(applyHireAction(pending, "someone", "cancel")).toMatchObject({ ok: false, code: 403 });
    expect(availableHireActions({ ...pending, status: "declined" }, "org")).toEqual([]);
  });
});

describe("filterJudgePool", () => {
  const entry = (id: string, overrides: Partial<JudgePoolEntry>): JudgePoolEntry => ({
    active: true,
    weekends: ["2026-10-17"],
    states: ["CA"],
    canTravel: false,
    formats: ["ld"],
    philosophy: "",
    judge: { id, name: id, imageUrl: null },
    updatedAt: 100,
    ...overrides,
  });
  const pool = [
    entry("ca-local", {}),
    entry("ny-traveler", { states: ["NY"], canTravel: true, updatedAt: 200 }),
    entry("tx-homebody", { states: ["TX"], weekends: ["2026-11-21"], formats: ["pf"] }),
  ];
  const ids = (list: JudgePoolEntry[]) => list.map((item) => item.judge.id);

  it("matches a state by residence or willingness to travel, locals first", () => {
    expect(ids(filterJudgePool(pool, { state: "CA" }))).toEqual(["ca-local", "ny-traveler"]);
    expect(ids(filterJudgePool(pool, { state: "TX" }))).toEqual(["tx-homebody", "ny-traveler"]);
  });

  it("filters by weekend and format", () => {
    expect(ids(filterJudgePool(pool, { weekend: "2026-11-21" }))).toEqual(["tx-homebody"]);
    expect(ids(filterJudgePool(pool, { format: "ld" }))).toEqual(["ny-traveler", "ca-local"]);
  });
});
