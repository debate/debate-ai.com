import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEBATER_ACTIVITY_EVENT,
  DEBATER_LEVEL_STORAGE_KEY,
  DEBATER_XP_AWARDED_EVENT,
  installDebaterActivityListener,
  loadDebaterLevelState,
  recordDebaterActivity,
  resetDebaterLevelState,
} from "../src/state/debaterLevel";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const DAY1 = Date.parse("2026-09-26T12:00:00Z");

describe("state/debaterLevel", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage = new MemoryStorage();
    (globalThis as { window?: EventTarget }).window = new EventTarget() as unknown as Window & typeof globalThis;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
    delete (globalThis as { window?: unknown }).window;
  });

  it("starts at zero and degrades corrupt storage to a fresh state", () => {
    expect(loadDebaterLevelState().totalXp).toBe(0);
    localStorage.setItem(DEBATER_LEVEL_STORAGE_KEY, "{not json");
    expect(loadDebaterLevelState().totalXp).toBe(0);
  });

  it("persists recorded activity and announces the award", () => {
    const awards: unknown[] = [];
    window.addEventListener(DEBATER_XP_AWARDED_EVENT, (event) => awards.push((event as CustomEvent).detail));
    const result = recordDebaterActivity("rebuttal_redo", 1, DAY1);
    expect(result.xpGained).toBe(90);
    expect(loadDebaterLevelState().totalXp).toBe(90);
    expect(awards).toHaveLength(1);
    expect(resetDebaterLevelState().totalXp).toBe(0);
    expect(loadDebaterLevelState().totalXp).toBe(0);
  });

  it("records valid activity events and ignores malformed ones", () => {
    const uninstall = installDebaterActivityListener();
    window.dispatchEvent(new CustomEvent(DEBATER_ACTIVITY_EVENT, { detail: { kind: "card_cut", count: 2 } }));
    window.dispatchEvent(new CustomEvent(DEBATER_ACTIVITY_EVENT, { detail: { kind: "nonsense" } }));
    window.dispatchEvent(new CustomEvent(DEBATER_ACTIVITY_EVENT, { detail: null }));
    expect(loadDebaterLevelState().lifetimeCounts).toEqual({ card_cut: 2 });
    uninstall();
    window.dispatchEvent(new CustomEvent(DEBATER_ACTIVITY_EVENT, { detail: { kind: "card_cut" } }));
    expect(loadDebaterLevelState().lifetimeCounts).toEqual({ card_cut: 2 });
  });
});
