import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FeaturesPanel } from "../src/features/FeaturesPanel";
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
});
