/**
 * @fileoverview Pins which sidebar section a route opens.
 *
 * The tree is an accordion — one section open, closed sections render none of
 * their links — so this mapping is what decides which links exist in the DOM
 * on any given page. Getting it wrong either hides the nav for where you are
 * or brings back the fifty-link sidebar that prefetched an RSC payload per
 * entry on every `/videos` load.
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
    expect(sidebarSectionForPath("/videos/lectures")).toBe(VIDEOS_SECTION_ID);
    expect(sidebarSectionForPath("/videos/philosophy___ir_theory")).toBe(VIDEOS_SECTION_ID);
  });

  it("opens nothing for a dock destination no tool section lists", () => {
    // These used to open an "Apps" node that restated the dock as text. The
    // tree no longer renders one, so nothing claims them.
    for (const href of ["/cards", "/debate", "/tools"]) {
      expect(sidebarSectionForPath(href)).toBeNull();
    }
  });

  it("resolves a dock destination to the tool section that lists it", () => {
    // `/doc` is the dock's Docs button and also Research's "Debate Docs";
    // `/versus-ai` is a dock button and Practice's "Debate Versus AI". With
    // the Apps node gone, the section holding the link wins outright.
    expect(sidebarSectionForPath("/doc")).toBe("research");
    expect(sidebarSectionForPath("/versus-ai")).toBe("practice");
  });

  it("finds the tool section holding a tool route", () => {
    expect(sidebarSectionForPath("/coaching-programs")).toBe("coaching");
    expect(sidebarSectionForPath("/cards/library")).toBe("research");
    expect(sidebarSectionForPath("/judge-decision")).toBe("practice");
  });

  it("matches nested paths under a link", () => {
    expect(sidebarSectionForPath("/practice-round/setup")).toBe("practice");
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
