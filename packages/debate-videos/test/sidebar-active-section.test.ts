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
  APPS_SECTION_ID,
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

  it("puts the app dock's destinations in the Apps section", () => {
    // Clicking a dock button lands on one of these, and the sidebar should
    // then hold that destination's section and nothing else.
    for (const href of ["/cards", "/debate", "/versus-ai", "/tools"]) {
      expect(sidebarSectionForPath(href)).toBe(APPS_SECTION_ID);
    }
  });

  it("resolves a route listed in both the dock and a tool section to the dock", () => {
    // `/doc` is the dock's Docs button and also Research's "Debate Docs". The
    // dock is the primary navigation, so it wins.
    expect(sidebarSectionForPath("/doc")).toBe(APPS_SECTION_ID);
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
