/**
 * @fileoverview Pins the rating number: divided by 10 to one decimal, with the
 * whole-number tier digits shaded from gold at tier 10 down to gray at tier 0.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { RatingDigits, ratingTier, ratingTierColor } from "../src/leaderboard/RatingDigits";
import { formatSiteRating } from "../src/rating-offset";

const render = (value: number) => renderToStaticMarkup(createElement(RatingDigits, { value }));

describe("RatingDigits", () => {
  it("shows single-digit ratings as 0.x so the tier digit is 0", () => {
    const html = render(3.2);
    expect(html).toContain('aria-label="0.3"');
    expect(html).toMatch(/>0<\/span><span[^>]*>\.3<\/span>/);
  });

  it("shows a top rating as tier 10 and its decimal", () => {
    const html = render(104.4);
    expect(html).toContain('aria-label="10.4"');
    expect(html).toMatch(/>10<\/span><span[^>]*>\.4<\/span>/);
  });

  it("divides by 10 to one decimal, so 96 reads 9.6", () => {
    expect(render(96)).toContain('aria-label="9.6"');
    expect(formatSiteRating(96)).toBe("9.6");
    expect(formatSiteRating(81.25)).toBe("8.1");
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
