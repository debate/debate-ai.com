"use client";

/**
 * @fileoverview The standard site footer: brand block plus two columns of
 * links, for the pages that are marketing surfaces rather than app chrome.
 *
 * The sidebar already carries a link row of its own (`ToolSidebarFooter`, the
 * `Footer` in `debate-videos`), which is the right shape for a 300px column
 * under a nav tree. It is not the right shape for the bottom of a full-width
 * page: on the homepage there is no sidebar to hang it from, and the page ends
 * at the catalog with nothing after it. This is that footer — the sidebar's
 * apps and tool sections, each a column holding every item the sidebar lists
 * under it, followed by the site links.
 *
 * Every section is derived from the link data the rest of the chrome already
 * renders rather than restated, so the footer cannot drift from the app:
 * `FOOTER_LINKS` is the same one list the app dock's Settings menu shows under
 * Site Links, and
 * `APP_DOCK_LINKS`/`SIDEBAR_TOOL_SECTIONS` are the dock's icons and the nav
 * tree's sections and tools. Adding a link in `debate-videos` puts it in the sidebar
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
import { BookOpen } from "lucide-react";

import {
  APP_DOCK_LINKS,
  FOOTER_LINKS,
  SIDEBAR_TOOL_SECTIONS,
  type FooterLink,
} from "@debate/videos";

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
 * The dock's destinations, in the order the sidebar's apps group lists them,
 * plus Lectures, which has no other entry point in the chrome.
 */
const APPS_LINKS: FooterSectionLink[] = [
  ...APP_DOCK_LINKS.map((link) => ({
    href: link.href,
    label: link.title,
    icon: link.icon,
  })),
  { href: "/lectures", label: "Lectures", icon: BookOpen },
];

/** The site's own links, in the order `FOOTER_LINKS` lists them. */
const toLinks = (links: FooterLink[]): FooterSectionLink[] =>
  links.map((link) => ({
    href: link.url,
    label: link.text,
    icon: link.icon,
    hardNavigate: link.hardNavigate,
  }));

/**
 * The footer's columns, laid out the way the sidebar is: the apps, then each
 * of the nav tree's sections with every tool it holds (same titles, icons and
 * order as `NavMain`), then the site links.
 */
const SECTIONS: { title: string; links: FooterSectionLink[] }[] = [
  { title: "Apps", links: APPS_LINKS },
  ...SIDEBAR_TOOL_SECTIONS.map((section) => ({
    title: section.title,
    links: section.tools.map((tool) => ({
      href: tool.href,
      label: tool.title,
      icon: tool.icon,
    })),
  })),
  { title: "Site", links: toLinks(FOOTER_LINKS) },
];

/** A single row, rendering as a router link, an in-place page load or a new tab. */
function FooterRow({ href, label, icon: Icon, hardNavigate }: FooterSectionLink) {
  const isExternal = href.startsWith("http");
  const className =
    "group flex items-start gap-2 rounded-md py-1 text-sm text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none";

  const contents = (
    <>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" /> : null}
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
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10">
          {/* The mark, not the wordmark alone: it is the one place the footer
              repeats the app's own identity, and `APP_LOGO` is what the hero
              above it opens with. */}
          <img src={APP_LOGO} alt={APP_NAME} className="mb-4 h-8 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed">
            Cut, flow, drill, debate — the whole round, from first card to final
            ballot.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-7">
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

        <p className="mt-10 border-t border-border pt-6 text-center text-sm">
          © 2026 Debate AI Institute. All rights reserved.
        </p>
      </div>
    </footer>
  );
}