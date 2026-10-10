import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FeaturesPanel } from "../../../src/lib/ui/features/FeaturesPanel";
import { SpotlightCard, cardHueShift } from "../../../src/lib/ui/features/effects";
import { APP_FEATURES } from "../../../src/lib/feature-catalog";
import {
  README_BADGE_ROWS,
  README_BANNER,
  README_SHOWCASE,
  README_VIDEO,
} from "../../../src/lib/ui/features/readme-media";
import { CARDS_VISION } from "../../../src/lib/ui/features/cards-vision";

describe("FeaturesPanel", () => {
  const html = renderToStaticMarkup(<FeaturesPanel />);

  it("renders every catalogued feature with its route", () => {
    for (const feature of APP_FEATURES) {
      expect(html).toContain(`href="${feature.href}"`);
    }
  });

  it("renders each category heading", () => {
    expect(html).toContain("Core Workspaces");
    // Server rendering escapes the ampersand.
    expect(html).toContain("Recognition &amp; Progress");
  });

  it("links entries that have a long-form doc into the app's own docs site", () => {
    // The panel takes `featureDocUrl`'s default base, so a doc lands on
    // `/docs/features/…` without the source file's extension.
    expect(html).toContain("/docs/features/task-inbox");
    expect(html).not.toContain("task-inbox.md");
  });

  it("shows the root README's banner, badges and workspace screenshots", () => {
    expect(html).toContain(`src="${README_BANNER}"`);
    for (const badge of README_BADGE_ROWS.flat()) {
      expect(html).toContain(`src="${badge.src.replace(/&/g, "&amp;")}"`);
    }
    for (const workspace of README_SHOWCASE) {
      expect(html).toContain(`src="${workspace.image}"`);
      expect(html).toContain(`href="${workspace.href}"`);
    }
  });

  it("embeds the tour video behind a click on the banner, not on page load", () => {
    // The whole point of the poster is that nothing is requested from YouTube
    // until a reader asks for it, so the server-rendered page carries the
    // banner — the video's poster frame and the button that starts it — and no
    // YouTube iframe. (The Drive folder viewer further down is deliberately
    // mounted up front, so it is the one iframe allowed.)
    expect(html).toContain(`src="${README_BANNER}"`);
    expect(html).toContain(`aria-label="Play video: ${README_VIDEO.title}"`);
    expect(html).not.toMatch(/<iframe[^>]*youtube/);
    expect(html).not.toContain("youtube-nocookie.com/embed");
  });

  it("offers the video on YouTube as well as embedded", () => {
    expect(html).toContain(`href="${README_VIDEO.watchUrl}"`);
  });

  it("renders the CARDS overview and every point of its vision", () => {
    expect(html).toContain('id="cards-vision"');
    expect(html).toContain("Crowdsourced Annotated Research for Debating Solutions (CARDS)");
    expect(html).toContain("war of warrants");
    for (const point of CARDS_VISION) {
      expect(html).toContain(point.title);
    }
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

describe("SpotlightCard", () => {
  it("renders static markup with initial hueShift style", () => {
    const cardHtml = renderToStaticMarkup(
      <SpotlightCard hueShift={120}>
        <div>Card Content</div>
      </SpotlightCard>,
    );
    expect(cardHtml).toContain("--da-card-hue:120");
    expect(cardHtml).toContain("da-card-tint");
    expect(cardHtml).toContain("da-border-beam");
    expect(cardHtml).toContain("Card Content");
  });

  it("renders without tint when hueShift is omitted", () => {
    const cardHtml = renderToStaticMarkup(
      <SpotlightCard>
        <div>Plain Card</div>
      </SpotlightCard>,
    );
    expect(cardHtml).not.toContain("da-card-tint");
    expect(cardHtml).toContain("Plain Card");
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

  it("shifts hues predictably when an offset is provided", () => {
    expect(cardHueShift(0, 90)).toBe(90);
    expect(cardHueShift(0, 360)).toBe(0);
    expect(cardHueShift(0, 450)).toBe(90);
    for (let i = 0; i < 50; i++) {
      const hue = cardHueShift(i, 120);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("maintains separation between neighbouring cards even with an offset", () => {
    const offset = 77;
    for (let i = 0; i < 50; i++) {
      const gap = Math.abs(cardHueShift(i + 1, offset) - cardHueShift(i, offset));
      expect(Math.min(gap, 360 - gap)).toBeGreaterThan(80);
    }
  });
});

describe("FeaturesPanel downloads", () => {
  const html = renderToStaticMarkup(<FeaturesPanel />);

  it("has a Downloads section with the Chrome extension button above the badges", () => {
    expect(html).toContain('data-testid="downloads"');
    expect(html).toContain("Downloads");
    expect(html).toContain("noecbaibfhbmpapofcdkgchfifmoinfj");
    expect(html.indexOf('data-testid="downloads"')).toBeLessThan(html.indexOf('data-testid="readme-badges"'));
  });
});
