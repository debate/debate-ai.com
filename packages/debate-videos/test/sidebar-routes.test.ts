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
  });

  it("does not match a sibling route that merely shares a prefix", () => {
    expect(matchesToolSidebarHref("/docs")).toBe(false);
    expect(matchesToolSidebarHref("/cardsy")).toBe(false);
    expect(matchesToolSidebarHref("/legal/privacy")).toBe(false);
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

  it("reports a sidebar-hosted dock on the CardMirror editor routes", () => {
    for (const route of ["/reason-editor", "/doc", "/reason-editor/7", "/doc/x"]) {
      expect(hasEmbeddedDock(route)).toBe(true);
      expect(isGenericToolSidebarRoute(route)).toBe(true);
    }
  });

  it("falls back to the fixed dock only off the sidebar routes", () => {
    for (const route of ["/", "/login", "/legal/privacy", "/features"]) {
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
