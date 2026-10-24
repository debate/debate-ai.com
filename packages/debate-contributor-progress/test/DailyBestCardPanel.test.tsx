// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `DailyBestCardPanel` — today's live leader,
 * the announce action, the best-of-the-week rollups, the winner-history
 * calendar and each announced day's comment thread. The account-sync fetch
 * is stubbed to a signed-out `401` so comments stay local-only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC } from "react";

import { DailyBestCardPanel } from "../src/panels/DailyBestCardPanel";
import { saveContribution } from "@debate-ai/research-evidence/src/state/contributions";
import type { AttributedContribution } from "@debate-ai/research-evidence/src/lib/contribution-leaderboard";
import {
  announceDailyBestCard,
  getAnnouncedDailyBestCard,
} from "../src/state/dailyBestCardAnnouncements";
import {
  listAllDailyBestCardComments,
  postDailyBestCardComment,
} from "../src/state/dailyBestCardComments";
import { buttonByText, buttonsByText, click, flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The panel with its optional props spelled out, so `createElement` can type-check them. */
const Panel = DailyBestCardPanel as FC<NonNullable<Parameters<typeof DailyBestCardPanel>[0]>>;

// Wednesday of ISO week 2026-W15.
const NOW = new Date("2026-04-08T12:00:00Z");
const MONDAY = new Date("2026-04-06T12:00:00Z").getTime();
const TUESDAY = new Date("2026-04-07T12:00:00Z").getTime();

function card(id: string, contributorId: string, submittedAt: number, likes = 1): void {
  saveContribution({
    id,
    contributorId,
    kind: "card",
    likes,
    saves: 2,
    qualitySignals: [1],
    reviewerEndorsements: [],
    submittedAt,
  } as AttributedContribution & { submittedAt: number });
}

let view: Mounted;
const text = () => view.container.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("DailyBestCardPanel", () => {
  it("shows the empty states when nothing has been submitted or announced", async () => {
    view = await mount(createElement(Panel));
    expect(text()).toContain("No card submitted today yet.");
    expect(text()).toContain("No week has an announced winner yet.");
    expect(text()).toContain("No prior days have been announced yet.");
    expect(text()).toContain("2026-04");
  });

  it("shows today's live leader and freezes it on announce", async () => {
    card("today-card", "alice", NOW.getTime(), 5);
    view = await mount(createElement(Panel));

    expect(text()).toContain("Card of the day");
    expect(text()).toContain('"today-card"');
    expect(text()).toContain("5 likes");
    expect(text()).toContain("2 saves");
    expect(text()).toContain("not yet announced");

    await click(buttonByText(view.container, "Announce today's winner"));
    expect(getAnnouncedDailyBestCard("2026-04-08")?.contribution.id).toBe("today-card");
    expect(text()).not.toContain("not yet announced");
    expect(text()).toContain("Comments (0)");
    expect(text()).toContain("Week 2026-W15");
    // Today's winner isn't duplicated into the "prior days" list.
    expect(text()).toContain("No prior days have been announced yet.");
  });

  it("renders weekly rollups, the calendar and the history with per-day comment threads", async () => {
    card("monday-card", "bob", MONDAY, 1);
    card("tuesday-card", "carol", TUESDAY, 9);
    announceDailyBestCard(MONDAY);
    announceDailyBestCard(TUESDAY);
    postDailyBestCardComment({ dayKey: "2026-04-06", authorId: "dan", text: "Nice warrant" });

    view = await mount(createElement(Panel, { signedInContributorId: "erin" }));

    expect(text()).toContain("Week 2026-W15");
    expect(text()).toContain("(2 days)");
    expect(text()).toContain("Comments (1)");
    expect(text()).toContain("Nice warrant");
    expect(text()).toContain("Comments (0)");

    // The calendar enables only the days with an announced winner.
    const dayButtons = Array.from(view.container.querySelectorAll<HTMLButtonElement>("button[title]"));
    expect(dayButtons.map((button) => button.textContent)).toEqual(["6", "7"]);
    await click(dayButtons[1]);
    expect(dayButtons[1].className).toContain("ring-1");

    await click(query(view.container, "button[aria-label='Previous month']"));
    expect(text()).toContain("2026-03");
    expect(view.container.querySelectorAll("button[title]")).toHaveLength(0);
    await click(query(view.container, "button[aria-label='Next month']"));
    await click(query(view.container, "button[aria-label='Next month']"));
    expect(text()).toContain("2026-05");

    // The signed-in id prefills each thread's "Your name".
    const author = query<HTMLInputElement>(view.container, "#daily-best-card-comment-author-2026-04-07");
    expect(author.value).toBe("erin");

    const post = () =>
      buttonsByText(view.container, "Post").find((button) =>
        button.closest("div.mt-3")?.querySelector("#daily-best-card-comment-text-2026-04-07"),
      )!;
    expect(post().disabled).toBe(true);
    await type(query<HTMLTextAreaElement>(view.container, "#daily-best-card-comment-text-2026-04-07"), "Great card");
    expect(post().disabled).toBe(false);
    await click(post());

    const posted = listAllDailyBestCardComments().find((comment) => comment.dayKey === "2026-04-07");
    expect(posted).toMatchObject({ authorId: "erin", text: "Great card" });
    expect(query<HTMLTextAreaElement>(view.container, "#daily-best-card-comment-text-2026-04-07").value).toBe("");
    expect(text()).toContain("Great card");

    await type(author, "frank");
    expect(author.value).toBe("frank");

    // Delete the first comment shown ("Nice warrant" on Monday).
    await click(buttonsByText(view.container, "Delete")[0]);
    expect(listAllDailyBestCardComments().map((comment) => comment.text)).toEqual(["Great card"]);
  });

  it("re-reads leader and comments when another tab writes a watched key", async () => {
    card("monday-card", "bob", MONDAY);
    announceDailyBestCard(MONDAY);
    view = await mount(createElement(Panel));
    expect(text()).toContain("No card submitted today yet.");

    card("today-card", "alice", NOW.getTime());
    postDailyBestCardComment({ dayKey: "2026-04-06", authorId: "gil", text: "From another tab" });
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "not-watched" }));
    });
    expect(text()).not.toContain("From another tab");

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(text()).toContain('"today-card"');
    expect(text()).toContain("From another tab");
  });
});
