/**
 * @fileoverview The Videos portion of the sidebar tree — the destinations
 * under its "Videos" heading (Debate Rounds and Strategy Lectures first) plus the glossary/statistics
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
  Clapperboard,
  Globe,
  Heart,
  History,
  Landmark,
  Mic,
  Presentation,
  Star,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";

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
   * round archive's total is its headline number.
   */
  exactCount?: boolean;
}

/** Debate Rounds — the round videos of every format combined (no per-format
 *  split), with the lecture library's Formats section (Worlds, NSDA Speech,
 *  Demo Debates, Open Super Debates, Parli …) listed on its page. First child
 *  under "Videos". The per-format pages (`/videos/college`, `/videos/policy`,
 *  `/videos/ld`, `/videos/pf`) and bare `/videos` still render; the page links
 *  to them from its format badges. */
export const VIDEO_ROUNDS_LINK: SidebarVideoLink = {
  id: "rounds",
  href: "/videos/rounds",
  title: "Debate Rounds",
  glyph: Clapperboard,
  exactCount: true,
};

/** Strategy Lectures — the lecture library without its Formats section
 *  (General, Strategy, Topics & ideas). Its id stays `lectures`, the
 *  key the page and the per-category counts already use. */
export const VIDEO_STRATEGY_LECTURES_LINK: SidebarVideoLink = {
  id: "lectures",
  href: "/lectures",
  title: "Strategy Lectures",
  glyph: Presentation,
};

/** The Greatest of All-Time collection, a peer of the two destinations above. */
export const VIDEO_GOAT_LINK: SidebarVideoLink = {
  id: "topPicks",
  href: "/videos/goat",
  title: "Greatest of All-Time",
  glyph: Star,
};

/** The viewer's own library, the last rows under "Videos": My Favorites,
 *  then the watch history. */
export const VIDEO_LIBRARY_LINKS: SidebarVideoLink[] = [
  { id: "favorites", href: "/videos/favorites", title: "My Favorites", glyph: Heart },
  { id: "history", href: "/videos/history", title: "Watch History", glyph: History },
];

/** The World Schools, Congressional and Speech collections. They are not
 *  sidebar destinations: they show only as the row of cards above the search
 *  box on the All Videos page, so they stay out of
 *  {@link SIDEBAR_VIDEO_LINKS} (and with it the mobile tiles and the dock's
 *  menu, which both derive from that list). */
export const VIDEO_ALL_VIDEOS_FILTER_LINKS: SidebarVideoLink[] = [
  { id: "wsd", href: "/videos/wsd", title: "Worlds", glyph: Globe },
  { id: "acc", href: "/videos/acc", title: "Atlantic", glyph: Users },
  { id: "parli", href: "/videos/parli", title: "Parliamentary", glyph: Landmark },
  { id: "congress", href: "/videos/congress", title: "Congress", glyph: Vote },
  { id: "speech", href: "/videos/speech", title: "Speech", glyph: Mic },
];

/** The collections shown as cards above the search box on College Team
 *  Debates: the ACC tournament's rounds are college rounds filed under ACC,
 *  and Parli (parliamentary debate) sits next to it. */
export const VIDEO_COLLEGE_FILTER_LINKS: SidebarVideoLink[] = VIDEO_ALL_VIDEOS_FILTER_LINKS.filter(
  (link) => link.id === "acc" || link.id === "parli",
);

/** The reference view listed under Inference rather than as a videos row.
 *  Team Rankings lives in the Research tool section instead, so rankings
 *  appear only once. The glossary used to be here too; it is a tab of
 *  `/practice/rules` now, which is not a video library page. */
export const VIDEO_REFERENCE_LINKS: SidebarVideoLink[] = [
  { id: "statistics", href: "/practice/statistics", title: "Topics & Statistics", glyph: BarChart3 },
];

/** Every videos destination the sidebar links to, in tree order. */
export const SIDEBAR_VIDEO_LINKS: SidebarVideoLink[] = [
  VIDEO_ROUNDS_LINK,
  VIDEO_STRATEGY_LECTURES_LINK,
  VIDEO_GOAT_LINK,
  ...VIDEO_LIBRARY_LINKS,
  ...VIDEO_REFERENCE_LINKS,
];

/** Lookup by {@link SidebarVideoLink.id}, for surfaces that carry their own
 *  per-id extras (tile artwork, tree icons) and only need href + title. */
export const SIDEBAR_VIDEO_LINKS_BY_ID: Record<string, SidebarVideoLink> =
  Object.fromEntries(SIDEBAR_VIDEO_LINKS.map((link) => [link.id, link]));
