/**
 * @fileoverview Pins how the sidebar footer follows its links.
 *
 * The row that matters is "Features": it is an app route, and it used to be
 * rendered as `origin + "/features"` — an absolute URL, which Next treats as
 * external, so clicking it reloaded the document into a bare page with no
 * sidebar and stopped the persistent player. `/docs`, on the other hand, is a
 * statically exported build served from `public/` and *must* keep its full
 * page load. These assertions are about that difference.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import { FOOTER_LINKS } from "../src/ui/layout/footer-links";

/** Stands in for `next/link`, which only renders in-app navigations. */
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className, "data-router-link": "true" }, children),
}));

const { Footer } = await import("../src/ui/layout/footer");

const markup = renderToStaticMarkup(createElement(Footer));

describe("the sidebar footer", () => {
  it("lists the feature catalog", () => {
    expect(FOOTER_LINKS.map((link) => link.url)).toContain("/features");
  });

  it("follows an app route through the router, with no absolute URL", () => {
    expect(markup).toMatch(/<a href="\/features"[^>]*data-router-link="true"/);
    expect(markup).not.toContain('href="http://localhost/features"');
  });

  it("keeps a full page load for the statically exported docs site", () => {
    expect(markup).toContain('<a href="/docs"');
    expect(markup).not.toMatch(/<a href="\/docs"[^>]*data-router-link/);
  });

  it("opens outside sites in a new tab", () => {
    expect(markup).toMatch(/<a href="https:\/\/github.com\/debate" target="_blank"/);
  });
});
