/**
 * @fileoverview Pins the rating number: zero-padded to two digits, with the
 * leading tier digits shaded from gold at tier 10 down to gray at tier 0.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { RatingDigits, ratingTier, ratingTierColor } from "../src/panels/leaderboard/RatingDigits";

const render = (value: number) => renderToStaticMarkup(createElement(RatingDigits, { value }));

describe("RatingDigits", () => {
  it("zero-pads single-digit ratings so the tier digit is 0", () => {
    const html = render(3.2);
    expect(html).toContain('aria-label="03"');
    expect(html).toMatch(/>0<\/span><span[^>]*>3<\/span>/);
  });

  it("splits a three-digit rating into tier 10 and the last digit", () => {
    const html = render(104.4);
    expect(html).toContain('aria-label="104"');
    expect(html).toMatch(/>10<\/span><span[^>]*>4<\/span>/);
  });

  it("colors the tier digits by tier, the 0 included", () => {
    expect(render(7)).toContain(`color:${ratingTierColor(0)}`);
    expect(render(57)).toContain(`color:${ratingTierColor(5)}`);
  });

  it("reads the tier off the tens digit, clamped to 0–10", () => {
    expect([0, 9.4, 9.6, 10, 55, 99, 104, 130, -3].map(ratingTier)).toEqual([0, 0, 1, 1, 5, 9, 10, 10, 0]);
  });

  it("shades a distinct color per tier, more saturated toward the top", () => {
    const colors = Array.from({ length: 11 }, (_, t) => ratingTierColor(t));
    expect(new Set(colors).size).toBe(11);
    const saturation = (c: string) => Number(c.split(" ")[1].replace("%", ""));
    for (let t = 1; t <= 10; t++) expect(saturation(colors[t])).toBeGreaterThan(saturation(colors[t - 1]));
  });
});
