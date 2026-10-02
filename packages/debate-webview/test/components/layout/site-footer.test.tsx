/**
 * @fileoverview Pins the standard footer: the sections it prints, that its
 * links come from the same data the sidebar and dock menus use, and that an
 * in-app route stays a router link rather than an absolute URL (which would
 * tear the app down and lose the sidebar and the persistent player).
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  APP_DOCK_LINKS,
  FOOTER_LINKS,
  SIDEBAR_TOOL_SECTIONS,
} from "@debate/videos";

import { SiteFooter } from "../../../src/components/layout/SiteFooter";

describe("SiteFooter", () => {
  const html = renderToStaticMarkup(<SiteFooter />);

  it("prints its link sections", () => {
    expect(html).toContain("Tools");
    expect(html).toContain("Site");
    // Debate-community links share the Site section, not a column of their own.
    expect(html).not.toContain(`aria-label="Debate"`);
    expect(html).toContain("<footer");
  });

  it("links the app's own surfaces, taken from the dock and the nav tree", () => {
    for (const link of APP_DOCK_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
    }
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(html).toContain(`href="${section.href}"`);
    }
    expect(html).toContain(`href="/practice/features"`);
  });

  it("reaches every external/legal footer link the dock menu does", () => {
    for (const link of FOOTER_LINKS) {
      expect(html).toContain(`href="${link.url}"`);
    }
  });

  it("follows in-app routes in place, so the sidebar and player survive the hop", () => {
    // An absolute `origin + url` href is what tore the whole app down before.
    expect(html).toContain('href="/videos"');
    expect(html).not.toContain('href="http://localhost:3000/');
  });

  it("sends outside sites to a new tab", () => {
    // `APP_DOCK_LINKS` are in-app routes; the external rows live in
    // `FOOTER_LINKS`, all in the one Site section.
    const outside = FOOTER_LINKS.filter((link) => link.url.startsWith("http"));
    expect(outside.length).toBeGreaterThan(0);
    for (const link of outside) {
      expect(html).toContain(
        `href="${link.url}" target="_blank" rel="noopener noreferrer"`,
      );
    }
  });

  it("loads /docs as a real page, since the help site has no app shell", () => {
    expect(html).toContain(`href="/docs" target="_self"`);
  });
});