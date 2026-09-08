import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { TimerProgressRing } from "../src/timers/TimerProgressRing";

const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function dashoffsetOf(html: string): number {
  const match = html.match(/stroke-dashoffset="([\d.]+)"/);
  if (!match) throw new Error(`no stroke-dashoffset in rendered markup: ${html}`);
  return Number(match[1]);
}

describe("TimerProgressRing", () => {
  it("renders a full ring at progress 0 (fresh/full time left)", () => {
    const html = renderToStaticMarkup(<TimerProgressRing progress={0} />);
    expect(dashoffsetOf(html)).toBeCloseTo(0);
  });

  it("renders an empty ring at progress 1 (time's up)", () => {
    const html = renderToStaticMarkup(<TimerProgressRing progress={1} />);
    expect(dashoffsetOf(html)).toBeCloseTo(CIRCUMFERENCE);
  });

  it("clamps out-of-range progress into [0, 1]", () => {
    const over = renderToStaticMarkup(<TimerProgressRing progress={5} />);
    const under = renderToStaticMarkup(<TimerProgressRing progress={-5} />);
    expect(dashoffsetOf(over)).toBeCloseTo(CIRCUMFERENCE);
    expect(dashoffsetOf(under)).toBeCloseTo(0);
  });

  it("defaults to a stroke-width of 10 and honors an override", () => {
    const defaultWidth = renderToStaticMarkup(<TimerProgressRing progress={0.5} />);
    const customWidth = renderToStaticMarkup(<TimerProgressRing progress={0.5} strokeWidth={4} />);
    expect(defaultWidth).toContain('stroke-width="10"');
    expect(customWidth).toContain('stroke-width="4"');
  });

  it("passes through the className prop onto the wrapping svg", () => {
    const html = renderToStaticMarkup(<TimerProgressRing progress={0.5} className="text-primary" />);
    expect(html).toContain('class="text-primary"');
  });
});
