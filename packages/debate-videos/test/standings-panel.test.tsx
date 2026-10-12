// @vitest-environment jsdom
/**
 * @fileoverview Exercises the Standings tab end to end over the real
 * `debate-data-sync` local stores (jsdom `localStorage`): logging a result,
 * the CSV bulk import, the points-table and cutoff editors, and expanding a
 * team to delete one of its results. Only the account clients are mocked —
 * signed out by default, signed in for the "synced" copy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const account = vi.hoisted(() => ({ signedIn: false }));

vi.mock("@debate/data-sync/src/state/tournament-results-client", () => ({
  listSavedTournamentResults: async () => (account.signedIn ? [] : null),
  saveTournamentResultToAccount: async () => undefined,
  deleteSavedTournamentResultFromAccount: async () => undefined,
}));
vi.mock("@debate/data-sync/src/state/qualification-settings-sync-client", () => ({
  fetchQualificationPointsTable: async () => null,
  saveQualificationPointsTable: async () => undefined,
  fetchQualificationCutoff: async () => null,
  saveQualificationCutoff: async () => undefined,
}));

let view: Mounted;

async function render() {
  vi.resetModules();
  const { StandingsPanel } = await import("../src/panels/leaderboard/StandingsPanel");
  view = await mount(<StandingsPanel />);
  await flush();
  return view.container;
}

function byPlaceholder(root: HTMLElement, placeholder: string): HTMLInputElement {
  const el = root.querySelector<HTMLInputElement>(`[placeholder="${placeholder}"]`);
  if (!el) throw new Error(`no input with placeholder ${placeholder}`);
  return el;
}

function button(root: HTMLElement, label: string, index = 0): HTMLButtonElement {
  const matches = [...root.querySelectorAll("button")].filter((b) => b.textContent?.trim() === label);
  if (!matches[index]) throw new Error(`no button "${label}"`);
  return matches[index];
}

/** The number inputs inside a `<details>` section, in DOM order. */
function detailsInputs(root: HTMLElement, summary: string): HTMLInputElement[] {
  const details = [...root.querySelectorAll("details")].find((d) =>
    d.querySelector("summary")?.textContent?.includes(summary),
  )!;
  return [...details.querySelectorAll("input")];
}

async function logResult(root: HTMLElement, team: string, tournament: string, date: string) {
  await type(byPlaceholder(root, "Team"), team);
  await type(byPlaceholder(root, "Tournament"), tournament);
  await type(root.querySelector<HTMLInputElement>('input[type="date"]')!, date);
  await type(byPlaceholder(root, "Division (e.g. PF)"), "PF");
  await type(byPlaceholder(root, "Prelim wins"), "4");
  await type(byPlaceholder(root, "Prelim losses"), "2");
  await type(byPlaceholder(root, "Bid level"), "-3");
  await click(button(root, "Log result"));
}

beforeEach(() => {
  localStorage.clear();
  account.signedIn = false;
});

afterEach(async () => {
  await view?.unmount();
});

describe("StandingsPanel", () => {
  it("starts empty and requires every field to log a result", async () => {
    const root = await render();
    expect(root.textContent).toContain("No tournament results logged yet.");
    expect(root.textContent).toContain("0 teams, 0 results logged");

    await click(button(root, "Log result"));
    expect(root.textContent).toContain("Team, tournament, date, and division are all required.");
  });

  it("logs a result, keeps team and division, and lists the standing", async () => {
    const root = await render();
    await logResult(root, "Westlake AB", "Berkeley", "2026-01-10");

    expect(root.textContent).not.toContain("are all required");
    expect(root.textContent).toContain("1 team, 1 result logged");
    expect(root.textContent).toContain("Westlake AB");
    expect(root.textContent).toContain("4-2");
    expect(root.textContent).toContain("Prelims only");
    // The form clears the tournament but keeps the team and division.
    expect(byPlaceholder(root, "Team").value).toBe("Westlake AB");
    expect(byPlaceholder(root, "Division (e.g. PF)").value).toBe("PF");
    expect(byPlaceholder(root, "Tournament").value).toBe("");
    expect(JSON.stringify(Object.entries(localStorage))).toContain("Berkeley");
  });

  it("expands a team to show its results and deletes one", async () => {
    const root = await render();
    await logResult(root, "Westlake AB", "Berkeley", "2026-01-10");
    const row = [...root.querySelectorAll("tr")].find((tr) => tr.textContent?.includes("Westlake AB"))!;
    await click(row);
    expect(root.textContent).toContain("Berkeley (2026-01-10)");
    expect(root.textContent).toContain("bid level 0");

    await click(button(root, "Delete"));
    expect(root.textContent).toContain("No tournament results logged yet.");
  });

  it("collapses an expanded team on a second click", async () => {
    const root = await render();
    await logResult(root, "Westlake AB", "Berkeley", "2026-01-10");
    const row = () => [...root.querySelectorAll("tr")].find((tr) => tr.textContent?.includes("Westlake AB"))!;
    await click(row());
    expect(root.textContent).toContain("Berkeley (2026-01-10)");
    await click(row());
    expect(root.textContent).not.toContain("Berkeley (2026-01-10)");
  });

  it("bulk-imports a CSV and reports what it skipped", async () => {
    const root = await render();
    const textarea = root.querySelector("textarea")!;

    await click(button(root, "Import results"));
    expect(root.textContent).toContain("Paste a CSV to import first.");

    await type(
      textarea,
      [
        "teamId,tournamentName,date,division,bidLevel,finish,prelimWins,prelimLosses",
        "Westlake AB,Berkeley,2026-01-10,PF,1,quarterfinalist,5,1",
        "Harker CD,Glenbrooks,2026-02-01,PF,2,champion,6,0",
        "Bad,,2026-02-01,PF,2,champion,6,0",
      ].join("\n"),
    );
    await click(button(root, "Import results"));
    expect(root.textContent).toMatch(/Imported 2 results\. Skipped 1 row: /);
    expect(textarea.value).toBe("");
    expect(root.textContent).toContain("2 teams, 2 results logged");
    expect(root.textContent).toContain("Champion");

    await type(textarea, "teamId,tournamentName\nonly,two");
    await click(button(root, "Import results"));
    expect(root.textContent).toContain("No results imported.");
  });

  it("imports a single row with singular copy", async () => {
    const root = await render();
    await type(
      root.querySelector("textarea")!,
      "teamId,tournamentName,date,division,finish\nWestlake AB,Berkeley,2026-01-10,PF,finalist",
    );
    await click(button(root, "Import results"));
    expect(root.textContent).toContain("Imported 1 result.");
  });

  it("saves and resets the qualification points table", async () => {
    const root = await render();
    await logResult(root, "Westlake AB", "Berkeley", "2026-01-10");
    const inputs = detailsInputs(root, "Qualification points table");
    // Prelims-only finish is the 8th outround input; prelim-win points the 9th.
    await type(inputs[7], "100");
    await type(inputs[8], "abc");
    await type(inputs[9], "0.5");
    await click(button(root, "Save", 0));

    expect(root.textContent).toContain("Saved — new points weights apply immediately.");
    expect(localStorage.getItem("qualificationPointsTable")).toContain("100");
    const pointsCell = [...root.querySelectorAll("td")].find((td) => td.textContent === "100");
    expect(pointsCell).toBeTruthy();

    await click(button(root, "Reset to default"));
    expect(root.textContent).toContain("Reset to the default point table.");
    expect(detailsInputs(root, "Qualification points table")[7].value).not.toBe("100");
  });

  it("applies a qualification cutoff and clears it", async () => {
    const root = await render();
    await logResult(root, "Alpha", "Berkeley", "2026-01-10");
    await type(byPlaceholder(root, "Team"), "Bravo");
    await type(byPlaceholder(root, "Tournament"), "Glenbrooks");
    await type(root.querySelector<HTMLInputElement>('input[type="date"]')!, "2026-02-01");
    await type(byPlaceholder(root, "Prelim wins"), "1");
    await click(button(root, "Log result"));
    expect(root.textContent).toContain("2 teams, 2 results logged");

    await type(byPlaceholder(root, "No cap"), "1");
    await type(byPlaceholder(root, "No minimum"), "1");
    await click(button(root, "Save", 1));
    expect(root.textContent).toContain("Saved — the qualified list below applies it immediately.");
    expect(root.textContent).toContain("1 of 2 currently qualify");
    expect(root.querySelectorAll("tr").length).toBeGreaterThan(2);
    expect(root.textContent).toContain("Qualified");

    await type(byPlaceholder(root, "No minimum"), "");
    expect(byPlaceholder(root, "No minimum").value).toBe("");
    await click(button(root, "Clear cutoff"));
    expect(root.textContent).toContain("Cleared — no cutoff is configured.");
    expect(root.textContent).not.toContain("currently qualify");
  });

  it("says when standings are synced to the account", async () => {
    account.signedIn = true;
    const root = await render();
    expect(root.textContent).toContain("synced to your account");

    await click(button(root, "Save", 0));
    expect(root.textContent).toContain("Saved to your account — new points weights apply immediately.");
    await click(button(root, "Save", 1));
    expect(root.textContent).toContain("Saved to your account — the qualified list below applies it immediately.");
  });
});
