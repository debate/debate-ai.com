import { beforeEach, describe, expect, it } from "vitest";
import {
  loadBrainstormSessionTimer,
  pauseSessionTimer,
  resetSessionTimer,
  setSessionTimerDuration,
  startSessionTimer,
} from "../src/state/brainstormSessionTimer";
import {
  createBrainstormSessionTimer,
  DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS,
} from "../src/lib/brainstorm-session-timer";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("loadBrainstormSessionTimer", () => {
  it("returns a fresh idle default timer when nothing is stored", () => {
    expect(loadBrainstormSessionTimer()).toEqual(createBrainstormSessionTimer());
  });

  it("returns a fresh idle default timer when the stored value is corrupt JSON", () => {
    localStorage.setItem("brainstormSessionTimer", "{not json");
    expect(loadBrainstormSessionTimer()).toEqual(createBrainstormSessionTimer());
  });

  it("returns a fresh idle default timer when the stored value has the wrong shape", () => {
    localStorage.setItem("brainstormSessionTimer", JSON.stringify({ not: "a timer" }));
    expect(loadBrainstormSessionTimer()).toEqual(createBrainstormSessionTimer());
  });
});

describe("startSessionTimer", () => {
  it("persists a running timer", () => {
    const now = 1_700_000_000_000;
    const started = startSessionTimer(now);

    expect(started.status).toBe("running");
    expect(started.endsAt).toBe(now + DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS * 1000);
    expect(loadBrainstormSessionTimer()).toEqual(started);
  });
});

describe("pauseSessionTimer", () => {
  it("persists a paused timer with its remaining time frozen", () => {
    const now = 1_700_000_000_000;
    startSessionTimer(now);
    const paused = pauseSessionTimer(now + 60_000);

    expect(paused.status).toBe("paused");
    expect(paused.remainingSecondsWhenPaused).toBe(DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS - 60);
    expect(loadBrainstormSessionTimer()).toEqual(paused);
  });
});

describe("resetSessionTimer", () => {
  it("persists the timer back to idle", () => {
    startSessionTimer(1_700_000_000_000);
    const reset = resetSessionTimer();

    expect(reset.status).toBe("idle");
    expect(loadBrainstormSessionTimer()).toEqual(reset);
  });
});

describe("setSessionTimerDuration", () => {
  it("persists a new duration while idle", () => {
    const updated = setSessionTimerDuration(600);
    expect(updated.durationSeconds).toBe(600);
    expect(loadBrainstormSessionTimer().durationSeconds).toBe(600);
  });

  it("does not persist a duration change while running", () => {
    const now = 1_700_000_000_000;
    startSessionTimer(now);
    setSessionTimerDuration(600);
    expect(loadBrainstormSessionTimer().durationSeconds).toBe(DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS);
  });
});
