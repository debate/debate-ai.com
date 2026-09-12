import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FeaturesPanel } from "../src/features/FeaturesPanel";
import { cardHueShift } from "../src/features/effects";
import { APP_FEATURES } from "../src/features/feature-catalog";

describe("FeaturesPanel", () => {
  const html = renderToStaticMarkup(<FeaturesPanel />);

  it("renders every catalogued feature with its route", () => {
    for (const feature of APP_FEATURES) {
      expect(html).toContain(`href="${feature.href}"`);
    }
  });

  it("renders each category heading and the catalog summary line", () => {
    expect(html).toContain("Core Workspaces");
    expect(html).toContain("Standings &amp; Rankings");
    expect(html).toContain(`${APP_FEATURES.length} features across 8 categories`);
  });

  it("links entries that have a long-form doc", () => {
    expect(html).toContain(
      "https://github.com/debate/debate-ai.com/blob/master/docs/features/task-inbox.md",
    );
  });

  it("renders a jump-to-category nav", () => {
    expect(html).toContain('href="#practice"');
    expect(html).toContain('aria-label="Jump to a category"');
  });

  it("renders only the entries it is given", () => {
    const single = renderToStaticMarkup(
      <FeaturesPanel entries={[APP_FEATURES.find((f) => f.id === "task-inbox")!]} />,
    );
    expect(single).toContain("Task Inbox");
    expect(single).not.toContain("Practice Drills");
    // A single section means no jump-to-category row.
    expect(single).not.toContain('aria-label="Jump to a category"');
  });

  it("renders the shared EmptyState when no feature matches the search query", () => {
    const single = renderToStaticMarkup(
      <FeaturesPanel entries={[APP_FEATURES.find((f) => f.id === "task-inbox")!]} />,
    );
    expect(single).not.toContain('data-slot="empty-state"');

    const empty = renderToStaticMarkup(<FeaturesPanel entries={[]} />);
    expect(empty).toContain('data-slot="empty-state"');
    expect(empty).toContain("No features match &quot;&quot;.");
  });

  it("gives every card its own hover hue", () => {
    // Unitless, because `globals.css` adds it to the bare `--accent-hue`
    // inside one `calc()`.
    for (const [index] of APP_FEATURES.entries()) {
      expect(html).toContain(`--da-card-hue:${cardHueShift(index)}`);
    }
    expect(html).toContain("da-card-tint");
  });

  it("colours a card by its catalog position, not its place in the filter", () => {
    const index = APP_FEATURES.findIndex((f) => f.id === "task-inbox");
    expect(index).toBeGreaterThan(0);

    // Rendered alone it is the only card on the page, but it keeps the hue its
    // catalog position gives it — so searching does not recolour the grid.
    const single = renderToStaticMarkup(
      <FeaturesPanel entries={[APP_FEATURES.find((f) => f.id === "task-inbox")!]} />,
    );
    expect(single).toContain(`--da-card-hue:${cardHueShift(0)}`);
    expect(html).toContain(`--da-card-hue:${cardHueShift(index)}`);
  });
});

describe("cardHueShift", () => {
  it("stays inside one turn of the wheel", () => {
    for (let i = 0; i < 200; i++) {
      const hue = cardHueShift(i);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("separates neighbours far enough to read as different colours", () => {
    // Consecutive cards are a golden angle apart, so no row of a three-column
    // grid can come up in near-identical hues.
    for (let i = 0; i < 200; i++) {
      const gap = Math.abs(cardHueShift(i + 1) - cardHueShift(i));
      expect(Math.min(gap, 360 - gap)).toBeGreaterThan(80);
    }
  });

  it("is stable for a given index", () => {
    expect(cardHueShift(7)).toBe(cardHueShift(7));
    expect(cardHueShift(0)).toBe(0);
  });
});
