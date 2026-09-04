import { describe, expect, it } from "vitest";
import {
  BRAINSTORM_SESSION_TIMER_PRESETS_SECONDS,
  createBrainstormSessionTimer,
  DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS,
  formatBrainstormSessionTimerRemaining,
  getBrainstormSessionTimerRemainingSeconds,
  isBrainstormSessionTimerExpired,
  pauseBrainstormSessionTimer,
  resetBrainstormSessionTimer,
  setBrainstormSessionTimerDuration,
  startBrainstormSessionTimer,
} from "../src/lib/brainstorm-session-timer";

const T0 = 1_700_000_000_000;

describe("createBrainstormSessionTimer", () => {
  it("defaults to an idle timer at the default 5-minute duration", () => {
    expect(createBrainstormSessionTimer()).toEqual({
      durationSeconds: DEFAULT_BRAINSTORM_SESSION_TIMER_SECONDS,
      status: "idle",
      endsAt: null,
      remainingSecondsWhenPaused: null,
    });
  });

  it("accepts a custom duration", () => {
    expect(createBrainstormSessionTimer(120).durationSeconds).toBe(120);
  });
});

describe("getBrainstormSessionTimerRemainingSeconds", () => {
  it("returns the full duration while idle, regardless of now", () => {
    const timer = createBrainstormSessionTimer(180);
    expect(getBrainstormSessionTimerRemainingSeconds(timer, T0)).toBe(180);
    expect(getBrainstormSessionTimerRemainingSeconds(timer, T0 + 999_999)).toBe(180);
  });

  it("counts down while running", () => {
    const timer = startBrainstormSessionTimer(createBrainstormSessionTimer(180), T0);
    expect(getBrainstormSessionTimerRemainingSeconds(timer, T0)).toBe(180);
    expect(getBrainstormSessionTimerRemainingSeconds(timer, T0 + 45_000)).toBe(135);
  });

  it("clamps to zero once the countdown has elapsed, not negative", () => {
    const timer = startBrainstormSessionTimer(createBrainstormSessionTimer(60), T0);
    expect(getBrainstormSessionTimerRemainingSeconds(timer, T0 + 90_000)).toBe(0);
  });

  it("returns the frozen remaining time while paused", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(180), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 60_000);
    expect(getBrainstormSessionTimerRemainingSeconds(paused, T0 + 999_999)).toBe(120);
  });
});

describe("startBrainstormSessionTimer", () => {
  it("starts a fresh idle timer at its full configured duration", () => {
    const timer = startBrainstormSessionTimer(createBrainstormSessionTimer(300), T0);
    expect(timer.status).toBe("running");
    expect(timer.endsAt).toBe(T0 + 300_000);
  });

  it("resumes a paused timer from its frozen remaining time, not the full duration", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(300), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 100_000);
    const resumed = startBrainstormSessionTimer(paused, T0 + 500_000);

    expect(resumed.status).toBe("running");
    expect(resumed.remainingSecondsWhenPaused).toBeNull();
    expect(getBrainstormSessionTimerRemainingSeconds(resumed, T0 + 500_000)).toBe(200);
  });
});

describe("pauseBrainstormSessionTimer", () => {
  it("freezes the remaining time and clears endsAt", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(180), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 30_000);

    expect(paused.status).toBe("paused");
    expect(paused.endsAt).toBeNull();
    expect(paused.remainingSecondsWhenPaused).toBe(150);
  });

  it("is a no-op on an idle timer", () => {
    const idle = createBrainstormSessionTimer(180);
    expect(pauseBrainstormSessionTimer(idle, T0)).toEqual(idle);
  });

  it("is a no-op on an already-paused timer", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(180), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 30_000);
    expect(pauseBrainstormSessionTimer(paused, T0 + 60_000)).toEqual(paused);
  });
});

describe("resetBrainstormSessionTimer", () => {
  it("returns a running timer to idle at its configured duration", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(180), T0);
    const reset = resetBrainstormSessionTimer(running);

    expect(reset).toEqual(createBrainstormSessionTimer(180));
  });

  it("returns a paused timer to idle too", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(180), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 30_000);
    expect(resetBrainstormSessionTimer(paused)).toEqual(createBrainstormSessionTimer(180));
  });
});

describe("setBrainstormSessionTimerDuration", () => {
  it("changes the duration while idle", () => {
    const timer = setBrainstormSessionTimerDuration(createBrainstormSessionTimer(300), 600);
    expect(timer.durationSeconds).toBe(600);
  });

  it("is a no-op while running", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(300), T0);
    expect(setBrainstormSessionTimerDuration(running, 600)).toEqual(running);
  });

  it("is a no-op while paused", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(300), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 30_000);
    expect(setBrainstormSessionTimerDuration(paused, 600)).toEqual(paused);
  });
});

describe("isBrainstormSessionTimerExpired", () => {
  it("is false while idle", () => {
    expect(isBrainstormSessionTimerExpired(createBrainstormSessionTimer(60), T0)).toBe(false);
  });

  it("is false while running with time left", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(60), T0);
    expect(isBrainstormSessionTimerExpired(running, T0 + 30_000)).toBe(false);
  });

  it("is true once a running countdown reaches zero", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(60), T0);
    expect(isBrainstormSessionTimerExpired(running, T0 + 60_000)).toBe(true);
    expect(isBrainstormSessionTimerExpired(running, T0 + 90_000)).toBe(true);
  });

  it("is false once expired time is paused (frozen at zero, but not running)", () => {
    const running = startBrainstormSessionTimer(createBrainstormSessionTimer(60), T0);
    const paused = pauseBrainstormSessionTimer(running, T0 + 90_000);
    expect(isBrainstormSessionTimerExpired(paused, T0 + 90_000)).toBe(false);
  });
});

describe("formatBrainstormSessionTimerRemaining", () => {
  it("formats whole minutes", () => {
    expect(formatBrainstormSessionTimerRemaining(300)).toBe("5:00");
  });

  it("pads single-digit seconds", () => {
    expect(formatBrainstormSessionTimerRemaining(125)).toBe("2:05");
  });

  it("formats under a minute", () => {
    expect(formatBrainstormSessionTimerRemaining(45)).toBe("0:45");
  });

  it("formats zero", () => {
    expect(formatBrainstormSessionTimerRemaining(0)).toBe("0:00");
  });

  it("clamps negative input to zero", () => {
    expect(formatBrainstormSessionTimerRemaining(-10)).toBe("0:00");
  });
});

describe("BRAINSTORM_SESSION_TIMER_PRESETS_SECONDS", () => {
  it("offers 3/5/10/15 minute presets", () => {
    expect(BRAINSTORM_SESSION_TIMER_PRESETS_SECONDS).toEqual([180, 300, 600, 900]);
  });
});
