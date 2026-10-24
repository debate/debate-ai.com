// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `NewsStreamPanel` — the category filter,
 * relative timestamps, per-viewer read/like state, the optional account
 * sync adapter, and cross-tab refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type FC } from "react";

import { NewsStreamPanel, type NewsStreamSyncAdapter } from "../src/panels/NewsStreamPanel";
import { isNewsItemLiked, isNewsItemRead, markNewsItemRead } from "../src/state/newsStream";
import { NEWS_CATEGORY_LABELS, type NewsItem } from "../src/lib/news-stream";
import { saveEvidenceLibraryEntry } from "@debate-ai/research-evidence/src/state/evidenceLibraryEntries";
import { buttonByText, click, flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The panel with its optional props spelled out, so `createElement` can type-check them. */
const Panel = NewsStreamPanel as FC<NonNullable<Parameters<typeof NewsStreamPanel>[0]>>;

const NOW = new Date("2030-06-15T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

const EXTRA: NewsItem[] = [
  { id: "x-today", category: "rounds", title: "Today item", body: "Body today", timestamp: NOW, href: "/community" },
  { id: "x-yesterday", category: "rounds", title: "Yesterday item", body: "Body", timestamp: NOW - DAY },
  { id: "x-days", category: "forums", title: "Days item", body: "Body", timestamp: NOW - 5 * DAY },
  { id: "x-month", category: "forums", title: "Month item", body: "Body", timestamp: NOW - 31 * DAY },
  { id: "x-months", category: "forums", title: "Months item", body: "Body", timestamp: NOW - 75 * DAY },
];

let view: Mounted;
const text = () => view.container.textContent ?? "";

/** The card element that renders `title`. */
function cardFor(title: string): HTMLElement {
  const span = Array.from(view.container.querySelectorAll("span")).find((el) => el.textContent === title);
  const card = span?.closest("[data-slot='card']") ?? span?.parentElement?.parentElement?.parentElement?.parentElement;
  if (!card) throw new Error(`No card for ${title}`);
  return card as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.useRealTimers();
});

describe("NewsStreamPanel", () => {
  it("renders extra items newest first with relative times", async () => {
    view = await mount(createElement(Panel, { extraItems: EXTRA }));

    const titles = EXTRA.map((item) => item.title);
    const positions = titles.map((title) => text().indexOf(title));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    expect(Array.from(cardFor("Today item").querySelectorAll("span")).map((el) => el.textContent)).toContain("Today");
    expect(cardFor("Today item").querySelector("a")?.getAttribute("href")).toBe("/community");
    expect(cardFor("Yesterday item").textContent).toContain("Yesterday");
    expect(cardFor("Days item").textContent).toContain("5 days ago");
    expect(cardFor("Month item").textContent).toContain("1 month ago");
    expect(cardFor("Months item").textContent).toContain("3 months ago");
    expect(cardFor("Yesterday item").querySelector("a")).toBeNull();
  });

  it("shows a filter only for categories the feed has, and filters by it", async () => {
    view = await mount(createElement(Panel, { extraItems: EXTRA }));

    const labels = Array.from(view.container.querySelectorAll("button")).map((el) => el.textContent);
    expect(labels).toContain(NEWS_CATEGORY_LABELS.rounds);
    expect(labels).toContain(NEWS_CATEGORY_LABELS.forums);
    expect(labels).not.toContain(NEWS_CATEGORY_LABELS.files);

    await click(buttonByText(view.container, NEWS_CATEGORY_LABELS.rounds));
    expect(text()).toContain("Today item");
    expect(text()).not.toContain("Days item");

    await click(buttonByText(view.container, NEWS_CATEGORY_LABELS.forums));
    expect(text()).toContain("Days item");
    expect(text()).not.toContain("Today item");

    await click(buttonByText(view.container, "All"));
    expect(text()).toContain("Today item");
  });

  it("marks an item read on hover (once) and toggles likes, pushing both through the sync adapter", async () => {
    const sync: NewsStreamSyncAdapter = {
      hydrate: vi.fn(async () => null),
      pushRead: vi.fn(),
      pushLiked: vi.fn(),
    };
    view = await mount(createElement(Panel, { extraItems: [EXTRA[0]], syncRemote: sync }));
    await flush(async () => {});
    expect(sync.hydrate).toHaveBeenCalledTimes(1);
    expect(cardFor("Today item").textContent).toContain("New");

    // React's onMouseEnter listens for mouseover/mouseout pairs.
    await flush(() => {
      cardFor("Today item").dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });
    expect(isNewsItemRead("x-today")).toBe(true);
    expect(sync.pushRead).toHaveBeenCalledWith("x-today");
    expect(cardFor("Today item").textContent).not.toContain("New");

    await flush(() => {
      cardFor("Today item").dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });
    expect(sync.pushRead).toHaveBeenCalledTimes(1);

    const like = () => cardFor("Today item").querySelector<HTMLButtonElement>("button[aria-pressed]")!;
    expect(like().textContent).toBe("Like");
    await click(like());
    expect(isNewsItemLiked("x-today")).toBe(true);
    expect(like().getAttribute("aria-pressed")).toBe("true");
    expect(like().textContent).toBe("Liked");
    expect(sync.pushLiked).toHaveBeenLastCalledWith("x-today", true);

    await click(like());
    expect(isNewsItemLiked("x-today")).toBe(false);
    expect(sync.pushLiked).toHaveBeenLastCalledWith("x-today", false);
  });

  it("merges the account's read/liked state on hydrate", async () => {
    const sync: NewsStreamSyncAdapter = {
      hydrate: vi.fn(async () => ({ read: ["x-today"], liked: ["x-today"] })),
      pushRead: vi.fn(),
      pushLiked: vi.fn(),
    };
    view = await mount(createElement(Panel, { extraItems: [EXTRA[0]], syncRemote: sync }));
    await flush(async () => {});
    expect(cardFor("Today item").textContent).not.toContain("New");
    expect(cardFor("Today item").querySelector("button[aria-pressed]")?.textContent).toBe("Liked");
  });

  it("rebuilds the feed when another tab adds a library card or changes viewer state", async () => {
    view = await mount(createElement(Panel, { extraItems: [EXTRA[0]] }));
    expect(cardFor("Today item").textContent).toContain("New");

    saveEvidenceLibraryEntry({
      id: "fresh-card",
      argBlock: "Winning DA",
      wordCount: 3,
      topic: "Energy",
      caseArea: "DA",
      tags: [],
      kind: "card",
      text: "Fresh evidence.",
      cite: "Lee 30",
      createdAt: NOW,
    });
    markNewsItemRead("x-today");

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    });
    expect(text()).not.toContain("Winning DA");

    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(text()).toContain("Winning DA");
    expect(cardFor("Today item").textContent).not.toContain("New");
  });
});
