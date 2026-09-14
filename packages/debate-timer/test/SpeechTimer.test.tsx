// @vitest-environment jsdom
/**
 * @fileoverview Covers SpeechTimer, the countdown that runs each speech in a
 * round. Unlike PrepTimer its reset time comes from the speech list rather than
 * a prop, and finishing can either hand off to `onFinish` (advance to the next
 * speech) or fall back to marking the timer done.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpeechTimer } from "../src/timers/SpeechTimer";
import type { SpeechTimerState, TimerSpeech } from "../src/types";
import { blur, click, keyDown, mount, stubAudio, type } from "./helpers/mount";

const SPEECHES: TimerSpeech[] = [
  { name: "1AC", time: 8, secondary: false },
  { name: "1NC", time: 8, secondary: true },
  { name: "1AR", time: 5, secondary: false },
];

const EIGHT_MINUTES = 8 * 60_000;

const PAUSED: SpeechTimerState["state"] = { name: "paused" };
const DONE: SpeechTimerState["state"] = { name: "done" };
const running = (startTime: number): SpeechTimerState["state"] => ({
  name: "running",
  startTime,
});

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

const props = (overrides: Record<string, unknown> = {}) =>
  ({
    speeches: SPEECHES,
    resetTimeIndex: 0,
    time: EIGHT_MINUTES,
    state: PAUSED,
    hideMicSelector: true,
    onResetTimeIndexChange: vi.fn(),
    onTimeChange: vi.fn(),
    onStateChange: vi.fn(),
    ...overrides,
  }) as Parameters<typeof SpeechTimer>[0];

describe("SpeechTimer display", () => {
  it("shows the speech time as minutes and zero-padded seconds", async () => {
    const view = await mount(<SpeechTimer {...props({ time: 305_000 })} />);
    const [minutes, seconds] = inputsOf(view.container);
    expect(minutes.value).toBe("5");
    expect(seconds.value).toBe("05");
    await view.unmount();
  });

  it("re-syncs the display when the time prop changes", async () => {
    const view = await mount(<SpeechTimer {...props({ time: 305_000 })} />);
    await view.rerender(<SpeechTimer {...props({ time: 61_000 })} />);
    expect(inputsOf(view.container).map((i) => i.value)).toEqual(["1", "01"]);
    await view.unmount();
  });

  it("escalates from a two-minute warning to a thirty-second one to done", async () => {
    const early = await mount(<SpeechTimer {...props({ time: 90_000 })} />);
    expect(early.container.innerHTML).toContain("text-orange-500");
    await early.unmount();

    const late = await mount(<SpeechTimer {...props({ time: 20_000 })} />);
    expect(late.container.innerHTML).toContain("text-yellow-600");
    expect(late.container.innerHTML).not.toContain("text-orange-500");
    await late.unmount();

    const over = await mount(<SpeechTimer {...props({ time: 0 })} />);
    expect(over.container.innerHTML).toContain("animate-pulse");
    await over.unmount();
  });

  it("uses the secondary palette for a second-team speech", async () => {
    const aff = await mount(<SpeechTimer {...props({ resetTimeIndex: 0 })} />);
    expect(aff.container.innerHTML).toContain("palette-accent");
    expect(aff.container.innerHTML).not.toContain("palette-accent-secondary");
    await aff.unmount();

    const neg = await mount(<SpeechTimer {...props({ resetTimeIndex: 1 })} />);
    expect(neg.container.innerHTML).toContain("palette-accent-secondary");
    await neg.unmount();
  });

  it("locks the inputs while the speech is running", async () => {
    const view = await mount(
      <SpeechTimer {...props({ state: running(Date.now()) })} />,
    );
    expect(inputsOf(view.container).every((i) => i.disabled)).toBe(true);
    await view.unmount();
  });

  it("tightens its layout in compact mode", async () => {
    const normal = await mount(<SpeechTimer {...props()} />);
    const compact = await mount(<SpeechTimer {...props({ compact: true })} />);
    expect(normal.container.innerHTML).toContain("text-4xl");
    expect(compact.container.innerHTML).toContain("text-2xl");
    await normal.unmount();
    await compact.unmount();
  });

  it("renders children inside the ring", async () => {
    const view = await mount(
      <SpeechTimer {...props()}>
        <span data-testid="ring-child">flow</span>
      </SpeechTimer>,
    );
    expect(view.container.querySelector("[data-testid=ring-child]")).not.toBeNull();
    await view.unmount();
  });
});

describe("SpeechTimer countdown", () => {
  it("counts down from the current speech's own length", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const view = await mount(
      <SpeechTimer
        {...props({
          // The 1AR is five minutes, not eight.
          resetTimeIndex: 2,
          time: 5 * 60_000,
          state: running(Date.now()),
          onTimeChange,
        })}
      />,
    );

    await vi.advanceTimersByTimeAsync(1_000);

    const latest = onTimeChange.mock.lastCall?.[0] as number;
    expect(latest).toBeLessThanOrEqual(5 * 60_000);
    expect(latest).toBeGreaterThan(5 * 60_000 - 2_000);
    await view.unmount();
  });

  it("hands off to onFinish when the speech runs out", async () => {
    vi.useFakeTimers();
    const onFinish = vi.fn();
    const onStateChange = vi.fn();
    const view = await mount(
      <SpeechTimer
        {...props({
          state: running(Date.now() - EIGHT_MINUTES),
          onFinish,
          onStateChange,
        })}
      />,
    );

    await vi.advanceTimersByTimeAsync(200);

    expect(onFinish).toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalledWith({ name: "done" });
    await view.unmount();
  });

  it("marks the timer done when there is no onFinish handler", async () => {
    vi.useFakeTimers();
    const onStateChange = vi.fn();
    const view = await mount(
      <SpeechTimer
        {...props({
          state: running(Date.now() - EIGHT_MINUTES),
          onStateChange,
        })}
      />,
    );

    await vi.advanceTimersByTimeAsync(200);

    expect(onStateChange).toHaveBeenCalledWith({ name: "done" });
    await view.unmount();
  });

  it("does not tick while paused", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const view = await mount(<SpeechTimer {...props({ onTimeChange })} />);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onTimeChange).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("clears its interval on unmount", async () => {
    vi.useFakeTimers();
    const onTimeChange = vi.fn();
    const view = await mount(
      <SpeechTimer {...props({ state: running(Date.now()), onTimeChange })} />,
    );
    await view.unmount();
    onTimeChange.mockClear();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onTimeChange).not.toHaveBeenCalled();
  });
});

describe("SpeechTimer play/pause button", () => {
  it("starts a paused speech, back-dating the start by the time already used", async () => {
    const onStateChange = vi.fn();
    const view = await mount(
      <SpeechTimer
        {...props({ time: EIGHT_MINUTES - 60_000, onStateChange })}
      />,
    );

    await click(buttonOf(view.container));

    const [state] = onStateChange.mock.lastCall as [SpeechTimerState["state"]];
    expect(state.name).toBe("running");
    expect(Date.now() - (state as { startTime: number }).startTime).toBeCloseTo(
      60_000,
      -2,
    );
    await view.unmount();
  });

  it("pauses a running speech", async () => {
    const onStateChange = vi.fn();
    const view = await mount(
      <SpeechTimer {...props({ state: running(Date.now()), onStateChange })} />,
    );
    await click(buttonOf(view.container));
    expect(onStateChange).toHaveBeenCalledWith({ name: "paused" });
    await view.unmount();
  });

  it("resets a finished speech to its full length", async () => {
    const onTimeChange = vi.fn();
    const onStateChange = vi.fn();
    const view = await mount(
      <SpeechTimer
        {...props({ state: DONE, time: 0, onTimeChange, onStateChange })}
      />,
    );
    await click(buttonOf(view.container));
    expect(onTimeChange).toHaveBeenCalledWith(EIGHT_MINUTES);
    expect(onStateChange).toHaveBeenCalledWith({ name: "paused" });
    await view.unmount();
  });

  it("turns red while the speech is running", async () => {
    const view = await mount(
      <SpeechTimer {...props({ state: running(Date.now()) })} />,
    );
    expect(buttonOf(view.container).className).toContain("bg-red-500");
    await view.unmount();
  });
});

describe("SpeechTimer keyboard editing", () => {
  it("bumps the minutes with the arrow keys", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(
      <SpeechTimer {...props({ time: 120_000, onTimeChange })} />,
    );
    const [minutes] = inputsOf(view.container);

    await keyDown(minutes, "ArrowUp");
    expect(onTimeChange).toHaveBeenLastCalledWith(180_000);

    await keyDown(minutes, "ArrowDown");
    expect(onTimeChange).toHaveBeenLastCalledWith(120_000);
    await view.unmount();
  });

  it("clamps the seconds to 0..59", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(
      <SpeechTimer {...props({ time: 59_000, onTimeChange })} />,
    );
    const seconds = inputsOf(view.container)[1];

    await keyDown(seconds, "ArrowUp");
    expect(onTimeChange).toHaveBeenLastCalledWith(59_000);
    await view.unmount();
  });

  it("moves focus between the two fields with left/right", async () => {
    const view = await mount(<SpeechTimer {...props()} />);
    const [minutes, seconds] = inputsOf(view.container);

    await keyDown(minutes, "ArrowRight");
    expect(document.activeElement).toBe(seconds);

    await keyDown(seconds, "ArrowLeft");
    expect(document.activeElement).toBe(minutes);
    await view.unmount();
  });

  it("starts the speech on Enter", async () => {
    const onStateChange = vi.fn();
    const view = await mount(
      <SpeechTimer {...props({ time: 120_000, onStateChange })} />,
    );
    await keyDown(inputsOf(view.container)[0], "Enter");
    expect(onStateChange.mock.lastCall?.[0]).toMatchObject({ name: "running" });
    await view.unmount();
  });

  it("zero-pads and clamps a typed seconds value on blur", async () => {
    const onTimeChange = vi.fn();
    const view = await mount(
      <SpeechTimer {...props({ time: 0, onTimeChange })} />,
    );
    const seconds = inputsOf(view.container)[1];

    await type(seconds, "75");
    await blur(seconds);

    expect(inputsOf(view.container)[1].value).toBe("59");
    expect(onTimeChange).toHaveBeenLastCalledWith(59_000);
    await view.unmount();
  });
});
