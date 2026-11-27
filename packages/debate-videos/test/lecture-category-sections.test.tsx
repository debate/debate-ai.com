/**
 * @fileoverview The lecture category bar groups its cards under section
 * headings, and on All Videos the round collections (Atlantic,
 * Parliamentary, Congress) join its Formats section. Speech is hidden while
 * it has no videos.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: unknown }) => createElement("a", { href }, children as never),
}));

const { LectureCategoryGridGallery } = await import(
  "../src/components/navigation/category-gallery/LectureCategoryGridGallery"
);

const categories = [
  { key: "negative_strategy", label: "Negative Strategy", count: 75, maxViews: 1 },
  { key: "novice___introductory", label: "Novice & Introductory", count: 716, maxViews: 1 },
  { key: "topic_lectures", label: "Topic Lectures", count: 312, maxViews: 1 },
  { key: "wsd", label: "WSD", count: 32, maxViews: 1 },
  { key: "nsda_speech", label: "NSDA Speech", count: 40, maxViews: 1 },
  { key: "brand_new", label: "Brand New", count: 3, maxViews: 1 },
];

function sectionOf(html: string, title: string): string {
  const start = html.indexOf(`<section aria-label="${title}"`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</section>", start));
}

describe("lecture category sections", () => {
  it("files each category under its heading, unknown ones under More", () => {
    const html = renderToStaticMarkup(createElement(LectureCategoryGridGallery, { categories }));
    expect(sectionOf(html, "General")).toContain("Novice &amp; Introductory");
    expect(sectionOf(html, "Strategy")).toContain("Negative Strategy");
    expect(sectionOf(html, "Topics &amp; ideas")).toContain("Topic Lectures");
    expect(sectionOf(html, "Formats")).toContain('href="/lectures/wsd"');
    expect(sectionOf(html, "Topics &amp; ideas")).toContain('href="/lectures/nsda_speech"');
    expect(sectionOf(html, "Formats")).not.toContain("NSDA Speech");
    expect(sectionOf(html, "More")).toContain("Brand New");
  });

  it("shows only the Formats section on the rounds scope", () => {
    const html = renderToStaticMarkup(createElement(LectureCategoryGridGallery, { categories, scope: "rounds" }));
    expect(sectionOf(html, "Formats")).toContain('href="/lectures/wsd"');
    for (const title of ["General", "Strategy", "Topics &amp; ideas", "More"]) {
      expect(html).not.toContain(`<section aria-label="${title}"`);
    }
  });

  it("leaves the Formats section and the format badges off the lectures scope", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, { categories, scope: "lectures", formatCounts: { college: 4 } }),
    );
    expect(html).not.toContain('<section aria-label="Formats"');
    expect(html).not.toContain('href="/videos/college"');
    expect(html).not.toContain('href="/lectures/wsd"');
    expect(sectionOf(html, "Strategy")).toContain("Negative Strategy");
  });

  it("has no All Lectures card", () => {
    const html = renderToStaticMarkup(createElement(LectureCategoryGridGallery, { categories }));
    expect(html).not.toContain("All Lectures");
    expect(html).not.toContain('href="/lectures"');
  });

  it("leads with the four main category badges, each 350px wide", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, { categories, formatCounts: { college: 1400, parli: 15 } }),
    );
    const hrefs = ["/videos/college", "/videos/policy", "/videos/ld", "/videos/pf"].map((href) =>
      html.indexOf(`href="${href}"`),
    );
    expect(hrefs.every((index) => index > -1)).toBe(true);
    expect([...hrefs].sort((a, b) => a - b)).toEqual(hrefs);
    expect(hrefs[3]).toBeLessThan(html.indexOf('<section aria-label="General"'));
    expect(html.slice(0, html.indexOf('<section aria-label="General"'))).not.toContain("/videos/parli");
    expect(html.match(/w-\[350px\]/g)).toHaveLength(4);
    expect(html).toContain("College Policy");
    expect(html).toContain("Individual");
    expect(html).toContain("Forum");
    expect(html).toContain(">1400<");
  });

  it("lists Parli under Formats with its count", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, { categories, formatCounts: { parli: 15 } }),
    );
    const formats = sectionOf(html, "Formats");
    expect(formats).toContain('href="/videos/parli"');
    expect(formats).toContain(">15<");
  });

  it("files Public Forum as Forum Lectures under Topics & ideas", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, {
        categories: [...categories, { key: "public_forum", label: "Public Forum", count: 40, maxViews: 1 }],
      }),
    );
    expect(sectionOf(html, "Topics &amp; ideas")).toContain('href="/lectures/public_forum"');
    expect(sectionOf(html, "Topics &amp; ideas")).toContain("Forum Lectures");
    expect(sectionOf(html, "Formats")).not.toContain("public_forum");
    expect(html).not.toContain(">Public Forum<");
  });

  it("files Round Analysis under Topics & ideas, not Strategy", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, {
        categories: [...categories, { key: "round_analysis", label: "Round Analysis", count: 17, maxViews: 1 }],
      }),
    );
    expect(sectionOf(html, "Topics &amp; ideas")).toContain('href="/lectures/round_analysis"');
    expect(sectionOf(html, "Strategy")).not.toContain("round_analysis");
  });

  it("lays the sections out as narrow columns", () => {
    const html = renderToStaticMarkup(createElement(LectureCategoryGridGallery, { categories }));
    expect(html).toContain("minmax(9.5rem,12rem)");
  });

  it("shows Open Super Debates in Formats, linked by its slug", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, {
        categories: [...categories, { key: "open_super_debates", label: "Open Super Debates", count: 3, maxViews: 1 }],
      }),
    );
    const formats = sectionOf(html, "Formats");
    expect(formats).toContain("Open Super Debates");
    expect(formats).toContain('href="/lectures/open_super_debates"');
    expect(sectionOf(html, "More")).not.toContain("Open Super Debates");
  });

  it("lists Miscellaneous in General, after the other General categories", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, {
        categories: [...categories, { key: "miscellaneous", label: "Miscellaneous", count: 7, maxViews: 1 }],
      }),
    );
    const general = sectionOf(html, "General");
    expect(general).toContain('href="/lectures/miscellaneous"');
    expect(general).toContain(">7<");
    expect(general.indexOf("/lectures/miscellaneous")).toBeGreaterThan(general.indexOf("/lectures/novice___introductory"));
    expect(html).not.toContain('<section aria-label="Miscellaneous"');
    expect(sectionOf(html, "More")).not.toContain("Miscellaneous");
  });

  it("adds the collection links to Formats", () => {
    const html = renderToStaticMarkup(
      createElement(LectureCategoryGridGallery, {
        categories,
        extraLinks: [{ id: "parli", title: "Parliamentary", href: "/videos/parli", count: 15, icon: null }],
      }),
    );
    const formats = sectionOf(html, "Formats");
    expect(formats).toContain('href="/videos/parli"');
    expect(formats).toContain(">15<");
  });
});
