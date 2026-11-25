/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  RoundFlowPanel,
  describeRoundFlowRun,
  formatRunAge,
  roundFlowPercent,
  type RoundFlowRun,
} from "../src/components/RoundFlowPanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "./helpers/dom";

beforeAll(() => {
  installDomShims();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ENDPOINT = "/api/admin/videos/round-flow";

const doneRun: RoundFlowRun = {
  videoId: "abcdefghijk",
  title: "Round A",
  trigger: "cron",
  ranAt: Math.floor(Date.now() / 1000) - 2 * 3600,
  status: "done",
  speeches: ["1NR", "1AR", "2NR", "2AR"],
  detected: false,
  summaries: ["2NR", "2AR"],
  flowChart: true,
  nodes: 24,
  errors: [],
};

const stats = {
  rounds: 200,
  withFlowChart: 50,
  paused: false,
  next: { videoId: "zyxwvutsrqp", title: "Round B" },
  recent: [doneRun],
  schedule: "15 * * * *",
  aiConfigured: true,
};

describe("RoundFlowPanel helpers", () => {
  it("describes a run", () => {
    expect(describeRoundFlowRun(doneRun)).toBe("Wrote summaries for 2NR, 2AR; flow chart (24 bubbles).");
    expect(describeRoundFlowRun({ ...doneRun, status: "failed", reason: "Flow chart: bad reply" })).toBe(
      "Flow chart: bad reply",
    );
    expect(describeRoundFlowRun({ ...doneRun, status: "skipped", reason: "No captions." })).toBe("No captions.");
  });

  it("formats ages and percentages", () => {
    const now = 1_000_000_000_000;
    expect(formatRunAge(now / 1000 - 30, now)).toBe("just now");
    expect(formatRunAge(now / 1000 - 600, now)).toBe("10 min ago");
    expect(formatRunAge(now / 1000 - 3 * 86_400, now)).toBe("3 d ago");
    expect(roundFlowPercent(50, 200)).toBe(25);
    expect(roundFlowPercent(1, 3)).toBe(33.3);
    expect(roundFlowPercent(5, 0)).toBe(0);
  });
});

describe("RoundFlowPanel", () => {
  it("shows progress, the next round and recent runs", async () => {
    mockFetch([{ method: "GET", match: ENDPOINT, respond: stats }]);
    mount(<RoundFlowPanel />);
    await flush();
    expect(bodyText()).toContain("50 of 200 rounds have a flow chart");
    expect(bodyText()).toContain("25%");
    expect(bodyText()).toContain("Next up: Round B.");
    expect(bodyText()).toContain("2 h ago");
    expect(bodyText()).toContain("Round A (1NR, 1AR, 2NR, 2AR) — Wrote summaries for 2NR, 2AR; flow chart (24 bubbles).");
  });

  it("runs the next round now and pauses the hourly job", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: ENDPOINT, respond: stats },
      { method: "POST", match: ENDPOINT, respond: { runs: [doneRun] } },
    ]);
    mount(<RoundFlowPanel />);
    await flush();
    await clickAsync(button("Run next now"));
    await flush();
    await clickAsync(button("Pause hourly runs"));
    await flush();
    const posts = calls.filter((call) => call.method === "POST").map((call) => call.body);
    expect(posts).toEqual([{ action: "run" }, { action: "pause" }]);
  });
});
