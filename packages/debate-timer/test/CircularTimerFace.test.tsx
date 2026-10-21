// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CircularTimerFace, formatCircularTimerCount } from "../src/timers/circular/CircularTimerFace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CIRCUMFERENCE = 2 * Math.PI * 90;

async function render(el: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(el));
  return { container, unmount: () => act(() => root.unmount()) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("formatCircularTimerCount", () => {
  it("rounds up to whole seconds and never goes negative", () => {
    expect(formatCircularTimerCount(0)).toBe("0:00");
    expect(formatCircularTimerCount(299_001)).toBe("5:00");
    expect(formatCircularTimerCount(61_000)).toBe("1:01");
    expect(formatCircularTimerCount(-5)).toBe("0:00");
  });
});

describe("CircularTimerFace", () => {
  it("depletes the ring with progress and marks the running state and accent", async () => {
    const { container } = await render(
      <CircularTimerFace progress={0.5} countText="2:30" title="1AC" ticking accent="rebuttal" onToggle={() => {}} />,
    );
    const face = container.querySelector(".dt-ctimer")!;
    expect(face.className).toContain("dt-ctimer--playing");
    expect(face.className).toContain("dt-ctimer--rebuttal");
    const circle = container.querySelector("circle") as SVGCircleElement;
    expect(Number.parseFloat(circle.style.strokeDashoffset)).toBeCloseTo(CIRCUMFERENCE / 2);
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("2:30");
    expect(container.textContent).toContain("1AC");
  });

  it("plays/pauses from a face click but not from its buttons", async () => {
    const onToggle = vi.fn();
    const onPick = vi.fn();
    const onReset = vi.fn();
    const { container } = await render(
      <CircularTimerFace
        progress={2}
        countText="0:00"
        ticking={false}
        onToggle={onToggle}
        prepButtons={[{ key: "aff", label: "3:00", accent: "aff", onClick: onPick, onDoubleClick: onReset }]}
      />,
    );
    const circle = container.querySelector("circle") as SVGCircleElement;
    expect(Number.parseFloat(circle.style.strokeDashoffset)).toBeCloseTo(CIRCUMFERENCE);

    await act(async () => (container.querySelector(".dt-ctimer") as HTMLElement).click());
    expect(onToggle).toHaveBeenCalledTimes(1);

    const btn = container.querySelector("button")!;
    await act(async () => btn.click());
    await act(async () => btn.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // A read-only count plays on click too.
    await act(async () => (container.querySelector("input") as HTMLInputElement).click());
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("edits the count while paused and submits on Enter", async () => {
    const onToggle = vi.fn();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { container } = await render(
      <CircularTimerFace
        progress={0}
        countText="5:00"
        ticking={false}
        onToggle={onToggle}
        onCountTextChange={onChange}
        onCountSubmit={onSubmit}
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    await act(async () => input.click());
    expect(onToggle).not.toHaveBeenCalled();
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onSubmit).toHaveBeenCalledWith("5:00");
  });
});
