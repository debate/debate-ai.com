// @vitest-environment jsdom
/**
 * @fileoverview Render tests for Rebuttal Redos: fiat points and badges, a
 * debater turning in a redo (which records Debater Level XP), the judge's
 * newest round drafted automatically, and a judge's review.
 */

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RebuttalRedosPanel } from "../../src/rebuttal-redos/ui/RebuttalRedosPanel";
import { fiatSummary } from "../../src/rebuttal-redos/rules";
import type { RebuttalRedo, RedoBoardResponse } from "../../src/rebuttal-redos/types";
import { button } from "../helpers/dom";
import { click, flush, mount, type, type Mounted } from "../helpers/mount";

const viewer = { id: "nia", name: "Nia", email: "nia@example.com" };

function redo(extra: Partial<RebuttalRedo> = {}): RebuttalRedo {
  return {
    id: "r1",
    roundKey: "judge:7",
    roundTitle: "Glenbrooks — Octos",
    format: "policy",
    judge: { id: "judge", name: "Jamie" },
    student: { email: "nia@example.com", id: "nia", name: "Nia" },
    side: "neg",
    speech: "2NR",
    aiInstructions: "1. Answer the perm.",
    judgeInstructions: "Go for the DA only.",
    timeLimitSeconds: 300,
    dueAt: null,
    status: "assigned",
    submissionText: "",
    hasAudio: false,
    submittedAt: null,
    feedback: "",
    rating: null,
    reviewedAt: null,
    fiatPoints: 0,
    createdAt: 1,
    updatedAt: 1,
    viewerRole: "student",
    ...extra,
  };
}

const board = (extra: Partial<RedoBoardResponse> = {}): RedoBoardResponse => ({
  viewer,
  assignments: [],
  judging: [],
  fiat: fiatSummary([]),
  ...extra,
});

const noRounds = async () => ({ rounds: [], flows: [] });

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

describe("RebuttalRedosPanel", () => {
  it("asks a signed-out reader to sign in", async () => {
    mounted = await mount(createElement(RebuttalRedosPanel, { loadBoard: async () => null, loadRounds: noRounds }));
    expect(mounted.container.textContent).toContain("Sign in to get rebuttal redos");
  });

  it("shows the judge's instructions and turns in a redo for XP", async () => {
    const update = vi.fn(async () => redo({ status: "submitted", submissionText: "DA outweighs", fiatPoints: 15 }));
    const recordActivity = vi.fn();
    const fiat = fiatSummary([{ status: "reviewed", submittedAt: 1, dueAt: null, rating: 5 }]);
    mounted = await mount(
      createElement(RebuttalRedosPanel, { loadBoard: async () => board({ assignments: [redo()], fiat }), loadRounds: noRounds, update, recordActivity }),
    );
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("40 fiat points");
    expect(text).toContain("Go for the DA only.");
    expect(mounted.container.querySelector('[data-earned="true"]')?.textContent).toContain("First Redo");

    const outline = mounted.container.querySelector('[data-testid="rebuttal-redo-assignment"] textarea') as HTMLTextAreaElement;
    await type(outline, "DA outweighs");
    await click(button(mounted.container, "Turn in redo"));
    await flush(async () => {});
    expect(update).toHaveBeenCalledWith("r1", { action: "submit", submissionText: "DA outweighs" });
    expect(recordActivity).toHaveBeenCalledWith("rebuttal_redo");
  });

  it("drafts the newest round the viewer judged automatically", async () => {
    sessionStorage.clear();
    const generate = vi.fn(async (_round: unknown) => ({ redos: [], created: true }));
    const round = {
      id: 9,
      title: "TOC — Finals",
      timestamp: Date.now(),
      debaters: { aff: ["a@x.com", ""], neg: ["n@x.com", ""] },
      judges: ["NIA@example.com"],
      flowIds: [],
    };
    mounted = await mount(
      createElement(RebuttalRedosPanel, { loadBoard: async () => board(), loadRounds: async () => ({ rounds: [round], flows: [] }), generate }),
    );
    await flush(async () => {});
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ roundId: "9", roundTitle: "TOC — Finals", format: "policy" });
  });

  it("lets the judge rate and send feedback", async () => {
    const update = vi.fn(async () => redo({ status: "reviewed", viewerRole: "judge" }));
    const submitted = redo({ status: "submitted", viewerRole: "judge", submissionText: "My outline", submittedAt: 100 });
    mounted = await mount(
      createElement(RebuttalRedosPanel, { loadBoard: async () => board({ judging: [submitted] }), loadRounds: noRounds, update }),
    );
    expect(mounted.container.textContent).toContain("To review (1)");
    await click(mounted.container.querySelector('[aria-label="4 stars"]')!);
    await type(mounted.container.querySelector('[aria-label="Feedback for Nia"]') as HTMLTextAreaElement, "Cleaner collapse.");
    await click(button(mounted.container, "Send feedback"));
    await flush(async () => {});
    expect(update).toHaveBeenCalledWith("r1", { action: "review", feedback: "Cleaner collapse.", rating: 4 });
  });
});
