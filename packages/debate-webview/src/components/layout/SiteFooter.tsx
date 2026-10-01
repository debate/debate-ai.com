"use client";

/**
 * @fileoverview The standard site footer: brand block plus three columns of
 * links, for the pages that are marketing surfaces rather than app chrome.
 *
 * The sidebar already carries a link row of its own (`ToolSidebarFooter`, the
 * `Footer` in `debate-videos`), which is the right shape for a 300px column
 * under a nav tree. It is not the right shape for the bottom of a full-width
 * page: on the homepage there is no sidebar to hang it from, and the page ends
 * at the catalog with nothing after it. This is that footer — the same links,
 * grouped into sections instead of one wrapped row.
 *
 * Every section is derived from the link data the rest of the chrome already
 * renders rather than restated, so the footer cannot drift from the app:
 * `SITE_FOOTER_LINKS`/`DEBATE_FOOTER_LINKS` are the same two groups the app
 * dock's Settings menu shows (split by `FooterLink.group`), and
 * `APP_DOCK_LINKS`/`SIDEBAR_TOOL_SECTIONS` are the dock's icons and the nav
 * tree's headings. Adding a link in `debate-videos` puts it in the sidebar
 * footer, the dock menu and here at once.
 *
 * In-app routes are followed in place through the router, so the sidebar and
 * the persistent player survive the hop; an outside site opens in a new tab.
 * `/docs` is the one in-app-looking URL that needs a real page load, because
 * the help site renders without the app shell (`hardNavigate`, same as in
 * `debate-videos`' footer).
 *
 * @module components/layout/SiteFooter
 */

import Link from "next/link";
import { BookOpen, LayoutGrid, Sparkles } from "lucide-react";

import {
  APP_DOCK_LINKS,
  DEBATE_FOOTER_LINKS,
  FOOTER_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  TOOLS_ROOT_HREF,
  type FooterLink,
} from "debate-videos";

import { APP_LOGO, APP_NAME } from "../../lib/config/site";

interface FooterSectionLink {
  /** In-app path, or an absolute URL for an outside site. */
  href: string;
  label: string;
  icon?: FooterLink["icon"];
  /** Forces a full page load for an in-app-looking URL. See {@link FooterLink}. */
  hardNavigate?: boolean;
}

/**
 * The app's own surfaces: the dock's five destinations, then the nav tree's
 * three section headings, then the two catalog pages. Section headings rather
 * than their forty-odd tools — the tree is one click away in the sidebar, and
 * a footer that repeats it in full is a second, worse copy of the same list.
 */
const TOOLS_LINKS: FooterSectionLink[] = [
  ...APP_DOCK_LINKS.map((link) => ({
    href: link.href,
    label: link.title,
    icon: link.icon,
  })),
  ...SIDEBAR_TOOL_SECTIONS.map((section) => ({
    href: section.href,
    label: section.title,
    icon: section.icon,
  })),
  { href: "/lectures", label: "Lectures", icon: BookOpen },
  { href: TOOLS_ROOT_HREF, label: "All Tools", icon: LayoutGrid },
  { href: "/practice/features", label: "All Features", icon: Sparkles },
];

/** The site's own links, in the order `FOOTER_LINKS` lists them. */
const toLinks = (links: FooterLink[]): FooterSectionLink[] =>
  links.map((link) => ({
    href: link.url,
    label: link.text,
    icon: link.icon,
    hardNavigate: link.hardNavigate,
  }));

const SECTIONS: { title: string; links: FooterSectionLink[] }[] = [
  { title: "Tools", links: TOOLS_LINKS },
  { title: "Site", links: toLinks(FOOTER_LINKS.filter((link) => link.group === "site")) },
  { title: "Debate", links: toLinks(DEBATE_FOOTER_LINKS) },
];

/** A single row, rendering as a router link, an in-place page load or a new tab. */
function FooterRow({ href, label, icon: Icon, hardNavigate }: FooterSectionLink) {
  const isExternal = href.startsWith("http");
  const className =
    "group flex items-center gap-2 rounded-md py-1 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none";

  const contents = (
    <>
      {Icon ? <Icon className="size-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" /> : null}
      <span>{label}</span>
    </>
  );

  if (isExternal || hardNavigate) {
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : "_self"}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className={className}
      >
        {contents}
      </a>
    );
  }

  return (
    <Link href={href} prefetch={false} className={className}>
      {contents}
    </Link>
  );
}

/**
 * The standard footer for a full-width page.
 *
 * @returns The footer element, brand block and link sections.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background text-muted-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* The mark, not the wordmark alone: it is the one place the footer
              repeats the app's own identity, and `APP_LOGO` is what the hero
              above it opens with. */}
          <img src={APP_LOGO} alt={APP_NAME} className="mb-4 h-8 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed">
            Cut, flow, drill, debate — the whole round, from first card to final
            ballot.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <nav key={section.title} aria-label={section.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">
              {section.title}
            </h2>
            <ul className="flex flex-col">
              {section.links.map((link) => (
                <li key={`${section.title}:${link.href}:${link.label}`}>
                  <FooterRow {...link} />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs">
          {APP_NAME}. Built for debaters.
        </div>
      </div>
    </footer>
  );
}