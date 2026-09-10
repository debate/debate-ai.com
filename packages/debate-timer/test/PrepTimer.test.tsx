// @vitest-environment jsdom
/**
 * @fileoverview Covers PrepTimer, the countdown each team burns its prep time
 * on. The behaviour that matters in a round is that the clock actually runs
 * down, that it stops and fires at zero, and that a debater can retype the time
 * or nudge it with the arrow keys between speeches.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrepTimer } from "../src/timers/PrepTimer";
import type { TimerState } from "../src/types";
import { blur, click, keyDown, mount, stubAudio, type } from "./helpers/mount";

const PAUSED: TimerState["state"] = { name: "paused" };
const DONE: TimerState["state"] = { name: "done" };
const running = (startTime: number): TimerState["state"] => ({
  name: "running",
  startTime,
});

const FIVE_MINUTES = 300_000;

const inputsOf = (container: HTMLElement) =>
  [...container.querySelectorAll("input")] as HTMLInputElement[];
const buttonOf = (container: HTMLElement) =>
  container.querySelector("button") as HTMLButtonElement;

let restoreAudio: () => void;

beforeEach(() => {
  restoreAudio = stubAudio();
});

afterEach(() => {
  restoreAudio();
  vi.useRealTimers();
});

const props = (overrides: Partial<Parameters<typeof PrepTimer>[0]> = {}) => ({
  resetTime: FIVE_MINUTES,
  time: FIVE_MINUTES,
  state: PAUSED,
  onTimeChange: vi.fn(),
  onStateChange: vi.fn(),
  ...overrides,
});

describe("PrepTimer display", () => {
  it("shows the remaining time as minutes and zero-padded seconds", async () => {
    const view = await mount(<PrepTimer {...props({ time: 125_000 })} />);
    const [minutes, seconds] = inputsOf(view.container);
    expect(minutes.value).toBe("2");
    expect(seconds.value).toBe("05");
    await view.unmount();
  });

  it("re-syncs the display when the time prop changes", async () => {
    const view = await mount(<PrepTimer {...props({ time: 125_000 })} />);
    await view.rerender(<PrepTimer {...props({ time: 61_000 })} />);
    const [minutes, seconds] = inputsOf(view.container);
    expect(minutes.value).toBe("1");
    expect(seconds.value).toBe("01");
    await view.unmount();
  });

  it("renders an optional label", async () => {
    const view = await mount(<PrepTimer {...props({ label: "Aff prep" })} />);
    expect(view.container.textContent).toContain("Aff prep");
    await view.unmount();
  });

  it("locks the inputs while the timer is running", async () => {
    const view = await mount(
      <PrepTimer {...props({ state: running(Date.now()) })} />,
    );
    expect(inputsOf(view.container).every((i) => i.disabled)).toBe(true);
    await view.unmount();
  });

  it("leaves the inputs editable while paused", async () => {
    const view = await mount(<PrepTimer {...props()} />);
    expect(inputsOf(view.container).some((i) => i.disabled)).toBe(false);
    await view.unmount();
  });

  it("warns in the last thirty seconds", async () => {
    const view = await mount(<PrepTimer {...props({ time: 20_000 })} />);
    expect(view.container.innerHTML).toContain("text-yellow-600");
    await view.unmount();
  });

  it("marks the timer done at zero rather than merely warning", async () => {
    const view = await mount(<PrepTimer {...props({ time: 0 })} />);
    expect(view.container.innerHTML).toContain("animate-pulse");
    expect(view.container.innerHTML).not.toContain("text-yellow-600");
    await view.unmount();
  });

  it("color-codes each side", async () => {
    const aff = await mount(<PrepTimer {...props({ color: "blue" })} />);
    expect(aff.container.innerHTML).toContain("text-blue-500");
    await aff.unmount();

    const neg = await mount(<PrepTimer {...props({ color: "red" })} />);
    expect(neg.container.innerHTML).toContain("text-red-500");
    await neg.unmount();
  });

  it("tightens its layout in compact mode", async () => {
    const normal = await mount(<PrepTimer {...props()} />);
    const compact = await mount(<PrepTimer {...props({ compact: true })} />);
    expect(normal.container.innerHTML).toContain("text-2xl");
    expect(compact.container.innerHTML).toContain("text-lg");
    await normal.unmount();
    await compact.unmount();
  });

  it("can hide its controls until the timer is hovered", async () => {
    const view = await mount(
      <PrepTimer {...props({ hideControlsByDefault: true })} />,
    );
    expect(buttonOf(view.container).className).toContain(
      "sm:group-hover/timer:opacity-100",
    );
    await view.unmount();
  });
});

describe("PrepTimer countdown", () => {
  it("counts down from the reset time while running", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const start = Date.now();
    const view = await mount(
      <PrepTimer
        {...props({ state: running(start), onTimeChange })}
      />,
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(onTimeChange).toHaveBeenCalled();
    const latest = onTimeChange.mock.lastCall?.[0] as number;
    expect(latest).toBeLessThan(FIVE_MINUTES);
    expect(latest).toBeGreaterThan(FIVE_MINUTES - 2_000);
    await view.unmount();
  });

  it("stops at zero and reports the timer done", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const onStateChange = vi.fn();
    const view = await mount(
      <PrepTimer
        {...props({
          // Started five minutes ago, so the first tick lands on zero.
          state: running(Date.now() - FIVE_MINUTES),
          onTimeChange,
          onStateChange,
        })}
      />,
    );

    await vi.advanceTimersByTimeAsync(200);

    expect(onTimeChange).toHaveBeenCalledWith(0);
    expect(onStateChange).toHaveBeenCalledWith({ name: "done" });
    await view.unmount();
  });

  it("does not tick while paused", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const view = await mount(<PrepTimer {...props({ onTimeChange })} />);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onTimeChange).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("clears its interval on unmount", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const view = await mount(
      <PrepTimer {...props({ state: running(Date.now()), onTimeChange })} />,
    );
    await view.unmount();
    onTimeChange.mockClear();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onTimeChange).not.toHaveBeenCalled();
  });
});

describe("PrepTimer play/pause button", () => {
  it("starts a paused timer, back-dating the start by the time already used", async () => {
    const onStateChange = vi.fn();
    const view = await mount(
      <PrepTimer
        {...props({ time: FIVE_MINUTES - 60_000, onStateChange })}
      />,
    );

    await click(buttonOf(view.container));

    const [state] = onStateChange.mock.lastCall as [TimerState["state"]];
    expect(state.name).toBe("running");
    // One minute is already spent, so the start time sits a minute in the past.
    expect(Date.now() - (state as { startTime: number }).startTime).toBeCloseTo(
      60_000,
      -2,
    );
    await view.unmount();
  });

  it("pauses a running timer", async () => {
    const onStateChange = vi.fn();
    const view = await mount(
      <PrepTimer {...props({ state: running(Date.now()), onStateChange })} />,
    );
    await click(buttonOf(view.container));
    expect(onStateChange).toHaveBeenCalledWith({ name: "paused" });
    await view.unmount();
  });

  it("resets a finished timer back to full prep", async () => {
    const onTimeChange = vi.fn();
    const onStateChange = vi.fn();
    const view = await mount(
      <PrepTimer
        {...props({ state: DONE, time: 0, onTimeChange, onStateChange })}
      />,
    );
    await click(buttonOf(view.container));
    expect(onTimeChange).toHaveBeenCalledWith(FIVE_MINUTES);
    expect(onStateChange).toHaveBeenCalledWith({ name: "paused" });
    await view.unmount();
  });
});

describe("PrepTimer keyboard editing", () => {
  it("bumps the minutes with the arrow keys", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(
      <PrepTimer {...props({ time: 120_000, onTimeChange })} />,
    );
    const [minutes] = inputsOf(view.container);

    await keyDown(minutes, "ArrowUp");
    expect(onTimeChange).toHaveBeenLastCalledWith(180_000);

    await keyDown(minutes, "ArrowDown");
    expect(onTimeChange).toHaveBeenLastCalledWith(180_000 - 60_000);
    await view.unmount();
  });

  it("never takes the minutes below zero", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(<PrepTimer {...props({ time: 0, onTimeChange })} />);
    await keyDown(inputsOf(view.container)[0], "ArrowDown");
    expect(onTimeChange).toHaveBeenLastCalledWith(0);
    await view.unmount();
  });

  it("bumps the seconds with the arrow keys and clamps them at 59", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(
      <PrepTimer {...props({ time: 59_000, onTimeChange })} />,
    );
    const seconds = inputsOf(view.container)[1];

    await keyDown(seconds, "ArrowUp");
    expect(onTimeChange).toHaveBeenLastCalledWith(59_000);

    await keyDown(seconds, "ArrowDown");
    expect(onTimeChange).toHaveBeenLastCalledWith(58_000);
    await view.unmount();
  });

  it("moves focus between the two fields with left/right", async () => {
    const view = await mount(<PrepTimer {...props()} />);
    const [minutes, seconds] = inputsOf(view.container);

    await keyDown(minutes, "ArrowRight");
    expect(document.activeElement).toBe(seconds);

    await keyDown(seconds, "ArrowLeft");
    expect(document.activeElement).toBe(minutes);
    await view.unmount();
  });

  it("starts the timer on Enter from either field", async () => {
    for (const index of [0, 1]) {
      const onStateChange = vi.fn();
      const view = await mount(
        <PrepTimer {...props({ time: 120_000, onStateChange })} />,
      );
      await keyDown(inputsOf(view.container)[index], "Enter");
      expect(onStateChange.mock.lastCall?.[0]).toMatchObject({
        name: "running",
      });
      await view.unmount();
    }
  });
});

describe("PrepTimer blur handling", () => {
  it("zero-pads and clamps a typed seconds value", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(<PrepTimer {...props({ onTimeChange })} />);
    const seconds = inputsOf(view.container)[1];

    await type(seconds, "75");
    await blur(seconds);

    expect(inputsOf(view.container)[1].value).toBe("59");
    expect(onTimeChange).toHaveBeenLastCalledWith(5 * 60_000 + 59_000);
    await view.unmount();
  });

  it("reads a non-numeric entry as zero", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(<PrepTimer {...props({ onTimeChange })} />);
    const [minutes] = inputsOf(view.container);

    await type(minutes, "abc");
    await blur(minutes);

    expect(inputsOf(view.container)[0].value).toBe("0");
    expect(onTimeChange).toHaveBeenLastCalledWith(0);
    await view.unmount();
  });
});
