/**
 * @fileoverview The per-device XP ledger: recording stamps the device's entry,
 * pre-ledger totals become the base, and persistence round-trips.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyDebaterActivity,
  createDebaterLevelState,
  parseDebaterLevelState,
  ACTIVITY_XP,
} from "../src/lib/debater-levels";
import {
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
