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
    expect(matchesToolSidebarHref("/research/cards/awards")).toBe(true);
    expect(matchesToolSidebarHref("/coaching/leaderboard/alice")).toBe(true);
    expect(matchesToolSidebarHref("/research/docs/some-document")).toBe(true);
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
  });

  it("matches the homepage, but nothing below it through that entry", () => {
    // `/` is an exact-match entry, not a prefix one: the nested-route check
    // compares against `${href}/`, which for `/` would be `//`. So the homepage
    // is covered and every other route still has to be named by a longer entry.
    expect(matchesToolSidebarHref("/")).toBe(true);
    expect(TOOL_SIDEBAR_HREFS.has("/")).toBe(true);
  });
});

describe("hasEmbeddedDock / isGenericToolSidebarRoute", () => {
  it("treats every /videos route as already having its own sidebar dock", () => {
    expect(hasEmbeddedDock("/videos")).toBe(true);
    expect(hasEmbeddedDock("/lectures")).toBe(true);
    // `/videos` renders its own sidebar, so the generic shell must not add a
    // second one.
    expect(isGenericToolSidebarRoute("/videos")).toBe(false);
    expect(isGenericToolSidebarRoute("/lectures")).toBe(false);
  });

  it("reports a sidebar-hosted dock on the CardMirror editor route", () => {
    for (const route of ["/reason-editor", "/reason-editor/7"]) {
      expect(hasEmbeddedDock(route)).toBe(true);
      expect(isGenericToolSidebarRoute(route)).toBe(true);
    }
  });

  it("falls back to the fixed dock only off the sidebar routes", () => {
    // `/practice/features` and `/legal/privacy` used to be in this list. They are
    // sidebar routes now — see "the features catalog" and "the terms of
    // service page" below, and "the homepage" for `/`.
    for (const route of ["/login", "/contacts"]) {
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
    expect(TOOL_SIDEBAR_HREFS.has("/practice/features")).toBe(true);
    expect(isGenericToolSidebarRoute("/practice/features")).toBe(true);
    // …and the dock's own floating instance stays hidden, since the sidebar
    // it is wrapped in already hosts one.
    expect(hasEmbeddedDock("/practice/features")).toBe(true);
  });

  it("is the homepage too, so the site's front door is not its one bare page", () => {
    // `app/page.tsx` re-exports this same page, so `/` renders the catalog.
    expect(isGenericToolSidebarRoute("/")).toBe(true);
    expect(hasEmbeddedDock("/")).toBe(true);
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

describe("the admin dashboard", () => {
  it("is a sidebar route, so it gets the app dock and scrolls like the rest of the app", () => {
    expect(TOOL_SIDEBAR_HREFS.has("/admin")).toBe(true);
    expect(isGenericToolSidebarRoute("/admin")).toBe(true);
    expect(hasEmbeddedDock("/admin")).toBe(true);
  });
});

describe("Latest News", () => {
  it("is a sidebar route, so opening a thread from the feed keeps the nav", () => {
    expect(TOOL_SIDEBAR_HREFS.has("/practice/forums")).toBe(true);
    expect(isGenericToolSidebarRoute("/practice/forums")).toBe(true);
    // A thread page is a detail route under an already-listed parent, matched
    // by prefix — the same way `/doc/<document>` and `/teams/<team>` are.
    expect(isGenericToolSidebarRoute("/practice/forums/3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(hasEmbeddedDock("/practice/forums")).toBe(true);
  });

  it("stay in the Prep & Scout section", () => {
    const prepScout = SIDEBAR_TOOL_SECTIONS.find((section) => section.id === "prep-scout");
    const hrefs = prepScout?.tools.map((tool) => tool.href) ?? [];

    expect(hrefs).toContain("/practice/forums");
  });
});

describe("Tournaments and Tabroom", () => {
  it("keep the app's own Tournaments row but drop the framed Tabroom row", () => {
    const hrefs = SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.href));

    expect(hrefs).toContain("/tournaments");
    expect(hrefs).not.toContain("/practice/tabroom");
  });

  it("list Tournaments first in the Coaching section, and only there", () => {
    const coaching = SIDEBAR_TOOL_SECTIONS.find((section) => section.id === "coaching");
    const sectionsWithTournaments = SIDEBAR_TOOL_SECTIONS.filter((section) =>
      section.tools.some((tool) => tool.href === "/tournaments"),
    );

    expect(coaching?.tools[0]?.href).toBe("/tournaments");
    expect(sectionsWithTournaments.map((section) => section.id)).toEqual(["coaching"]);
  });
});

describe("the REASON research workspace", () => {
  it("is still a sidebar destination, though no longer a Research row", () => {
    // It lost its "Debate Docs" row in favour of the dock's own Research button,
    // which is the same route — so the sidebar still has to know about it.
    expect(TOOL_SIDEBAR_HREFS.has("/research/docs")).toBe(true);
    expect(matchesToolSidebarHref("/research/docs")).toBe(true);
    expect(matchesToolSidebarHref("/research/docs/cp-answer-to-states")).toBe(true);
  });

  it("hosts the app dock in its own sidebar, itself and every document beneath it", () => {
    expect(hostsOwnSidebarDock("/doc")).toBe(true);
    expect(hostsOwnSidebarDock("/doc/cp-answer-to-states")).toBe(true);
    // `/docs` is the help site, not the workspace.
    expect(hostsOwnSidebarDock("/docs")).toBe(false);
    expect(hostsOwnSidebarDock(null)).toBe(false);
    expect(ownsItsLayout("/doc")).toBe(true);
  });

  it("is not wrapped in the generic sidebar: its own sidebar is the only one", () => {
    expect(isGenericToolSidebarRoute("/doc")).toBe(false);
    expect(isGenericToolSidebarRoute("/doc/cp-answer-to-states")).toBe(false);
    // The dock is on screen inside that sidebar, so the floating one stays hidden.
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
    expect(ownsItsLayout("/research/cards")).toBe(false);
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

describe("video library routes and the category-path redirects", () => {
  it("never redirects a round-video slug the page still serves under /videos", async () => {
    const { SLUG_MAP } = await import("../src/panels/lectureRouteConfig");
    const { canonicalCategoryPathname } = await import(
      "@debate/data-sync/src/routes/category-paths"
    );
    const moved = new Set(["dictionary", "rankings", "statistics", "stats", "lectures", "toppicks"]);
    for (const slug of Object.keys(SLUG_MAP)) {
      if (moved.has(slug)) continue;
      expect(canonicalCategoryPathname(`/videos/${slug}`), slug).toBeNull();
    }
  });
});
