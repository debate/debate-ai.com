import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../../../src/components/tools/ToolSyncBadge", () => ({
  ToolSyncBadge: ({ href }: { href: string }) => <span data-testid="sync-badge" data-href={href} />,
}));
vi.mock("@debate/research-evidence", () => ({
  SearchInterface: () => <div data-testid="search-interface" />,
}));

import SearchPage from "../../../src/routes/cards/page";
import { resolveToolSyncKeys } from "../../../src/lib/tools/tool-sync-status";

describe("CARDS search page sync strip", () => {
  it("shows the account-sync badge for /research/cards above the search workspace", () => {
    const html = renderToStaticMarkup(<SearchPage />);
    expect(html).toContain('data-href="/research/cards"');
    expect(html.indexOf("sync-badge")).toBeLessThan(html.indexOf("search-interface"));
  });

  it("watches at least one synced collection", () => {
    expect(resolveToolSyncKeys("/research/cards").length).toBeGreaterThan(0);
  });
});
