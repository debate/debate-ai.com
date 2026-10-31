/**
 * @fileoverview The Greatest of All-Time banner renders its title on the
 * server, before the particle engine has loaded on the client.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GOAT_HEADING_TITLE,
  GoatSparklesHeading,
  TROPHY_EFFECTS,
  pickTrophyEffect,
} from "../src/components/navigation/category-gallery/GoatSparklesHeading";

describe("GoatSparklesHeading", () => {
  it("renders the All Time Greatest Legends title as the page heading", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    expect(GOAT_HEADING_TITLE).toBe("All Time Greatest Legends");
    expect(html).toMatch(/<h1[^>]*>All Time Greatest Legends<\/h1>/);
  });

  it("draws the title in animated dots that stop for reduced motion", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    expect(html).toMatch(/<h1[^>]*class="[^"]*goat-dots-title[^"]*text-transparent/);
    expect(html).toContain("@keyframes goat-dots-in");
    expect(html).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.goat-dots-title \{ animation: none; \}/);
  });

  it("shows the trophy-goat icon in the header", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    expect(html).toMatch(/<img[^>]*alt="Greatest of All-Time trophy"[^>]*src="data:image\/svg/);
  });

  it("wraps the trophy in a button and stops its effects for reduced motion", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    expect(html).toMatch(/<button[^>]*aria-label="Celebrate the Greatest of All-Time trophy"/);
    expect(html).toContain("@keyframes goat-fx-spin");
    expect(html).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.goat-trophy-fx, \.goat-trophy-confetti \{ animation: none !important; \}/);
  });

  it("defines a CSS class for every trophy effect", () => {
    const html = renderToStaticMarkup(<GoatSparklesHeading />);
    for (const effect of TROPHY_EFFECTS) {
      expect(html).toContain(`.goat-trophy-fx-${effect} {`);
    }
  });
});

describe("pickTrophyEffect", () => {
  it("never repeats the previous effect", () => {
    for (const previous of TROPHY_EFFECTS) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
        const next = pickTrophyEffect(previous, () => r);
        expect(next).not.toBe(previous);
        expect(TROPHY_EFFECTS).toContain(next);
      }
    }
  });

  it("can reach every effect from a fresh start", () => {
    const seen = new Set(
      TROPHY_EFFECTS.map((_, i) => pickTrophyEffect(null, () => i / TROPHY_EFFECTS.length)),
    );
    expect(seen.size).toBe(TROPHY_EFFECTS.length);
  });
});
