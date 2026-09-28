// @vitest-environment jsdom
/**
 * @fileoverview Render tests for the Debater Level cutscene — both
 * `DebaterLevelUpOverlay` in isolation and the wiring in `DebaterLevelPanel`
 * that decides *when* it plays.
 *
 * The overlay is the first component in this package built on framer-motion,
 * which brings two things the other panel tests never had to deal with: an
 * animation library that schedules work outside React (so the assertions have
 * to be about what ends up in the DOM, not about intermediate frames), and a
 * `prefers-reduced-motion` branch that has to be exercised explicitly because
 * jsdom reports no preference at all and would otherwise only ever test the
 * moving version.
 *
 * Uses this package's existing `test/helpers/mount.tsx` harness, the same one
 * `ProgressUnlocksPanel.test.tsx` established.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { MotionGlobalConfig } from "framer-motion";

import { DebaterLevelUpOverlay, type DebaterLevelUpOverlayProps } from "../src/panels/DebaterLevelUpOverlay";
import { DebaterLevelPanel } from "../src/panels/DebaterLevelPanel";
import { computeLevelProgress, totalXpForLevel } from "../src/lib/debater-levels";
import { DEBATER_LEVEL_STORAGE_KEY, recordDebaterActivity } from "../src/state/debaterLevel";
import { click, flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

/**
 * Skip Motion's animation timeline for this file.
 *
 * The cutscene mounts ~25 independently animating nodes (18 sparks, two
 * shockwaves, the ray burst, every staggered letter). Left running under
 * jsdom — which has no compositor, so every frame is a real style write — a
 * single mount costs a full second of rAF work, and the fifteen mounts here
 * were slow enough to time out the other files sharing the worker. This is
 * framer-motion's own switch for the case (its docs call it out for tests and
 * visual regression): values land on their animated state immediately.
 *
 * Nothing is lost. Every assertion here is about what the cutscene *says*,
 * and the `prefers-reduced-motion` test below already pins that the
 * no-motion path renders exactly the same content.
 */
MotionGlobalConfig.skipAnimations = true;

/** XP that clears level 1 and partway into level 2. */
const LEVEL_2_XP = totalXpForLevel(2) + 50;

/** The overlay at level 2 with the defaults, so each test only names what it varies. */
function overlay(overrides: Partial<DebaterLevelUpOverlayProps> = {}) {
  return createElement(DebaterLevelUpOverlay, {
    open: true,
    previousLevel: 1,
    progress: computeLevelProgress(LEVEL_2_XP),
    xpGained: 25,
    onDismiss: () => {},
    ...overrides,
  });
}

/** The overlay's Continue button, found by its label rather than by tag order. */
function continueButton(container: HTMLElement): Element {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    (candidate.textContent ?? "").includes("Continue"),
  );
  if (!button) throw new Error("no Continue button rendered");
  return button;
}

describe("DebaterLevelUpOverlay", () => {
  let mounted: Mounted | null = null;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
    vi.useRealTimers();
  });

  it("renders nothing at all while closed", async () => {
    mounted = await mount(overlay({ open: false }));
    expect(mounted.container.textContent).toBe("");
    expect(mounted.container.querySelector('[role="status"]')).toBeNull();
  });

  it("announces the new level, its rank and the XP paid, to assistive tech", async () => {
    mounted = await mount(overlay());
    const status = mounted.container.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
    // The rank at level 2 is still "Novice". The label has to name the level,
    // the rank and the XP: it is the only thing a screen reader gets, and the
    // cutscene's motion carries nothing for it.
    expect(status?.getAttribute("aria-label")).toContain("level 2");
    expect(status?.getAttribute("aria-label")).toContain("Novice");
    expect(status?.getAttribute("aria-label")).toContain("25 XP");
  });

  it("shows the old level knocking through to the new one, plus the rank", async () => {
    mounted = await mount(overlay({ previousLevel: 7 }));
    const text = mounted.container.textContent ?? "";
    expect(text).toContain("LEVEL UP");
    expect(text).toContain("7");
    expect(text).toContain("Novice");
    expect(text).toContain("+25 XP");
    expect(text).toContain("Continue");
  });

  it("reports the XP bar's destination for the level it landed on", async () => {
    // 50 XP is partway into level 2's 150-XP band, so the caption names
    // level 3 as what the bar is filling toward.
    mounted = await mount(overlay());
    expect(mounted.container.textContent).toContain("toward level 3");
  });

  it("does not promise a next level once the debater is at the cap", async () => {
    const progress = computeLevelProgress(Number.MAX_SAFE_INTEGER);
    expect(progress.isMaxLevel).toBe(true);
    mounted = await mount(overlay({ progress }));
    expect(mounted.container.textContent).toContain("Max level reached");
    expect(mounted.container.textContent).not.toContain("toward level");
  });

  it("dismisses on Continue, on the backdrop, and on Escape", async () => {
    const onDismiss = vi.fn();
    mounted = await mount(overlay({ onDismiss }));

    await click(continueButton(mounted.container));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    await click(mounted.container.querySelector('button[aria-label="Dismiss level up"]')!);
    expect(onDismiss).toHaveBeenCalledTimes(2);

    await flush(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  it("leaves unrelated keys alone", async () => {
    const onDismiss = vi.fn();
    mounted = await mount(overlay({ onDismiss }));

    await flush(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses itself once the cutscene has run", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    mounted = await mount(overlay({ onDismiss, autoDismissMs: 5000 }));

    await flush(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    await flush(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("stays up forever when auto-dismiss is turned off", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    mounted = await mount(overlay({ onDismiss, autoDismissMs: 0 }));

    await flush(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("cancels its timer on unmount, so navigating away cannot dismiss twice", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    mounted = await mount(overlay({ onDismiss, autoDismissMs: 1000 }));
    await mounted.unmount();
    mounted = null;

    await flush(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("still reads out level, rank and XP under prefers-reduced-motion", async () => {
    // jsdom reports no preference by default, so this is the only thing that
    // exercises the reduced branch: the motion is dropped, not the content.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));

    try {
      mounted = await mount(overlay());
      const text = mounted.container.textContent ?? "";
      expect(text).toContain("Novice");
      expect(text).toContain("+25 XP");
      expect(text).toContain("Continue");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("DebaterLevelPanel level-up wiring", () => {
  let mounted: Mounted | null = null;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(async () => {
    await mounted?.unmount();
    mounted = null;
    vi.useRealTimers();
  });

  // Every test here mounts the whole DebaterLevelPanel — the level card, four
  // stat tiles, twelve log-practice buttons, seven challenges and the XP log —
  // which is the heaviest render in this package. Its sibling panel test runs
  // into the same 5s default on a loaded machine, so these declare their own
  // budget rather than inheriting one.
  const TIMEOUT = 30_000;

  it("opens the cutscene when an activity crosses a level boundary", async () => {
    mounted = await mount(createElement(DebaterLevelPanel, {}));
    expect(mounted.container.querySelector('[role="status"]')).toBeNull();

    // Two "finished a practice round" awards pay 25 each and trip the
    // "Finish a practice round" daily challenge (+100), so this single event
    // takes 0 → 150 XP: one level cleared, the second band 50 XP in.
    const award = recordDebaterActivity("practice_round", 2);
    expect(award.leveledUp).toBe(true);
    expect(award.previousLevel).toBe(1);
    expect(award.newLevel).toBe(2);

    await flush(() => {});
    const status = mounted.container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-label")).toContain("level 2");
    expect(mounted.container.textContent).toContain("LEVEL UP");
  }, TIMEOUT);

  it("leaves the cutscene closed for an award that does not level up", async () => {
    mounted = await mount(createElement(DebaterLevelPanel, {}));
    // +5 XP is nowhere near the 100 XP level-1 band.
    expect(recordDebaterActivity("card_cut").leveledUp).toBe(false);

    await flush(() => {});
    expect(mounted.container.querySelector('[role="status"]')).toBeNull();
  }, TIMEOUT);

  it("closes the cutscene again on Continue, leaving the new level on the card", async () => {
    mounted = await mount(createElement(DebaterLevelPanel, {}));
    recordDebaterActivity("practice_round", 2);
    await flush(() => {});

    await click(continueButton(mounted.container));
    expect(mounted.container.querySelector('[role="status"]')).toBeNull();
    // Not a dead end: the level it just reached is still stated, with its
    // total, under the bar.
    expect(mounted.container.textContent).toContain("Level 2");
    expect(mounted.container.textContent).toContain("150 XP total");
  }, TIMEOUT);

  it("only reads the awarded state — the cutscene persists nothing of its own", async () => {
    mounted = await mount(createElement(DebaterLevelPanel, {}));
    recordDebaterActivity("practice_round", 2);
    await flush(() => {});

    const persisted = JSON.parse(window.localStorage.getItem(DEBATER_LEVEL_STORAGE_KEY) ?? "{}");
    expect(persisted.totalXp).toBe(150);
    // A cutscene is presentation, not progression: nothing level-up-shaped
    // beyond the XP store the award itself already wrote.
    expect(Object.keys(persisted).sort()).toEqual([
      "completedMilestoneIds",
      "daily",
      "lifetimeCounts",
      "recentXp",
      "totalXp",
    ]);
  }, TIMEOUT);
});
