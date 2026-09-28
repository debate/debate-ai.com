import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ToolsLinkCard } from "../../../src/components/settings/ToolsLinkCard";

describe("ToolsLinkCard", () => {
  it("links to /tools", () => {
    const html = renderToStaticMarkup(<ToolsLinkCard />);

    expect(html).toContain('href="/tools"');
  });

  it("mentions saved data and account sync", () => {
    const html = renderToStaticMarkup(<ToolsLinkCard />);

    expect(html).toContain("Tools &amp; saved data");
    expect(html).toContain("sync status");
  });
});
