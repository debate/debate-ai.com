import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolPageHeader } from "../../../src/components/tools/ToolPageHeader";
import { ALL_TOOLS } from "../../../src/routes/tools/tool-groups";

describe("ToolPageHeader", () => {
  it("renders a collapsed 'What this tool does' disclosure from the catalog's highlights", () => {
    const prep = ALL_TOOLS.find((tool) => tool.href === "/practice/prep")!;
    expect(prep.highlights && prep.highlights.length > 0).toBe(true);

    const html = renderToStaticMarkup(
      <ToolPageHeader href="/practice/prep" backHref="/debate" backLabel="round workspace" />,
    );

    expect(html).toContain("What this tool does");
    expect(html).toContain("<details");
    // <details> has no `open` attribute by default, so it renders collapsed.
    expect(html).not.toContain("<details open");
    for (const highlight of prep.highlights!) {
      // Server rendering escapes an apostrophe as an HTML entity.
      expect(html).toContain(highlight.replace(/'/g, "&#x27;"));
    }
  });

  it("omits the disclosure for an href absent from the catalog", () => {
    expect(ALL_TOOLS.some((tool) => tool.href === "/not-a-real-tool")).toBe(false);

    const html = renderToStaticMarkup(
      <ToolPageHeader href="/not-a-real-tool" backHref="/tools" backLabel="tools" />,
    );

    expect(html).not.toContain("What this tool does");
  });

  it("headlines an uncataloged page with its explicit title, not its path", () => {
    for (const href of ["/research/cards/library", "/research/cards/argument-library"]) {
      expect(ALL_TOOLS.some((tool) => tool.href === href)).toBe(false);
    }

    const fallback = renderToStaticMarkup(
      <ToolPageHeader href="/research/cards/library" backHref="/research/cards" backLabel="shared cards" />,
    );
    // The bug this guards against: no catalog entry and no title → the path is the heading.
    expect(fallback).toContain(">/research/cards/library</h1>");

    const html = renderToStaticMarkup(
      <ToolPageHeader
        href="/research/cards/library"
        backHref="/research/cards"
        backLabel="shared cards"
        title="Shared Evidence Library"
        description="Search cut cards."
      />,
    );
    expect(html).toContain(">Shared Evidence Library</h1>");
    expect(html).toContain("Search cut cards.");
    expect(html).not.toContain(">/research/cards/library</h1>");
  });

  it("lets a caller override the resolved highlights", () => {
    const html = renderToStaticMarkup(
      <ToolPageHeader
        href="/practice/drills"
        backHref="/debate"
        backLabel="round workspace"
        highlights={["Custom highlight one", "Custom highlight two"]}
      />,
    );

    expect(html).toContain("Custom highlight one");
    expect(html).toContain("Custom highlight two");
  });

  it("lets a caller suppress the disclosure by passing an empty highlights array", () => {
    const html = renderToStaticMarkup(
      <ToolPageHeader href="/practice/drills" backHref="/debate" backLabel="round workspace" highlights={[]} />,
    );

    expect(html).not.toContain("What this tool does");
  });

  it("shows no account-save notice, badge or Save now button", () => {
    const html = renderToStaticMarkup(
      <ToolPageHeader href="/contacts" backHref="/tools" backLabel="tools" />,
    );
    expect(html).not.toContain("data-tool-storage-note");
    expect(html).not.toContain("to your account");
    expect(html).not.toContain("Save now");
  });
});
