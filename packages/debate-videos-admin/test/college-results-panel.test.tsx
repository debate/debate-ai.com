/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  CollegeResultsPanel,
  HsResultsPanel,
  formatCollegeResultsProgress,
  type CollegeResultsProgress,
} from "../src/components/CollegeResultsPanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, jsonResponse, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const progress = (over: Partial<CollegeResultsProgress> = {}): CollegeResultsProgress => ({
  checked: 0,
  statuses: {},
  winnersFilled: 0,
  decisionsFilled: 0,
  remaining: 0,
  finished: false,
  stopped: false,
  ...over,
});

describe("formatCollegeResultsProgress", () => {
  it("summarizes a finished run with every status in order", () => {
    expect(
      formatCollegeResultsProgress(
        progress({
          finished: true,
          checked: 1480,
          statuses: { error: 2, verified: 1201, not_found: 7, conflict: 1 },
          winnersFilled: 640,
          decisionsFilled: 702,
        }),
      ),
    ).toBe(
      "Done: 1,480 checked — 1,201 found with a decision, 1 disagree with the saved winner, 7 not found, 2 failed. 640 winners and 702 ballot counts filled.",
    );
  });

  it("explains how to continue a stopped run", () => {
    expect(formatCollegeResultsProgress(progress({ stopped: true, checked: 20, remaining: 1500 }))).toBe(
      "Stopped after 20 (1,500 left — press again to continue). 0 winners and 0 ballot counts filled.",
    );
  });

  it("shows a run in flight and singular fills", () => {
    expect(
      formatCollegeResultsProgress(
        progress({ checked: 10, remaining: 90, statuses: { ambiguous: 3 }, winnersFilled: 1, decisionsFilled: 1 }),
      ),
    ).toBe("10 checked, 90 to go — 3 ambiguous, skipped. 1 winner and 1 ballot count filled.");
  });
});

describe("CollegeResultsPanel", () => {
  const ENDPOINT = "/api/admin/videos/college-results";
  const batch = (over: Record<string, unknown> = {}) => ({
    checked: 10,
    statuses: { verified: 8, not_found: 2 },
    winnersFilled: 5,
    decisionsFilled: 6,
    remaining: 0,
    total: 10,
    ...over,
  });

  it("runs batches until nothing remains, accumulating totals", async () => {
    const batches = [batch({ remaining: 10, total: 20 }), batch({ checked: 10, statuses: { verified: 10 } })];
    const { calls } = mockFetch([{ method: "POST", match: ENDPOINT, respond: () => batches.shift() }]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Look up college results"));
    expect(calls).toHaveLength(2);
    expect(calls[0]!.body).toEqual({ since: 0 });
    expect(bodyText()).toContain(
      "Done: 20 checked — 18 found with a decision, 2 not found. 10 winners and 12 ballot counts filled.",
    );
  });

  it("Recheck all sends a current timestamp as since", async () => {
    const { calls } = mockFetch([{ method: "POST", match: ENDPOINT, respond: batch() }]);
    const before = Math.floor(Date.now() / 1000);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Recheck all"));
    expect((calls[0]!.body as { since: number }).since).toBeGreaterThanOrEqual(before);
  });

  it("stops after the current batch when Stop is pressed", async () => {
    let release!: (r: Response) => void;
    const { calls } = mockFetch([
      {
        method: "POST",
        match: ENDPOINT,
        respond: () => new Promise<Response>((resolve) => (release = resolve)),
      },
    ]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Look up college results"));
    expect(button("Looking up…").disabled).toBe(true);
    await clickAsync(button("Stop"));
    release(jsonResponse(batch({ remaining: 90 })));
    await flush();
    expect(calls).toHaveLength(1);
    expect(bodyText()).toContain("Stopped after 10 (90 left — press again to continue)");
    expect(button("Look up college results").disabled).toBe(false);
  });

  it("stops looping when a batch checks nothing even though rows remain", async () => {
    const { calls } = mockFetch([{ method: "POST", match: ENDPOINT, respond: batch({ checked: 0, statuses: {}, remaining: 5 }) }]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Look up college results"));
    expect(calls).toHaveLength(1);
    expect(bodyText()).toContain("Done: 0 checked");
  });

  it("tells the admin how to resume after a failed batch", async () => {
    mockFetch([{ method: "POST", match: ENDPOINT, respond: { details: "rate limited" }, status: 429 }]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Look up college results"));
    expect(bodyText()).toContain('rate limited — press "Look up college results" to pick up where it stopped.');
  });

  it("shows a generic failure when the server gives no reason", async () => {
    mockFetch([{ method: "POST", match: ENDPOINT, respond: {}, status: 500 }]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Look up college results"));
    expect(bodyText()).toContain("Lookup failed");
  });

  it("lists unsettled rounds with links to their watch pages, and toggles the list off", async () => {
    mockFetch([
      {
        method: "GET",
        match: `${ENDPOINT}?status=not_found`,
        respond: {
          total: 3,
          rows: [
            {
              videoId: "a/b",
              title: "Semis",
              tournament: "Harvard",
              roundLevel: "Semis",
              affTeam: "Iowa AB",
              negTeam: "Emory CD",
              seasonYear: 2027,
              status: "not_found",
            },
            {
              videoId: "c",
              title: "Round 2",
              tournament: "Wake",
              roundLevel: null,
              affTeam: "X",
              negTeam: "Y",
              seasonYear: null,
              status: "not_found",
            },
          ],
        },
      },
    ]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Not found"));
    expect(bodyText()).toContain("3 rounds, showing the first 2.");
    expect(bodyText()).toContain("2026-27");
    expect(bodyText()).toContain("Harvard · Semis");
    expect(bodyText()).toContain("Iowa AB vs Emory CD");
    const link = document.querySelector<HTMLAnchorElement>("a[href^='/videos/watch/a']")!;
    expect(link.getAttribute("href")).toBe("/videos/watch/a%2Fb");
    expect(link.title).toBe("Semis");
    expect(button("Not found").getAttribute("aria-pressed")).toBe("true");

    await clickAsync(button("Not found"));
    expect(document.querySelector("[data-testid=college-results-list]")).toBeNull();
  });

  it("says None for an empty list and shows list errors", async () => {
    mockFetch([
      { method: "GET", match: "status=ambiguous", respond: { rows: [], total: 0 } },
      { method: "GET", match: "status=conflict", respond: { error: "boom" }, status: 500 },
      { method: "GET", match: "status=error", respond: {}, status: 500 },
    ]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("Ambiguous"));
    expect(bodyText()).toContain("None.");
    await clickAsync(button("Conflicts"));
    expect(bodyText()).toContain("boom");
    await clickAsync(button("Failed"));
    expect(bodyText()).toContain("Could not load the list");
  });

  it("singularizes a one-round list", async () => {
    mockFetch([
      {
        method: "GET",
        match: "status=winner_not_explicit",
        respond: {
          total: 1,
          rows: [{ videoId: "z", title: "T", tournament: "Y", roundLevel: null, affTeam: "A", negTeam: "B", seasonYear: 2025, status: "winner_not_explicit" }],
        },
      },
    ]);
    mount(<CollegeResultsPanel />);
    await clickAsync(button("No decision"));
    expect(bodyText()).toContain("1 round.");
  });
});

describe("HsResultsPanel", () => {
  it("looks high school rounds up on Tabroom through its own endpoint", async () => {
    const { calls } = mockFetch([
      {
        method: "POST",
        match: "/api/admin/videos/hs-results",
        respond: { checked: 4, statuses: { verified: 4 }, winnersFilled: 1, decisionsFilled: 1, remaining: 0, total: 4 },
      },
    ]);
    mount(<HsResultsPanel />);
    expect(bodyText()).toContain("on Tabroom");
    await clickAsync(button("Look up high school results"));
    expect(calls[0]!.url).toBe("/api/admin/videos/hs-results");
    expect(bodyText()).toContain("Done: 4 checked — 4 found with a decision. 1 winner and 1 ballot count filled.");
  });
});
