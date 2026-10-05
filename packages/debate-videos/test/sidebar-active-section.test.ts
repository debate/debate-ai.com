/**
 * @fileoverview Pins which sidebar section a route opens.
 *
 * Every section starts expanded now, so this mapping no longer decides which
 * links exist in the DOM. What it still decides is which section a navigation
 * *re-opens*: follow a link into a section you had collapsed by hand and that
 * section expands again, rather than leaving you on a page whose nav is shut.
 * Getting it wrong means exactly that — a collapsed section stays collapsed
 * under the page it holds.
 */

import { describe, it, expect } from "vitest";
import {
  VIDEOS_SECTION_ID,
  sidebarSectionForPath,
} from "../src/components/category-gallery/sidebar-active-section";

describe("sidebarSectionForPath", () => {
  it("puts every videos route in the Videos section", () => {
    expect(sidebarSectionForPath("/videos")).toBe(VIDEOS_SECTION_ID);
    expect(sidebarSectionForPath("/videos/pf")).toBe(VIDEOS_SECTION_ID);
    expect(sidebarSectionForPath("/lectures")).toBe(VIDEOS_SECTION_ID);
    expect(sidebarSectionForPath("/videos/philosophy___ir_theory")).toBe(VIDEOS_SECTION_ID);
  });

  it("opens nothing for a dock destination no tool section lists", () => {
    // These used to open an "Apps" node that restated the dock as text. The
    // tree no longer renders one, so nothing claims them. `/research/cards` is no
    // longer one of them — see the next case. `/doc` and `/reason-editor` lost
    // their Research rows to the dock's own icons, so they land here now too.
    for (const href of ["/debate", "/tools", "/doc", "/reason-editor"]) {
      expect(sidebarSectionForPath(href)).toBeNull();
    }
  });

  it("opens Research for the dock's research tab, which sits under /research", () => {
    expect(sidebarSectionForPath("/research/docs")).toBe("research");
    expect(sidebarSectionForPath("/research/docs/cp-answer-to-states")).toBe("research");
  });

  it("resolves a dock destination to the tool section that lists it", () => {
    // `/practice/versus-ai` is a dock button and Practice's "Debate Versus AI"; `/research/cards`
    // is the dock's Shared button and Research's "Card Search". With the Apps
    // node gone, the section holding the link wins outright.
    expect(sidebarSectionForPath("/practice/versus-ai")).toBe("practice");
    expect(sidebarSectionForPath("/research/cards")).toBe("research");
  });

  it("finds the tool section holding a tool route", () => {
    expect(sidebarSectionForPath("/coaching/programs")).toBe("coaching");
    expect(sidebarSectionForPath("/research/cards/library")).toBe("research");
    expect(sidebarSectionForPath("/practice/judge-decision")).toBe("practice");
  });

  it("matches nested paths under a link", () => {
    expect(sidebarSectionForPath("/practice/setup")).toBe("practice");
  });

  it("returns null for a route the tree does not cover", () => {
    expect(sidebarSectionForPath("/settings")).toBeNull();
    expect(sidebarSectionForPath("")).toBeNull();
    expect(sidebarSectionForPath(null)).toBeNull();
    expect(sidebarSectionForPath(undefined)).toBeNull();
  });

  it("does not treat a prefix collision as a match", () => {
    // `/videostore` is not a videos route.
    expect(sidebarSectionForPath("/videostore")).toBeNull();
  });
});
