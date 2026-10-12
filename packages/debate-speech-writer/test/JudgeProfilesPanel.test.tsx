// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `JudgeProfilesPanel` — logging, editing,
 * undo/redo and deleting judged rounds, the CSV bulk import, the roster
 * table, the multi-judge comparison, the logged-round filter with its
 * "did you mean" suggestion, and cross-tab refresh. Runs against the real
 * localStorage-backed judge stores.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { JudgeProfilesPanel } from "../src/panels/JudgeProfilesPanel";
import {
  bulkImportJudgeRoundRecords,
  listJudgeRoundRecords,
  recordJudgeRound,
} from "../src/state/judgeRoundRecords";
import { buttonByText, buttonsByText, click, flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

const HEADER =
  "judgeId,tournamentName,date,division,winningSide,affSpeakerPoints,negSpeakerPoints,paceWpm,theoryArgumentRaised,theoryArgumentWon,paradigmId";

function rows(judgeId: string, side: "aff" | "neg", pace: number, theoryWon: boolean, paradigm: string): string[] {
  return [1, 2, 3, 4, 5].map(
    (n) => `${judgeId},T${n},2026-01-0${n},PF,${side},28,27.5,${pace},true,${theoryWon},${paradigm}`,
  );
}

let view: Mounted;
const text = () => view.container.textContent ?? "";
const input = (id: string) => query<HTMLInputElement>(view.container, `#${id}`);
const roster = () =>
  Array.from(view.container.querySelectorAll("table"))[0]
    ? Array.from(view.container.querySelectorAll("table")[0].querySelectorAll("tbody tr")).map((tr) =>
        Array.from(tr.querySelectorAll("td")).map((td) => td.textContent),
      )
    : [];

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("JudgeProfilesPanel logging rounds", () => {
  it("shows the empty roster and validates the form", async () => {
    view = await mount(createElement(JudgeProfilesPanel));
    expect(text()).toContain("No judge profiles yet.");
    expect(text()).not.toContain("Logged rounds");

    await click(buttonByText(view.container, "Log round"));
    expect(text()).toContain("Judge ID, tournament, date, and division are all required.");

    await type(input("judge-round-judge-id"), "smith");
    await type(input("judge-round-tournament"), "Berkeley");
    await type(input("judge-round-date"), "2026-01-10");
    await type(input("judge-round-division"), "PF");
    await type(input("judge-round-aff-points"), "");
    await type(input("judge-round-aff-points"), "abc");
    // A number input rejects non-numeric text, leaving it empty → Number("") is 0, so use pace instead.
    await type(input("judge-round-aff-points"), "28");
    // The pace field is `type="number"`, so jsdom sanitizes an out-of-range
    // "1e999" to "" (a blank, valid pace). Switch the live node to a text
    // input so the overflowing value reaches the panel's own finite-number
    // guard, as a browser that let it through would.
    const pace = input("judge-round-pace");
    expect(pace.type).toBe("number");
    await type(pace, "1e999");
    expect(pace.value).toBe("");
    pace.setAttribute("type", "text");
    await type(pace, "1e999");
    await click(buttonByText(view.container, "Log round"));
    expect(text()).toContain("Pace must be a number of words per minute, or left blank.");
    expect(listJudgeRoundRecords()).toEqual([]);
  });

  it("logs a round with theory toggles, keeps judge/division for the next one, and builds a profile", async () => {
    view = await mount(createElement(JudgeProfilesPanel));
    await type(input("judge-round-judge-id"), " smith ");
    await type(input("judge-round-tournament"), "Berkeley");
    await type(input("judge-round-date"), "2026-01-10");
    await type(input("judge-round-division"), "PF");
    await type(input("judge-round-aff-points"), "28.5");
    await type(input("judge-round-neg-points"), "27");
    await type(input("judge-round-pace"), "300");

    const raised = query<HTMLButtonElement>(view.container, "#judge-round-theory-raised");
    const won = query<HTMLButtonElement>(view.container, "#judge-round-theory-won");
    expect(won.disabled).toBe(true);
    await click(raised);
    expect(won.disabled).toBe(false);
    await click(won);
    expect(won.getAttribute("aria-checked")).toBe("true");
    // Turning "raised" off also clears "won".
    await click(raised);
    expect(won.getAttribute("aria-checked")).toBe("false");
    await click(raised);
    await click(won);

    await click(buttonByText(view.container, "Log round"));
    const [record] = listJudgeRoundRecords();
    expect(record).toMatchObject({
      judgeId: "smith",
      tournamentName: "Berkeley",
      date: "2026-01-10",
      division: "PF",
      winningSide: "aff",
      affSpeakerPoints: 28.5,
      negSpeakerPoints: 27,
      paceWpm: 300,
      theoryArgumentRaised: true,
      theoryArgumentWon: true,
    });
    // "No paradigm" leaves the field off the stored record.
    expect(record.paradigmId).toBeUndefined();
    expect(input("judge-round-judge-id").value).toBe("smith");
    expect(input("judge-round-division").value).toBe("PF");
    expect(input("judge-round-tournament").value).toBe("");

    const [row] = roster();
    expect(row[1]).toBe("smith");
    expect(row[2]).toBe("1");
    expect(row[3]).toContain("Aff 1-0 Neg");
    expect(row[7]).toBe("—");
    expect(text()).toContain("Logged rounds");
  });

  it("edits, undoes, redoes and deletes a logged round", async () => {
    recordJudgeRound({
      id: "r1",
      judgeId: "smith",
      tournamentName: "Berkeley",
      date: "2026-01-10",
      division: "PF",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 27,
      paceWpm: 250,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
      paradigmId: "flow",
    });
    view = await mount(createElement(JudgeProfilesPanel));

    const editButton = () => query<HTMLButtonElement>(view.container, "button[aria-label^='Edit smith']");
    await click(editButton());
    expect(text()).toContain("Edit logged round");
    expect(input("judge-round-pace").value).toBe("250");
    await click(buttonByText(view.container, "Cancel"));
    expect(text()).toContain("Log a judged round");
    expect(input("judge-round-judge-id").value).toBe("");

    await click(editButton());
    await type(input("judge-round-tournament"), "Glenbrooks");
    await type(input("judge-round-pace"), "");
    await click(buttonByText(view.container, "Save changes"));
    expect(listJudgeRoundRecords()).toEqual([
      expect.objectContaining({ id: "r1", tournamentName: "Glenbrooks", paradigmId: "flow" }),
    ]);
    // Clearing the pace drops it from the stored record.
    expect(listJudgeRoundRecords()[0].paceWpm).toBeUndefined();

    // Undo while editing the same round also cancels that edit.
    await click(editButton());
    await click(query(view.container, "button[aria-label^='Undo last edit to smith']"));
    expect(listJudgeRoundRecords()[0].tournamentName).toBe("Berkeley");
    expect(text()).toContain("Log a judged round");

    await click(editButton());
    await click(query(view.container, "button[aria-label^='Redo last undone edit to smith']"));
    expect(listJudgeRoundRecords()[0].tournamentName).toBe("Glenbrooks");
    expect(text()).toContain("Log a judged round");

    await click(editButton());
    await click(query(view.container, "button[aria-label^='Delete smith']"));
    expect(listJudgeRoundRecords()).toEqual([]);
    expect(text()).toContain("No judge profiles yet.");
    expect(text()).toContain("Log a judged round");
  });
});

describe("JudgeProfilesPanel bulk import", () => {
  it("requires CSV text, reports skips, and clears the box after a successful import", async () => {
    view = await mount(createElement(JudgeProfilesPanel));
    const box = () => query<HTMLTextAreaElement>(view.container, "textarea");

    await click(buttonByText(view.container, "Import rounds"));
    expect(text()).toContain("Paste a CSV of judged rounds first.");

    await type(box(), [HEADER, "smith,Berkeley,2026-01-10,PF,maybe,28,27,,,,"].join("\n"));
    await click(buttonByText(view.container, "Import rounds"));
    expect(text()).toContain('No rounds imported. Row 2: "winningSide" must be "aff" or "neg"');
    expect(box().value).not.toBe("");

    await type(
      box(),
      [HEADER, "smith,Berkeley,2026-01-10,PF,aff,28,27,,,,", "jones,Berkeley,2026-01-10,PF,neg,x,27,,,,"].join("\n"),
    );
    await click(buttonByText(view.container, "Import rounds"));
    expect(text()).toContain("Imported 1 round. Skipped 1 row: Row 3:");
    expect(box().value).toBe("");

    await type(box(), [HEADER, ...rows("lee", "aff", 200, false, "lay").slice(0, 2)].join("\n"));
    await click(buttonByText(view.container, "Import rounds"));
    expect(text()).toContain("Imported 2 rounds.");
    expect(roster().map((row) => row[1]).sort()).toEqual(["lee", "smith"]);
  });
});

describe("JudgeProfilesPanel comparison and filter", () => {
  beforeEach(() => {
    bulkImportJudgeRoundRecords(
      [HEADER, ...rows("smith", "aff", 300, true, "flow"), ...rows("jones", "neg", 200, false, "lay")].join("\n"),
    );
    recordJudgeRound({
      id: "lee-1",
      judgeId: "lee",
      tournamentName: "Stanford",
      date: "2026-02-01",
      division: "LD",
      winningSide: "neg",
      affSpeakerPoints: 28,
      negSpeakerPoints: 28,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
    });
  });

  it("renders roster stats and a panel-level comparison of selected judges", async () => {
    view = await mount(createElement(JudgeProfilesPanel));

    const smith = roster().find((row) => row[1] === "smith")!;
    expect(smith[2]).toBe("5");
    expect(smith[3]).toContain("Aff 5-0 Neg");
    expect(smith[3]).toContain("notable bias");
    expect(smith[7]).toContain("flow");
    expect(smith[7]).toContain("100% confidence");
    const lee = roster().find((row) => row[1] === "lee")!;
    expect(lee[5]).toBe("unknown");
    expect(lee[6]).toBe("unknown");

    expect(text()).toContain("No judges selected yet.");
    await click(query(view.container, "input[aria-label='Add smith to panel comparison']"));
    expect(text()).toContain("Compare judges (1 selected)");
    expect(text()).toContain("Select at least one more judge to compare.");

    await click(query(view.container, "input[aria-label='Add jones to panel comparison']"));
    expect(text()).toContain("Panel: ");
    expect(text()).toContain("smith → aff");
    expect(text()).toContain("jones → neg");
    expect(text()).toContain("200 wpm (set by jones");
    expect(text()).toContain("averse: jones");
    expect(text()).toContain("conflicting");
    expect(text()).toContain("smith: flow");

    // Unchecking a judge removes it again.
    await click(query(view.container, "input[aria-label='Add jones to panel comparison']"));
    expect(text()).toContain("Compare judges (1 selected)");

    await click(buttonByText(view.container, "Clear selection"));
    expect(text()).toContain("No judges selected yet.");
  });

  it("shows unknown pace/theory and no leans for a panel with nothing tracked", async () => {
    recordJudgeRound({
      id: "kim-1",
      judgeId: "kim",
      tournamentName: "Stanford",
      date: "2026-02-01",
      division: "LD",
      winningSide: "aff",
      affSpeakerPoints: 28,
      negSpeakerPoints: 28,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
    });
    view = await mount(createElement(JudgeProfilesPanel));
    await click(query(view.container, "input[aria-label='Add lee to panel comparison']"));
    await click(query(view.container, "input[aria-label='Add kim to panel comparison']"));
    expect(text()).toContain("no notable bias on this panel");
    expect(text()).toContain("unknown — no judge on this panel tracked pace");
    expect(text()).toContain("lee: untagged");
    expect(text()).not.toContain("conflicting");
  });

  it("filters logged rounds by judge id and suggests the nearest id", async () => {
    view = await mount(createElement(JudgeProfilesPanel));
    const filter = input("judge-round-filter");
    expect(view.container.querySelectorAll("#judge-round-filter-options option")).toHaveLength(3);

    await type(filter, "JON");
    const loggedTable = () => Array.from(view.container.querySelectorAll("table")).at(-1)!;
    const judges = Array.from(loggedTable().querySelectorAll("tbody tr td:first-child")).map((td) => td.textContent);
    expect(new Set(judges)).toEqual(new Set(["jones"]));

    await type(filter, "smitt");
    expect(text()).toContain("No logged rounds match that judge ID.");
    expect(text()).toContain("Did you mean");
    await click(buttonByText(view.container, "smith"));
    expect(filter.value).toBe("smith");
    expect(text()).not.toContain("No logged rounds match");
  });

  it("refreshes on a watched storage event", async () => {
    view = await mount(createElement(JudgeProfilesPanel));
    recordJudgeRound({
      id: "new-1",
      judgeId: "newjudge",
      tournamentName: "Harvard",
      date: "2026-02-10",
      division: "PF",
      winningSide: "aff",
      affSpeakerPoints: 29,
      negSpeakerPoints: 28,
      theoryArgumentRaised: false,
      theoryArgumentWon: false,
    });
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    expect(roster().some((row) => row[1] === "newjudge")).toBe(false);
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(roster().some((row) => row[1] === "newjudge")).toBe(true);
    expect(buttonsByText(view.container, "Edit").length).toBeGreaterThan(0);
  });
});
