/**
 * @fileoverview Pins that every tool the account sync claims to cover is a
 * tool the sidebar actually links to.
 *
 * `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS` carries an `href` and a
 * `label` per collection purely so `/settings`' "Tool data" list can name the
 * tool and link to it. Nothing else reads those, so a route renamed in
 * `sidebar-tool-sections.ts` would leave that list pointing at a 404 with no
 * other symptom. This package is where the two meet: it owns the sidebar's
 * tool catalog and depends on `debate-data-sync`.
 */

import { describe, it, expect } from "vitest";
import { TOOL_RECORD_COLLECTIONS } from "debate-data-sync/src/state/toolRecordCollections";
import {
  APP_DOCK_LINKS,
  SIDEBAR_TOOL_SECTIONS,
} from "../src/components/category-gallery/sidebar-tool-sections";

/**
 * Every destination this sidebar links to: the Tools tree's sections, plus the
 * five app-dock icons above them.
 *
 * The dock belongs in here because the video library lives there rather than
 * in the Tools tree — `/videos` is how a user reaches their favourites and
 * their hidden list, so a `/settings` row pointing at it is a working link,
 * which is the whole property this file exists to protect.
 */
const SIDEBAR_HREFS = new Set([
  ...SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.href)),
  ...APP_DOCK_LINKS.map((link) => link.href),
]);

describe("synced tool collections", () => {
  it("points every collection at a destination the sidebar links to", () => {
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      expect(SIDEBAR_HREFS, `${collection.key} → ${collection.href}`).toContain(collection.href);
    }
  });

  it("covers the Practice section's saved-work tools", () => {
    const synced = new Set(TOOL_RECORD_COLLECTIONS.map((collection) => collection.href));

    for (const href of [
      "/practice-round",
      "/briefings",
      "/opponents",
      "/judges",
      "/paradigms",
      "/summaries",
      "/outline",
      "/prep-notes",
      "/annotations",
    ]) {
      expect(synced, href).toContain(href);
    }
  });

  it("covers the Coaching section's saved-work tools", () => {
    const synced = new Set(TOOL_RECORD_COLLECTIONS.map((collection) => collection.href));

    for (const href of ["/coaching", "/coaching-programs"]) {
      expect(synced, href).toContain(href);
    }
  });
});
