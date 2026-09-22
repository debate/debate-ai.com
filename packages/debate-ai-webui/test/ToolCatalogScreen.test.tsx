import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolCatalogScreen } from "../src/screens/ToolCatalogScreen";
import { createWebUiClient } from "../src/api";
import type { WebUIContext } from "../src/types";

/**
 * The catalog screen is the one that needs no network — it renders
 * `debate-feature-catalog`'s pure data — which is what makes it the screen
 * worth asserting the markup of.
 */
const context: WebUIContext = {
  client: createWebUiClient("https://debate-ai.com"),
  origin: "https://debate-ai.com/",
  openRoute: () => {},
};

describe("ToolCatalogScreen", () => {
  const html = renderToStaticMarkup(<ToolCatalogScreen {...context} />);

  it("renders the catalog's own category headings", () => {
    expect(html).toContain("Core Workspaces");
    expect(html).toContain("Evidence &amp; Research");
  });

  it("renders a tile per surface, with its in-app route", () => {
    expect(html).toContain("Card Search");
    expect(html).toContain("/cards");
    expect(html).toContain("Debate Flow (FIAT)");
  });

  it("summarizes the whole catalog rather than the current filter", () => {
    expect(html).toMatch(/\d+ features across \d+ categories/);
  });
});
