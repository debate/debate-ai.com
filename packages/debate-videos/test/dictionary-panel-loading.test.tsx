/**
 * @fileoverview The glossary shows a loader, not "No results found for """,
 * while its term list is still being fetched.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("grab-url", () => ({ default: () => new Promise(() => {}) }));

import { DictionaryPanel } from "../src/panels/dictionary/DictionaryPanel";

describe("DictionaryPanel first render", () => {
  it("shows the loader instead of the empty state", () => {
    const html = renderToStaticMarkup(createElement(DictionaryPanel));
    expect(html).toContain("Loading debate terms");
    expect(html).not.toContain("No results found");
  });

  it("does not show the empty state for a controlled search while loading", () => {
    const html = renderToStaticMarkup(
      createElement(DictionaryPanel, { controlledSearchTerm: "", onControlledSearchChange: () => {} }),
    );
    expect(html).not.toContain("No results found");
  });
});
