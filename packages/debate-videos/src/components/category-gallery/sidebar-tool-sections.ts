/**
 * @fileoverview The Research / Practice / Coaching tool sections rendered in
 * the videos sidebar underneath the "Round Videos" and "Lectures" nodes. Mirrors the entries of
 * the app's `/tools` catalog (`app/tools/tool-groups.ts`), regrouped into the
 * three headings the sidebar shows and trimmed to the label, href and icon
 * the tree needs — the sidebar lives in this package, which cannot import
 * app-local modules, so the links are restated here rather than derived.
 *
 * @module components/category-gallery/sidebar-tool-sections
 */

import {
  BadgeCheck,
  Bot,
  CalendarCheck,
  ChartLine,
  ChartPie,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Dumbbell,
  FileText,
  FolderOpen,
  Gavel,
  GraduationCap,
  Inbox,
  Library,
  Lightbulb,
  Map as MapIcon,
  Medal,
  MessageSquare,
  Presentation,
  Repeat,
  Rss,
  Scale,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  StickyNote,
  Swords,
  Handshake,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface SidebarToolLink {
  /** In-app path this entry links to. */
  href: string;
  title: string;
  /**
   * The row's glyph. A Lucide component rather than one of the imported
   * images in `ui/icons`, and required rather than optional, so every row in
   * the tool tree draws with `currentColor` and therefore picks up the one
   * icon color `TreeItem` sets. An image icon would render at its own
   * baked-in colors next to them; see `TreeItem`'s `TREE_ITEM_ICON_CLASS`.
   */
  icon: LucideIcon;
}

export interface SidebarToolSection {
  /** Stable id, used to key the section's expanded state. */
  id: string;
  title: string;
  /**
   * The section's flagship tool. The heading itself no longer links anywhere
   * — it only toggles the section (see `ToolNavTree`) — so this is here for
   * `sidebar-routes`, which folds it into the set of paths that get the tool
   * sidebar. The same href is always listed in `tools` as well.
   */
  href: string;
  icon: LucideIcon;
  tools: SidebarToolLink[];
}

/**
 * The tools catalog. The sidebar tree no longer restates the app dock as an
 * "Apps" node, so this is here for the dock's own Settings menu (the app's
 * `dock-menu-sections`) and for `sidebar-routes`, which folds it into the set
 * of paths that get the tool sidebar. It is deliberately *not* one of the
 * {@link APP_DOCK_LINKS} below: the app dock carries no Tools icon, because
 * holding the dock to five destinations is what lets its sidebar-hosted
 * instance fit inside this column.
 */
export const TOOLS_ROOT_HREF = "/tools";

/**
 * Mirrors `CategoryDock`'s `NAV_ITEMS` (the app dock icons shown at the top
 * of this sidebar via `dockSlot`) — restated here for the same reason as
 * `SIDEBAR_TOOL_SECTIONS` above. The tree used to render these as an "Apps"
 * node: the dock's own five icons, spelled out again as text directly beneath
 * the dock. They remain the source for the dock's Settings menu, which is the
 * one menu a phone has on every route, and for `sidebar-routes`.
 */
export const APP_DOCK_LINKS: SidebarToolLink[] = [
  { href: "/videos", title: "Videos", icon: Clapperboard },
  { href: "/research/cards", title: "Shared", icon: Share2 },
  { href: "/debate", title: "Debate", icon: MessageSquare },
  { href: "/practice/versus-ai", title: "Practice vs AI", icon: Swords },
  { href: "/doc", title: "Docs", icon: FileText },
];

/**
 * Id of the Practice section, which also carries the video library's
 * glossary/rankings pair (see `ToolNavTree`). Named for the same reason as
 * {@link RESEARCH_SECTION_ID} below.
 */
export const PRACTICE_SECTION_ID = "practice";

/**
 * Id of the Research section — the one section the `/research/cards` sidebar keeps
 * (`AppSidebarShell`), where the column is the document tree plus the research
 * tools and nothing else. Named rather than spelled inline at the call site so
 * renaming the section below can't silently empty that sidebar.
 */
export const RESEARCH_SECTION_ID = "research";

export const SIDEBAR_TOOL_SECTIONS: SidebarToolSection[] = [
  {
    id: "research",
    title: "Research",
    href: "/research",
    icon: Library,
    tools: [
      { href: "/research", title: "Research Workspace", icon: Search },
      { href: "/research/cards", title: "Card Search", icon: Search },
      { href: "/research/cards/coverage", title: "Topic Coverage", icon: ChartPie },
      { href: "/research/cards/prep-room", title: "Collaboration Prep Room", icon: DoorOpen },
      { href: "/research/cards/reviews", title: "Review Queue", icon: ClipboardCheck },
      { href: "/research/cards/inbox", title: "Task Inbox", icon: Inbox },
      { href: "/research/cards/contributions", title: "Contributions Feed", icon: Rss },
      { href: "/research/cards/brainstorm", title: "Team Brainstorm Assist", icon: Lightbulb },
      { href: "/coaching/rankings", title: "Team Rankings", icon: Medal },
      { href: "/coaching/progress", title: "Research Progress", icon: TrendingUp },
    ],
  },
  {
    id: "practice",
    title: "Practice",
    href: "/practice",
    icon: Dumbbell,
    tools: [
      { href: "/practice", title: "Practice Round Simulator", icon: Timer },
      { href: "/practice/partners", title: "Practice Partners", icon: Handshake },
      // Same page, landing on the open judge seats (or the profile, for
      // someone who has not volunteered to judge yet).
      { href: "/practice/partners#judge", title: "Judge Practice Rounds", icon: Gavel },
      { href: "/practice/versus-ai", title: "Debate Versus AI", icon: Swords },
      { href: "/practice/drills", title: "Practice Drills", icon: Repeat },
      { href: "/practice/level", title: "Debater Level", icon: Star },
      { href: "/practice/briefings", title: "Pre-Round Briefings", icon: ClipboardList },
      { href: "/practice/strategy", title: "Scout-to-Strategy", icon: MapIcon },
      { href: "/practice/opponents", title: "Opponent Team Profiles", icon: Users },
      { href: "/practice/forums", title: "Latest News", icon: Rss },
      // Tabroom itself is not a row of its own: the tournaments page frames
      // beta.tabroom.com from a button at the top of the list, so one entry
      // covers both.
      { href: "/practice/tournaments", title: "Tournaments", icon: Trophy },
      { href: "/practice/judges", title: "Judge Profiles", icon: Gavel },
      { href: "/practice/judge-decision", title: "AI Judge Decision", icon: BadgeCheck },
      { href: "/practice/prep-notes", title: "Prep Notes", icon: StickyNote },
      { href: "/practice/features", title: "All Features", icon: Sparkles },
      { href: "/coaching/leaderboard", title: "Leaderboard", icon: Trophy },
    ],
  },
  {
    id: "coaching",
    title: "Coaching",
    href: "/coaching",
    icon: GraduationCap,
    tools: [
      { href: "/coaching", title: "Coach Workspace", icon: Presentation },
      { href: "/coaching/ai-coach", title: "AI Coach Mode", icon: Bot },
      { href: "/coaching/programs", title: "Coaching Programs", icon: CalendarCheck },
      { href: "/coaching/materials", title: "Coach Materials", icon: FolderOpen },
      { href: "/coaching/outcomes", title: "Response-Outcome Charts", icon: ChartLine },
      // Reference material, not a coaching tool, but it is what a coach
      // explains to a novice before the round — so it rides here rather than
      // in Practice.
      { href: "/practice/rules", title: "Formats & Rules", icon: Scale },
      // Companion guide page (not a coaching tool) — round-day setup for
      // debating off just a phone, so it rides with the coaching tools here
      // rather than only being reachable from the `/tools` catalog.
      { href: "/tools/mobile-setup", title: "Laptop-less Debating", icon: Smartphone },
    ],
  },
];
