/**
 * @fileoverview Pins the two halves of "the app dock stays inside the
 * sidebar": which routes host the dock in a sidebar column at all, and the
 * fact that the tools catalog is no longer one of the dock's own icons.
 */

import { describe, it, expect } from "vitest";
import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
} from "../src/components/category-gallery/sidebar-tool-sections";
import {
  TOOL_SIDEBAR_HREFS,
  matchesToolSidebarHref,
  ownsItsLayout,
  hostsOwnSidebarDock,
  hasEmbeddedDock,
  isGenericToolSidebarRoute,
} from "../src/components/category-gallery/sidebar-routes";

describe("APP_DOCK_LINKS", () => {
  it("no longer carries the tools catalog", () => {
    // The dock is held to five destinations so its sidebar-hosted instance
    // fits inside the 300px column; tools moved to the nav tree and the
    // dock's Settings menu.
    expect(APP_DOCK_LINKS.map((link) => link.href)).not.toContain(TOOLS_ROOT_HREF);
    expect(APP_DOCK_LINKS).toHaveLength(5);
  });

  it("still reaches the tools catalog through the sidebar", () => {
    expect(TOOLS_ROOT_HREF).toBe("/tools");
    expect(TOOL_SIDEBAR_HREFS.has(TOOLS_ROOT_HREF)).toBe(true);
    expect(isGenericToolSidebarRoute(TOOLS_ROOT_HREF)).toBe(true);
  });

  it("lists no duplicate destinations", () => {
    const hrefs = APP_DOCK_LINKS.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("matchesToolSidebarHref", () => {
  it("matches every destination the tree links to", () => {
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(matchesToolSidebarHref(section.href)).toBe(true);
      for (const tool of section.tools) {
        expect(matchesToolSidebarHref(tool.href)).toBe(true);
      }
    }
    for (const link of APP_DOCK_LINKS) {
      expect(matchesToolSidebarHref(link.href)).toBe(true);
    }
  });

  it("matches routes nested under a destination", () => {
    // These are why matching is prefix-based: exact-match-only left each of
    // them with the fixed top-left dock floating over the page instead of a
    // dock inside a sidebar.
    expect(matchesToolSidebarHref("/cards/awards")).toBe(true);
    expect(matchesToolSidebarHref("/cards/leaderboard/alice")).toBe(true);
    expect(matchesToolSidebarHref("/doc/some-document")).toBe(true);
    expect(matchesToolSidebarHref("/reason-editor/42")).toBe(true);
    expect(matchesToolSidebarHref("/teams/greenhill-ab")).toBe(true);
    expect(matchesToolSidebarHref("/schools/greenhill")).toBe(true);
    expect(matchesToolSidebarHref("/legal/privacy")).toBe(true);
  });

  it("does not match a sibling route that merely shares a prefix", () => {
    expect(matchesToolSidebarHref("/docs")).toBe(false);
    expect(matchesToolSidebarHref("/cardsy")).toBe(false);
    expect(matchesToolSidebarHref("/teamsy")).toBe(false);
    expect(matchesToolSidebarHref("/login")).toBe(false);
    expect(matchesToolSidebarHref("/")).toBe(false);
  });
});

describe("hasEmbeddedDock / isGenericToolSidebarRoute", () => {
  it("treats every /videos route as already having its own sidebar dock", () => {
    expect(hasEmbeddedDock("/videos")).toBe(true);
    expect(hasEmbeddedDock("/videos/lectures")).toBe(true);
    // `/videos` renders its own sidebar, so the generic shell must not add a
    // second one.
    expect(isGenericToolSidebarRoute("/videos")).toBe(false);
    expect(isGenericToolSidebarRoute("/videos/lectures")).toBe(false);
  });

  it("reports a sidebar-hosted dock on the CardMirror editor route", () => {
    for (const route of ["/reason-editor", "/reason-editor/7"]) {
      expect(hasEmbeddedDock(route)).toBe(true);
      expect(isGenericToolSidebarRoute(route)).toBe(true);
    }
  });

  it("falls back to the fixed dock only off the sidebar routes", () => {
    // `/features` and `/legal/privacy` used to be in this list. They are
    // sidebar routes now — see "the features catalog" and "the terms of
    // service page" below.
    for (const route of ["/", "/login", "/contacts"]) {
      expect(hasEmbeddedDock(route)).toBe(false);
      expect(isGenericToolSidebarRoute(route)).toBe(false);
    }
  });

  it("tolerates a missing pathname", () => {
    expect(hasEmbeddedDock(null)).toBe(false);
    expect(hasEmbeddedDock(undefined)).toBe(false);
    expect(hasEmbeddedDock("")).toBe(false);
    expect(isGenericToolSidebarRoute(null)).toBe(false);
  });
});

describe("the features catalog", () => {
  it("is a sidebar route, so it opens inside the app rather than as a bare page", () => {
    expect(TOOL_SIDEBAR_HREFS.has("/features")).toBe(true);
    expect(isGenericToolSidebarRoute("/features")).toBe(true);
    // …and the dock's own floating instance stays hidden, since the sidebar
    // it is wrapped in already hosts one.
    expect(hasEmbeddedDock("/features")).toBe(true);
  });
});

describe("team and school profile pages", () => {
  it("are sidebar routes, so opening one from the rankings table keeps the nav", () => {
    for (const root of ["/teams", "/schools"]) {
      expect(TOOL_SIDEBAR_HREFS.has(root)).toBe(true);
      expect(isGenericToolSidebarRoute(root)).toBe(true);
      expect(hasEmbeddedDock(root)).toBe(true);
    }
    expect(isGenericToolSidebarRoute("/teams/greenhill-ab")).toBe(true);
    expect(isGenericToolSidebarRoute("/schools/greenhill")).toBe(true);
  });
});

describe("the terms of service page", () => {
  it("is a sidebar route, so it opens inside the app rather than as a bare page", () => {
    expect(TOOL_SIDEBAR_HREFS.has("/legal")).toBe(true);
    expect(isGenericToolSidebarRoute("/legal/privacy")).toBe(true);
    expect(hasEmbeddedDock("/legal/privacy")).toBe(true);
  });
});

describe("the REASON research workspace", () => {
  it("is still a tree destination, so the sidebar keeps linking to it", () => {
    expect(TOOL_SIDEBAR_HREFS.has("/doc")).toBe(true);
    expect(matchesToolSidebarHref("/doc")).toBe(true);
    expect(matchesToolSidebarHref("/doc/cp-answer-to-states")).toBe(true);
  });

  it("hosts the dock in its own sidebar, itself and every document beneath it", () => {
    expect(hostsOwnSidebarDock("/doc")).toBe(true);
    expect(hostsOwnSidebarDock("/doc/cp-answer-to-states")).toBe(true);
    // The trailing `/` in the match keeps the help docs off this list.
    expect(hostsOwnSidebarDock("/docs")).toBe(false);
    expect(hostsOwnSidebarDock("/reason-editor")).toBe(false);
    expect(hostsOwnSidebarDock(null)).toBe(false);
    // And hosting its own dock is one way of owning the layout.
    expect(ownsItsLayout("/doc")).toBe(true);
    expect(ownsItsLayout("/doc/cp-answer-to-states")).toBe(true);
  });

  it("is not wrapped in the generic sidebar, which stood beside its own", () => {
    expect(isGenericToolSidebarRoute("/doc")).toBe(false);
    expect(isGenericToolSidebarRoute("/doc/cp-answer-to-states")).toBe(false);
  });

  it("keeps the floating dock suppressed, its own sidebar carrying one", () => {
    // This is what separates it from `/debate` below: both skip the generic
    // sidebar, but only this one puts a dock in the column it renders itself.
    expect(hasEmbeddedDock("/doc")).toBe(true);
    expect(hasEmbeddedDock("/doc/cp-answer-to-states")).toBe(true);
  });
});

describe("the flow workspace", () => {
  it("is still a tree destination, so the sidebar keeps linking to it", () => {
    expect(TOOL_SIDEBAR_HREFS.has("/debate")).toBe(true);
    expect(matchesToolSidebarHref("/debate")).toBe(true);
    expect(matchesToolSidebarHref("/debate/glenbrooks")).toBe(true);
  });

  it("owns its layout, itself and every round beneath it", () => {
    expect(ownsItsLayout("/debate")).toBe(true);
    expect(ownsItsLayout("/debate/glenbrooks")).toBe(true);
    // A sibling that merely shares the prefix is not the workspace.
    expect(ownsItsLayout("/debates")).toBe(false);
    expect(ownsItsLayout("/cards")).toBe(false);
    expect(ownsItsLayout(null)).toBe(false);
  });

  it("is not wrapped in the generic sidebar, which would be a second nav column", () => {
    expect(isGenericToolSidebarRoute("/debate")).toBe(false);
    expect(isGenericToolSidebarRoute("/debate/glenbrooks")).toBe(false);
  });

  it("keeps the dock as the floating instance, since it hosts no sidebar one", () => {
    expect(hasEmbeddedDock("/debate")).toBe(false);
    expect(hasEmbeddedDock("/debate/glenbrooks")).toBe(false);
  });
});
