/**
 * @fileoverview The Videos portion of the sidebar tree — the destinations
 * under its "Round Videos" and "Lectures" headings plus the glossary/rankings
 * pair pinned below the tree — as plain data.
 *
 * Three surfaces render these links and used to each restate them: the
 * sidebar tree (`VideoSidebarTree`), the mobile quick-link tiles
 * (`QuickLinksGrid`, which adds a logo and gradient per id), and — since the
 * sidebar itself is `md+` only — the app dock's Settings menu, the one menu
 * a phone has on every route. Deriving all three from this list is what
 * keeps a link that exists in the sidebar from going missing on mobile.
 *
 * `id` is the key the video pages already use for `activeId` and for the
 * per-category counts from `/api/videos/meta`, so it doubles as the join key
 * for `QuickLinksGrid`'s per-tile styling.
 *
 * @module components/category-gallery/sidebar-video-links
 */

export interface SidebarVideoLink {
  /** Quick-link id — the `activeId` / counts key for this destination. */
  id: string;
  href: string;
  title: string;
}

/** The College Debates node — the round archive's flagship link, and the
 *  first of the peer collections it heads in the tree. */
export const VIDEO_COLLEGE_LINK: SidebarVideoLink = {
  id: "college",
  href: "/videos/college",
  title: "College Debates",
};

/** The debate formats, peers of {@link VIDEO_COLLEGE_LINK} in the tree
 *  rather than children of it: they are sibling collections of the same
 *  round archive, not subsets of the college one. */
export const VIDEO_FORMAT_LINKS: SidebarVideoLink[] = [
  { id: "policy", href: "/videos/policy", title: "Policy Debates" },
  { id: "pf", href: "/videos/pf", title: "PF Debates" },
  { id: "ld", href: "/videos/ld", title: "LD Debates" },
  { id: "topPicks", href: "/videos/topPicks", title: "Greatest of All-Time" },
];

/** The rest of the video library: My Favorites, the last row under "Round
 *  Videos", and Lectures, which is a heading of its own. */
export const VIDEO_LIBRARY_LINKS: SidebarVideoLink[] = [
  { id: "favorites", href: "/videos/favorites", title: "My Favorites" },
  { id: "lectures", href: "/videos/lectures", title: "Lectures" },
];

/** The pair pinned below the tree, under its own divider. */
export const VIDEO_REFERENCE_LINKS: SidebarVideoLink[] = [
  { id: "dictionary", href: "/videos/dictionary", title: "Glossary of Terms" },
  { id: "rankings", href: "/videos/rankings", title: "Rankings" },
];

/** Every videos destination the sidebar links to, in tree order. */
export const SIDEBAR_VIDEO_LINKS: SidebarVideoLink[] = [
  VIDEO_COLLEGE_LINK,
  ...VIDEO_FORMAT_LINKS,
  ...VIDEO_LIBRARY_LINKS,
  ...VIDEO_REFERENCE_LINKS,
];

/** Lookup by {@link SidebarVideoLink.id}, for surfaces that carry their own
 *  per-id extras (tile artwork, tree icons) and only need href + title. */
export const SIDEBAR_VIDEO_LINKS_BY_ID: Record<string, SidebarVideoLink> =
  Object.fromEntries(SIDEBAR_VIDEO_LINKS.map((link) => [link.id, link]));
