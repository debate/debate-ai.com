/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TabroomResultsPanel, formatTabroomResultsProgress } from "../src/components/TabroomResultsPanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, jsonResponse, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ENDPOINT = "/api/admin/videos/tabroom-results";
const batch = (over: Record<string, unknown> = {}) => ({
  checked: 10,
  statuses: { verified: 7, ambiguous: 3 },
  winnersFilled: 4,
  decisionsFilled: 5,
  remaining: 0,
  total: 10,
  ...over,
});

describe("formatTabroomResultsProgress", () => {
  const base = { checked: 5, statuses: {}, winnersFilled: 1, decisionsFilled: 2, remaining: 40, finished: false, stopped: false };

  it("reports a run in flight, a stopped run and a finished one", () => {
    expect(formatTabroomResultsProgress(base)).toBe("5 checked, 40 to go. 1 winner and 2 ballot counts filled.");
    expect(formatTabroomResultsProgress({ ...base, stopped: true })).toBe(
      "Stopped after 5 (40 left — press again to continue). 1 winner and 2 ballot counts filled.",
    );
    expect(formatTabroomResultsProgress({ ...base, finished: true, statuses: { error: 1, not_found: 2 } })).toBe(
      "Done: 5 checked — 2 not found, 1 failed. 1 winner and 2 ballot counts filled.",
    );
  });
});

describe("TabroomResultsPanel", () => {
  it("runs batches until nothing remains and sums the statuses", async () => {
    const batches = [batch({ remaining: 10 }), batch()];
    const { calls } = mockFetch([{ method: "POST", match: ENDPOINT, respond: () => batches.shift() }]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Look up Tabroom results"));
    expect(calls).toHaveLength(2);
    expect(calls[0]!.body).toEqual({ since: 0 });
    expect(bodyText()).toContain("Done: 20 checked — 14 found with a decision, 6 ambiguous, skipped. 8 winners and 10 ballot counts filled.");
  });

  it("Recheck all sends the current time as since", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { calls } = mockFetch([{ method: "POST", match: ENDPOINT, respond: batch() }]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Recheck all"));
    expect((calls[0]!.body as { since: number }).since).toBeGreaterThanOrEqual(before);
  });

  it("stops after the batch in flight when Stop is pressed", async () => {
    let release!: (r: Response) => void;
    const { calls } = mockFetch([
      { method: "POST", match: ENDPOINT, respond: () => new Promise<Response>((resolve) => (release = resolve)) },
    ]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Look up Tabroom results"));
    expect(button("Looking up…").disabled).toBe(true);
    await clickAsync(button("Stop"));
    release(jsonResponse(batch({ remaining: 25 })));
    await flush();
    expect(calls).toHaveLength(1);
    expect(bodyText()).toContain("Stopped after 10 (25 left — press again to continue)");
  });

  it("treats a batch that checked nothing as finished", async () => {
    const { calls } = mockFetch([{ method: "POST", match: ENDPOINT, respond: batch({ checked: 0, statuses: undefined, remaining: 3 }) }]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Look up Tabroom results"));
    expect(calls).toHaveLength(1);
    expect(bodyText()).toContain("Done: 0 checked");
  });

  it("explains how to resume after a failure, with a generic fallback", async () => {
    mockFetch([
      { method: "POST", match: ENDPOINT, respond: { details: "Tabroom blocked us" }, status: 403, once: true },
      { method: "POST", match: ENDPOINT, respond: {}, status: 500 },
    ]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Look up Tabroom results"));
    expect(bodyText()).toContain('Tabroom blocked us — press "Look up Tabroom results" to pick up where it stopped.');
    await clickAsync(button("Look up Tabroom results"));
    expect(bodyText()).toContain("Lookup failed");
    expect(bodyText()).not.toContain("Tabroom blocked us");
  });

  it("lists unsettled rounds linking to their watch pages and toggles the list", async () => {
    mockFetch([
      {
        method: "GET",
        match: `${ENDPOINT}?status=conflict`,
        respond: {
          total: 1,
          rows: [
            { videoId: "q/1", title: "Finals", tournament: "TOC", roundLevel: "Finals", affTeam: "Lex AB", negTeam: "Ben CD", seasonYear: 2026, status: "conflict" },
          ],
        },
      },
    ]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Conflicts"));
    expect(bodyText()).toContain("1 round.");
    expect(bodyText()).toContain("2025-26");
    expect(bodyText()).toContain("TOC · Finals");
    expect(bodyText()).toContain("Lex AB vs Ben CD");
    expect(document.querySelector("a[href='/videos/watch/q%2F1']")).not.toBeNull();
    await clickAsync(button("Conflicts"));
    expect(document.querySelector("[data-testid=tabroom-results-list]")).toBeNull();
  });

  it("shows truncation, empty lists and list errors", async () => {
    mockFetch([
      { method: "GET", match: "status=not_found", respond: { total: 600, rows: [{ videoId: "z", title: "T", tournament: "X", roundLevel: null, affTeam: "A", negTeam: "B", seasonYear: null, status: "not_found" }] } },
      { method: "GET", match: "status=ambiguous", respond: { rows: [], total: 0 } },
      { method: "GET", match: "status=error", respond: { error: "list broke" }, status: 500 },
      { method: "GET", match: "status=winner_not_explicit", respond: {}, status: 500 },
    ]);
    mount(<TabroomResultsPanel />);
    await clickAsync(button("Not found"));
    expect(bodyText()).toContain("600 rounds, showing the first 1.");
    await clickAsync(button("Ambiguous"));
    expect(bodyText()).toContain("None.");
    await clickAsync(button("Failed"));
    expect(bodyText()).toContain("list broke");
    await clickAsync(button("No decision"));
    expect(bodyText()).toContain("Could not load the list");
  });
});
