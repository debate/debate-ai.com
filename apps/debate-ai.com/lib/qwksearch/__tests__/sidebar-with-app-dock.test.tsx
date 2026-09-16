/**
 * @fileoverview Pins where the app dock lives on `/doc`.
 *
 * The route renders one sidebar now — the REASON workspace's own files/tabs
 * column, the app's generic tool sidebar being skipped there
 * (`hostsOwnSidebarDock`, in `lib/sidebar-routes`). That is also the only
 * column left to host the dock, and the floating instance stays suppressed
 * wherever a sidebar-hosted one is on screen, so a dock missing from here is
 * a dock missing from the page: no way back to the rest of the app.
 */

import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("react-reason-editor-sidebar", () => ({
  Sidebar: ({ isMobile }: { isMobile?: boolean }) => (
    <aside data-testid="reason-sidebar" className="h-screen w-full flex flex-col pt-14">
      {isMobile ? "sheet" : "column"}
    </aside>
  ),
}));

vi.mock("@/components/layout/CategoryDock", () => ({
  CategoryDock: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="app-dock">{embedded ? "embedded" : "floating"}</div>
  ),
}));

const { SidebarWithAppDock } = await import("@/components/qwksearch/SidebarWithAppDock");

/** The editor hands its sidebar a lot more than this; only `isMobile` matters
 *  here, and the mocked `Sidebar` above reads nothing else. */
function render(isMobile: boolean) {
  const props = { isMobile } as unknown as ComponentProps<typeof SidebarWithAppDock>;
  return renderToStaticMarkup(<SidebarWithAppDock {...props} />);
}

describe("SidebarWithAppDock", () => {
  it("hosts the dock above the workspace's own sidebar, in its embedded form", () => {
    const html = render(false);
    expect(html).toContain('data-testid="app-dock"');
    expect(html).toContain("embedded");
    // Above it, not beside or below it: the dock is the top of the column.
    expect(html.indexOf('data-testid="app-dock"')).toBeLessThan(
      html.indexOf('data-testid="reason-sidebar"'),
    );
  });

  it("cancels the upstream sidebar's header gap, which the dock now fills", () => {
    // The published `<aside>` reserves `pt-14` for the header qwksearch's own
    // app renders there. Left alone that stacks 56px of nothing under the
    // dock; the override hands the band to the dock instead.
    // The class survives as escaped markup, which is how it reaches the DOM.
    expect(render(false)).toContain("[&amp;&gt;aside]:pt-2");
  });

  it("renders the workspace's sidebar and nothing else on mobile", () => {
    // Below `md` the editor puts this component in a slide-over sheet, and
    // the dock's own mobile instance is already fixed to the bottom of the
    // viewport — a copy in the sheet would be the second one.
    const html = render(true);
    expect(html).toContain('data-testid="reason-sidebar"');
    expect(html).not.toContain('data-testid="app-dock"');
  });
});
