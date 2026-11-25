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
  { key: "brand_new", label: "Brand New", count: 3, maxViews: 1 },
];

function sectionOf(html: string, title: string): string {
  const start = html.indexOf(`<section aria-label="${title}">`);
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf("</section>", start));
}

describe("lecture category sections", () => {
  it("files each category under its heading, unknown ones under More", () => {
    const html = renderToStaticMarkup(createElement(LectureCategoryGridGallery, { categories }));
    expect(html).toContain('href="/lectures"');
    expect(sectionOf(html, "Getting started")).toContain("Novice &amp; Introductory");
    expect(sectionOf(html, "Strategy")).toContain("Negative Strategy");
    expect(sectionOf(html, "Topics &amp; ideas")).toContain("Topic Lectures");
    expect(sectionOf(html, "Formats")).toContain('href="/lectures/wsd"');
    expect(sectionOf(html, "More")).toContain("Brand New");
    // The total stays the sum of every category.
    expect(html).toContain(">1138<");
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

  it("never lays a section out more than 4 tabs across", () => {
    const html = renderToStaticMarkup(createElement(LectureCategoryGridGallery, { categories }));
    expect(html).toContain("lg:grid-cols-4");
    expect(html).not.toMatch(/grid-cols-([5-9]|1\d)/);
  });
});
