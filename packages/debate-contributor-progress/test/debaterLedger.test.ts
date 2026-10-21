/**
 * @fileoverview The per-device XP ledger: recording stamps the device's entry,
 * pre-ledger totals become the base, and persistence round-trips.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyDebaterActivity,
  createDebaterLevelState,
  parseDebaterLevelState,
  settleDailyChallenges,
  ACTIVITY_XP,
  utcDayKeyFor,
} from "../src/lib/debater-levels";
import {
  DEBATER_XP_AWARDED_EVENT,
  settleDebaterChallenges,
  DEBATER_DEVICE_ID_STORAGE_KEY,
  DEBATER_LEVEL_STORAGE_KEY,
  getDebaterDeviceId,
  loadDebaterLevelState,
  recordDebaterActivity,
} from "../src/state/debaterLevel";

/** Minimal in-memory `localStorage` — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const NOW = Date.UTC(2026, 9, 20, 12);

describe("applyDebaterActivity ledger", () => {
  it("leaves the ledger absent without a device id", () => {
    expect(applyDebaterActivity(createDebaterLevelState(), "card_cut", NOW).state.ledger).toBeUndefined();
  });

  it("snapshots pre-ledger totals as the base and credits only this device", () => {
    const legacy = { ...createDebaterLevelState(), totalXp: 200, lifetimeCounts: { card_cut: 7 } };
    const { state, xpGained } = applyDebaterActivity(legacy, "card_cut", NOW, 2, [], "A");
    expect(state.ledger).toEqual({
      base: { xp: 200, counts: { card_cut: 7 } },
      devices: { A: { xp: xpGained, counts: { card_cut: 2 }, daily: { dayKey: "2026-10-20", counts: { card_cut: 2 } } } },
    });
    expect(xpGained).toBe(ACTIVITY_XP.card_cut * 2);
    expect(state.totalXp).toBe(200 + xpGained);
  });

  it("tallies today per device, snapshots pre-ledger daily counts, and restarts on a new day", () => {
    const earlier = applyDebaterActivity(createDebaterLevelState(), "card_cut", NOW, 3, []).state;
    const first = applyDebaterActivity(earlier, "card_cut", NOW, 1, [], "A").state;
    expect(first.ledger?.base.daily).toEqual({ dayKey: "2026-10-20", counts: { card_cut: 3 } });
    const again = applyDebaterActivity(first, "card_cut", NOW, 2, [], "A").state;
    expect(again.ledger?.devices.A.daily).toEqual({ dayKey: "2026-10-20", counts: { card_cut: 3 } });
    const nextDay = applyDebaterActivity(again, "speech_delivered", NOW + 86_400_000, 1, [], "A").state;
    expect(nextDay.ledger?.devices.A.daily).toEqual({ dayKey: "2026-10-21", counts: { speech_delivered: 1 } });
  });

  it("accumulates per device and keeps the ledger when a later call has no device id", () => {
    const one = applyDebaterActivity(createDebaterLevelState(), "speech_delivered", NOW, 1, [], "A").state;
    const two = applyDebaterActivity(one, "speech_delivered", NOW, 1, [], "B").state;
    const three = applyDebaterActivity(two, "speech_delivered", NOW, 1, [], "A").state;
    expect(three.ledger?.devices.A.counts.speech_delivered).toBe(2);
    expect(three.ledger?.devices.B.counts.speech_delivered).toBe(1);
    expect(applyDebaterActivity(three, "speech_delivered", NOW, 1, []).state.ledger).toEqual(three.ledger);
  });
});

describe("parseDebaterLevelState ledger", () => {
  it("round-trips a ledger and drops a malformed one", () => {
    const { state } = applyDebaterActivity(createDebaterLevelState(), "speech_delivered", NOW, 1, [], "A");
    expect(parseDebaterLevelState(JSON.parse(JSON.stringify(state)))?.ledger).toEqual(state.ledger);
    expect(parseDebaterLevelState({ ...state, ledger: { base: 1, devices: {} } })?.ledger).toBeUndefined();
    const dirty = { ...state, ledger: { ...state.ledger, devices: { A: { xp: -1, counts: {} }, B: { xp: 3, counts: { speech_delivered: 1 } } } } };
    expect(Object.keys(parseDebaterLevelState(dirty)?.ledger?.devices ?? {})).toEqual(["B"]);
    const withDaily = applyDebaterActivity(createDebaterLevelState(), "speech_delivered", NOW, 1, [], "A").state;
    expect(parseDebaterLevelState(JSON.parse(JSON.stringify(withDaily)))?.ledger?.devices.A.daily).toEqual({ dayKey: "2026-10-20", counts: { speech_delivered: 1 } });
  });
});

describe("recordDebaterActivity device id", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage = new MemoryStorage();
    (globalThis as { window?: EventTarget }).window = new EventTarget() as unknown as Window & typeof globalThis;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
    delete (globalThis as { window?: unknown }).window;
  });

  it("creates one stable id and records into the ledger", () => {
    const id = getDebaterDeviceId();
    expect(id).toBeTruthy();
    expect(getDebaterDeviceId()).toBe(id);
    expect(localStorage.getItem(DEBATER_DEVICE_ID_STORAGE_KEY)).toBe(id);
    recordDebaterActivity("drill_practiced", 1, NOW);
    expect(loadDebaterLevelState().ledger?.devices[id as string].counts.drill_practiced).toBe(1);
    expect(localStorage.getItem(DEBATER_LEVEL_STORAGE_KEY)).toContain('"ledger"');
  });
});

describe("settleDailyChallenges", () => {
  const merged = (counts: Record<string, number>, extra = {}) => ({
    ...createDebaterLevelState("2026-10-20"),
    daily: { dayKey: "2026-10-20", counts, completedChallengeIds: [] as string[] },
    ...extra,
  });

  it("pays a daily challenge whose target the merged counts already meet, once", () => {
    const first = settleDailyChallenges(merged({ card_cut: 5 }), NOW);
    expect(first.completedChallenges.map((c) => c.id)).toEqual(["daily-cut-5-cards"]);
    expect(first.xpGained).toBe(100);
    expect(first.state.totalXp).toBe(100);
    expect(first.state.daily.completedChallengeIds).toEqual(["daily-cut-5-cards"]);
    expect(first.state.recentXp[0]?.id).toBe("settle:2026-10-20:daily-cut-5-cards");
    const again = settleDailyChallenges(first.state, NOW);
    expect(again.completedChallenges).toEqual([]);
    expect(again.state.totalXp).toBe(100);
  });

  it("pays nothing below the target, for done challenges, or for milestones", () => {
    expect(settleDailyChallenges(merged({ card_cut: 4 }), NOW).xpGained).toBe(0);
    const done = merged({ card_cut: 9 });
    done.daily.completedChallengeIds = ["daily-cut-5-cards"];
    expect(settleDailyChallenges(done, NOW).xpGained).toBe(0);
    const lifetime = { ...createDebaterLevelState("2026-10-20"), lifetimeCounts: { card_cut: 1000 } };
    expect(settleDailyChallenges(lifetime, NOW).xpGained).toBe(0);
  });

  it("ignores yesterday's counts after the day rolls over", () => {
    expect(settleDailyChallenges(merged({ card_cut: 5 }), NOW + 86_400_000).xpGained).toBe(0);
  });

  it("credits the ledger base so two devices settling the same state agree (max-merged, so paid once)", () => {
    const withLedger = merged({ card_cut: 5 }, { totalXp: 50, ledger: { base: { xp: 20, counts: {} }, devices: { A: { xp: 30, counts: {} } } } });
    const a = settleDailyChallenges(withLedger, NOW).state;
    const b = settleDailyChallenges(withLedger, NOW + 1000).state;
    expect(a.ledger?.base.xp).toBe(120);
    expect(b.ledger?.base.xp).toBe(a.ledger?.base.xp);
    expect(b.recentXp[0]?.id).toBe(a.recentXp[0]?.id);
  });

  it("levels up and reports it when the bonus crosses a level", () => {
    const result = settleDailyChallenges(merged({ card_cut: 5 }, { totalXp: ACTIVITY_XP.card_cut }), NOW, [
      { id: "big", title: "Big", description: "", activity: "card_cut", target: 5, xpReward: 100_000, repeat: "daily" },
    ]);
    expect(result.leveledUp).toBe(true);
  });
});

describe("settleDebaterChallenges", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage = new MemoryStorage();
    (globalThis as { window?: EventTarget }).window = new EventTarget() as unknown as Window & typeof globalThis;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
    delete (globalThis as { window?: unknown }).window;
  });

  it("persists and announces a merge-completed challenge, and is silent otherwise", () => {
    const awards: unknown[] = [];
    window.addEventListener(DEBATER_XP_AWARDED_EVENT, (e) => awards.push((e as CustomEvent).detail));
    expect(settleDebaterChallenges(NOW).xpGained).toBe(0);
    expect(awards).toHaveLength(0);
    localStorage.setItem(
      DEBATER_LEVEL_STORAGE_KEY,
      JSON.stringify({ ...createDebaterLevelState("2026-10-20"), daily: { dayKey: "2026-10-20", counts: { card_cut: 6 }, completedChallengeIds: [] } }),
    );
    expect(settleDebaterChallenges(NOW).xpGained).toBe(100);
    expect(loadDebaterLevelState().totalXp).toBe(100);
    expect(awards).toHaveLength(1);
    expect(settleDebaterChallenges(NOW).xpGained).toBe(0);
    expect(awards).toHaveLength(1);
  });
});
