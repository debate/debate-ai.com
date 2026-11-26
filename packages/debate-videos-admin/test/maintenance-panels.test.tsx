/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ComputedTitlesPanel } from "../src/components/ComputedTitlesPanel";
import { TeamLongNamesPanel } from "../src/components/TeamLongNamesPanel";
import { TournamentYearsPanel } from "../src/components/TournamentYearsPanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, jsonResponse, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ComputedTitlesPanel", () => {
  const URL = "/api/admin/videos/computed-titles";

  it("steps through every season until the server returns no next season", async () => {
    const steps = [
      { season: 2025, updated: 10, titled: 8, ranked: 6, missingTables: [], nextSeason: 2024, seasons: [2025, 2024] },
      { season: 2024, updated: 4, titled: 3, ranked: 2, missingTables: ["hsld"], nextSeason: null, seasons: [2025, 2024] },
    ];
    const { calls } = mockFetch([{ method: "POST", match: URL, respond: () => steps.shift() }]);
    mount(<ComputedTitlesPanel />);
    await clickAsync(button("Fill computed titles"));
    expect(calls.map((c) => c.body)).toEqual([{ season: null }, { season: 2024 }]);
    expect(bodyText()).toContain("Done: 11 videos titled across 2 of 2 seasons (14 updated, 8 teams ranked).");
    expect(bodyText()).toContain("Couldn't load hsld.");
    expect(button("Fill computed titles").disabled).toBe(false);
  });

  it("shows the server's details when a step fails", async () => {
    mockFetch([{ method: "POST", match: URL, respond: { error: "boom", details: "D1 timed out" }, status: 500 }]);
    mount(<ComputedTitlesPanel />);
    await clickAsync(button("Fill computed titles"));
    expect(bodyText()).toContain("D1 timed out");
    expect(bodyText()).not.toContain("Done:");
  });

  it("falls back to a generic message and disables the button while running", async () => {
    let release!: (r: Response) => void;
    mockFetch([
      {
        method: "POST",
        match: URL,
        respond: () => new Promise<Response>((resolve) => (release = resolve)),
      },
    ]);
    mount(<ComputedTitlesPanel />);
    await clickAsync(button("Fill computed titles"));
    expect(button("Filling…").disabled).toBe(true);
    release(jsonResponse({}, 502));
    await flush();
    expect(bodyText()).toContain("Fill failed");
  });
});

describe("TeamLongNamesPanel", () => {
  const URL = "/api/admin/videos/team-long-names";

  it("fills once without overwrite and reports unresolved teams", async () => {
    const { calls } = mockFetch([
      {
        method: "POST",
        match: URL,
        respond: { season: 2025, updated: 3, unresolved: 2, missingTables: [], nextSeason: null, seasons: [2025] },
      },
    ]);
    mount(<TeamLongNamesPanel />);
    await clickAsync(button("Fill team last names"));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.body).toEqual({ season: null, overwrite: false });
    expect(bodyText()).toContain("Filled 3 videos across 1 of 1 season; 2 teams not found in that season's rankings.");
  });

  it("Redo all sends overwrite and walks the seasons", async () => {
    const steps = [
      { season: 2025, updated: 1, unresolved: 0, missingTables: [], nextSeason: 2024, seasons: [2025, 2024] },
      { season: 2024, updated: 1, unresolved: 0, missingTables: [], nextSeason: null, seasons: [2025, 2024] },
    ];
    const { calls } = mockFetch([{ method: "POST", match: URL, respond: () => steps.shift() }]);
    mount(<TeamLongNamesPanel />);
    await clickAsync(button("Redo all"));
    expect(calls.map((c) => c.body)).toEqual([
      { season: null, overwrite: true },
      { season: 2024, overwrite: true },
    ]);
    expect(bodyText()).toContain("Filled 2 videos across 2 of 2 seasons.");
  });

  it("surfaces an error from the server", async () => {
    mockFetch([{ method: "POST", match: URL, respond: { error: "Forbidden" }, status: 403 }]);
    mount(<TeamLongNamesPanel />);
    await clickAsync(button("Fill team last names"));
    expect(bodyText()).toContain("Forbidden");
  });

  it("reports a thrown network failure", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    mount(<TeamLongNamesPanel />);
    await clickAsync(button("Fill team last names"));
    expect(bodyText()).toContain("offline");
  });
});

describe("TournamentYearsPanel", () => {
  const URL = "/api/admin/videos/tournament-years";

  it("keeps calling until nothing remains and shows a sample rename", async () => {
    const steps = [
      { renamed: 5, rows: 7, remaining: 3, examples: [{ from: "2024 TOC", to: "TOC" }] },
      { renamed: 3, rows: 3, remaining: 0, examples: [{ from: "Wake Forest 2009", to: "Wake Forest" }] },
    ];
    const { calls } = mockFetch([{ method: "POST", match: URL, respond: () => steps.shift() }]);
    mount(<TournamentYearsPanel />);
    await clickAsync(button("Remove years"));
    expect(calls).toHaveLength(2);
    expect(bodyText()).toContain("Done: 8 names on 10 videos (e.g. “2024 TOC” → “TOC”).");
  });

  it("says so when every name is already clean", async () => {
    mockFetch([{ method: "POST", match: URL, respond: { renamed: 0, rows: 0, remaining: 0, examples: [] } }]);
    mount(<TournamentYearsPanel />);
    await clickAsync(button("Remove years"));
    expect(bodyText()).toContain("Every tournament name is already saved without a year.");
  });

  it("stops when a step renames nothing even though rows remain, and labels blank results", async () => {
    const steps = [
      { renamed: 1, rows: 1, remaining: 4, examples: [{ from: "2020", to: null }] },
      { renamed: 0, rows: 0, remaining: 4, examples: [] },
    ];
    const { calls } = mockFetch([{ method: "POST", match: URL, respond: () => steps.shift() }]);
    mount(<TournamentYearsPanel />);
    await clickAsync(button("Remove years"));
    expect(calls).toHaveLength(2);
    expect(bodyText()).toContain("Done: 1 name on 1 video (e.g. “2020” → “blank”).");
  });

  it("shows an error when the cleanup fails", async () => {
    mockFetch([{ method: "POST", match: URL, respond: { details: "db locked" }, status: 500 }]);
    mount(<TournamentYearsPanel />);
    await clickAsync(button("Remove years"));
    expect(bodyText()).toContain("db locked");
  });
});
