/**
 * @fileoverview Pins which library routes list lectures only.
 *
 * My Favorites (`/videos/favorites`) runs on the lectures view internally, and
 * once marked the whole listing lectures-only — so a starred round never
 * reached the page's Rounds table and only lectures showed up.
 */

import { describe, expect, it } from "vitest";
import { isLecturesOnlyListing } from "../src/panels/lectureRouteConfig";

describe("isLecturesOnlyListing", () => {
  it("lists rounds and lectures on My Favorites", () => {
    expect(isLecturesOnlyListing("favorites", "lectures", "all", "")).toBe(false);
    expect(isLecturesOnlyListing("favoritedebates", "lectures", "all", "")).toBe(false);
  });

  it("keeps the lectures-only favorites route to lectures", () => {
    expect(isLecturesOnlyListing("favoritelectures", "lectures", "all", "")).toBe(true);
  });

  it("keeps All Lectures to lectures and All Videos to both", () => {
    expect(isLecturesOnlyListing("lectures", "lectures", "all", "")).toBe(true);
    expect(isLecturesOnlyListing(undefined, "lectures", "all", "")).toBe(false);
  });

  it("does not narrow a style, category or other view", () => {
    expect(isLecturesOnlyListing("pf", "lectures", "all", 2)).toBe(false);
    expect(isLecturesOnlyListing("topic_lectures", "lectures", "topic_lectures", "")).toBe(false);
    expect(isLecturesOnlyListing("history", "history", "all", "")).toBe(false);
  });
});
