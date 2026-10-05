import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href, collectionKeys }: { href: string; collectionKeys?: readonly string[] }) => (
    <span data-testid="sync-badge" data-href={href} data-keys={collectionKeys?.join(",")} />
  ),
}));

import { ToolPageHeader } from "../../../src/components/tools/ToolPageHeader";
import { ALL_TOOLS } from "../../../src/routes/tools/tool-groups";

describe("ToolPageHeader", () => {
  it("renders a collapsed 'What this tool does' disclosure from the catalog's highlights", () => {
    const drills = ALL_TOOLS.find((tool) => tool.href === "/practice/drills")!;
    expect(drills.highlights && drills.highlights.length > 0).toBe(true);

    const html = renderToStaticMarkup(
      <ToolPageHeader href="/practice/drills" backHref="/debate" backLabel="round workspace" />,
    );

    expect(html).toContain("What this tool does");
    expect(html).toContain("<details");
    // <details> has no `open` attribute by default, so it renders collapsed.
    expect(html).not.toContain("<details open");
    for (const highlight of drills.highlights!) {
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

  it("renders the sync badge exactly once, for the page's own route", () => {
    const html = renderToStaticMarkup(
      <ToolPageHeader href="/practice/drills" backHref="/debate" backLabel="round workspace" />,
    );

    expect(html.match(/data-testid="sync-badge"/g)).toHaveLength(1);
    expect(html).toContain('data-href="/practice/drills"');
  });

  it("passes explicit sync collections to the badge for a sub-page of a hub", () => {
    const html = renderToStaticMarkup(
      <ToolPageHeader
        href="/research/cards/library"
        backHref="/research/cards"
        backLabel="shared cards"
        syncCollections={["evidenceLibraryEntries", "reuseCheckHistory"]}
      />,
    );

    expect(html).toContain('data-keys="evidenceLibraryEntries,reuseCheckHistory"');
  });
});
