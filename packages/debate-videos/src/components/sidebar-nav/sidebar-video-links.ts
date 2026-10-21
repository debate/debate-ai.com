/**
 * @fileoverview The Videos portion of the sidebar tree — the destinations
 * under its "Videos" heading (Lectures included) plus the glossary/statistics
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
 * @module components/sidebar-nav/sidebar-video-links
 */

import {
  BarChart3,
  BookOpen,
  Clapperboard,
  Globe,
  Heart,
  History,
  Mic,
  Presentation,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { IconFormatLD, IconFormatNDT, IconFormatPF, IconFormatVP } from "./FormatBadgeIcons";

export interface SidebarVideoLink {
  /** Quick-link id — the `activeId` / counts key for this destination. */
  id: string;
  href: string;
  title: string;
  /**
   * The row's Lucide glyph. Every surface that lists these links draws it —
   * the sidebar tree, the dock's nav menu, and the quick-link tiles that have
   * no artwork of their own — so a link never shows up icon-less on one of
   * them. Named `glyph` to match `QuickLinksGrid`'s own field of that name.
   */
  glyph: LucideIcon;
  /**
   * Show this destination's total unabbreviated. Thousands are shortened to
   * `1.4k` elsewhere to keep a count from crowding out its title; the
   * College Policy total is the round archive's headline number and reads
   * as `1400`, not `1.4k`.
   */
  exactCount?: boolean;
}

/** The All Videos node — every round and lecture in the library, and the
 *  app's home page (`/` renders it directly). First child under "Videos". */
export const VIDEO_ALL_LINK: SidebarVideoLink = {
  id: "allVideos",
  href: "/videos",
  title: "All Videos",
  glyph: Clapperboard,
  exactCount: true,
};

/** The College Policy node — the round archive's flagship link, and the
 *  first of the peer collections it heads in the tree. */
export const VIDEO_COLLEGE_LINK: SidebarVideoLink = {
  id: "college",
  href: "/videos/college",
  title: "College Team Debate",
  glyph: IconFormatNDT,
  exactCount: true,
};

/** The debate formats, peers of {@link VIDEO_COLLEGE_LINK} in the tree
 *  rather than children of it: they are sibling collections of the same
 *  round archive, not subsets of the college one. */
export const VIDEO_FORMAT_LINKS: SidebarVideoLink[] = [
  { id: "policy", href: "/videos/policy", title: "HS Team Debate", glyph: IconFormatVP },
  { id: "ld", href: "/videos/ld", title: "HS Individual Debate", glyph: IconFormatLD },
  { id: "pf", href: "/videos/pf", title: "HS Public Forum", glyph: IconFormatPF },
  { id: "topPicks", href: "/videos/goat", title: "Greatest of All-Time", glyph: Star },
];

/** The rest of the video library, the last rows under "Videos": My
 *  Favorites, the watch history, then Lectures — a single row whose
 *  categories live on the lectures page itself, not in the sidebar. */
export const VIDEO_LIBRARY_LINKS: SidebarVideoLink[] = [
  { id: "favorites", href: "/videos/favorites", title: "My Favorites", glyph: Heart },
  { id: "history", href: "/videos/history", title: "Watch History", glyph: History },
  { id: "lectures", href: "/lectures", title: "Lectures", glyph: Presentation },
];

/** The World Schools, Congressional and Speech collections. They are not
 *  sidebar destinations: they show only as the row of cards above the search
 *  box on the All Videos page, so they stay out of
 *  {@link SIDEBAR_VIDEO_LINKS} (and with it the mobile tiles and the dock's
 *  menu, which both derive from that list). */
export const VIDEO_ALL_VIDEOS_FILTER_LINKS: SidebarVideoLink[] = [
  { id: "wsd", href: "/videos/wsd", title: "WSD", glyph: Globe },
  { id: "acc", href: "/videos/acc", title: "ACC", glyph: Users },
  { id: "speech", href: "/videos/speech", title: "Speech", glyph: Mic },
];

/** The collections shown as cards above the search box on College Team
 *  Debates: the ACC tournament's rounds are college rounds filed under ACC. */
export const VIDEO_COLLEGE_FILTER_LINKS: SidebarVideoLink[] = VIDEO_ALL_VIDEOS_FILTER_LINKS.filter(
  (link) => link.id === "acc",
);

/** The pair pinned below the tree, under its own divider. Team Rankings lives
 *  in the Research tool section instead, so rankings appear only once. */
export const VIDEO_REFERENCE_LINKS: SidebarVideoLink[] = [
  { id: "dictionary", href: "/practice/glossary", title: "Glossary of Terms", glyph: BookOpen },
  { id: "statistics", href: "/practice/statistics", title: "Topics & Video Statistics", glyph: BarChart3 },
];

/** Every videos destination the sidebar links to, in tree order. */
export const SIDEBAR_VIDEO_LINKS: SidebarVideoLink[] = [
  VIDEO_ALL_LINK,
  VIDEO_COLLEGE_LINK,
  ...VIDEO_FORMAT_LINKS,
  ...VIDEO_LIBRARY_LINKS,
  ...VIDEO_REFERENCE_LINKS,
];

/** Lookup by {@link SidebarVideoLink.id}, for surfaces that carry their own
 *  per-id extras (tile artwork, tree icons) and only need href + title. */
export const SIDEBAR_VIDEO_LINKS_BY_ID: Record<string, SidebarVideoLink> =
  Object.fromEntries(SIDEBAR_VIDEO_LINKS.map((link) => [link.id, link]));
