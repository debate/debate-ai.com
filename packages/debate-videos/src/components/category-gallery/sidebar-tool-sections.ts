/**
 * @fileoverview The Research / Prep & Scout / Practice / Coaching / Insights
 * tool sections rendered in
 * the videos sidebar underneath the "Round Videos" and "Lectures" nodes. Mirrors the entries of
 * the app's `/tools` catalog (`app/tools/tool-groups.ts`), regrouped into the
 * five headings the sidebar shows and trimmed to the label, href and icon
 * the tree needs — the sidebar lives in this package, which cannot import
 * app-local modules, so the links are restated here rather than derived.
 *
 * @module components/category-gallery/sidebar-tool-sections
 */

import {
  BadgeCheck,
  BarChart3,
  Binoculars,
  BookOpen,
  Bot,
  CalendarCheck,
  ChartColumn,
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
  Coins,
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
  { href: "/research/docs", title: "Research", icon: FileText },
];

/**
 * Id of the Practice section. Named for the same reason as
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

/** Id of the Prep & Scout section (opponent, judge and tournament scouting). */
export const PREP_SCOUT_SECTION_ID = "prep-scout";

/** Id of the Insights section, whose links split into labelled subgroups. */
export const INSIGHTS_SECTION_ID = "insights";

export const SIDEBAR_TOOL_SECTIONS: SidebarToolSection[] = [
  {
    // Build evidence, manage cards, coordinate research work, and prepare
    // files with a team.
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
    ],
  },
  {
    // Turn research into round-specific strategy by studying opponents,
    // judges, tournaments, news, and likely arguments.
    id: PREP_SCOUT_SECTION_ID,
    title: "Prep & Scout",
    href: "/practice/briefings",
    icon: Binoculars,
    tools: [
      { href: "/practice/briefings", title: "Pre-Round Briefings", icon: ClipboardList },
      { href: "/practice/strategy", title: "Scout-to-Strategy", icon: MapIcon },
      { href: "/practice/opponents", title: "Opponent Team Profiles", icon: Users },
      { href: "/practice/judges", title: "Judge Profiles", icon: Gavel },
      { href: "/practice/prep-notes", title: "Prep Notes", icon: StickyNote },
      { href: "/practice/forums", title: "Latest News", icon: Rss },
    ],
  },
  {
    // Simulate rounds, rehearse individual skills, compete with other users
    // or AI, and test predictions.
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
      { href: "/practice/predictions", title: "Prediction Markets", icon: Coins },
      { href: "/practice/versus-ai", title: "Debate Versus AI", icon: Swords },
      { href: "/practice/drills", title: "Practice Drills", icon: Repeat },
      { href: "/practice/judge-decision", title: "AI Judge Decision", icon: BadgeCheck },
      // Lives under /coaching, but it charts how practice responses play out,
      // so it sits with the practice tools.
      { href: "/coaching/outcomes", title: "AI Response-Outcome Charts", icon: ChartLine },
    ],
  },
  {
    // Instruction, feedback, structured development plans, and longitudinal
    // improvement analysis.
    id: "coaching",
    title: "Coaching",
    href: "/coaching",
    icon: GraduationCap,
    tools: [
      // Tournaments is this app's own view (live Tabroom plus the tournaments
      // hosted here), first in Coaching. The framed beta.tabroom.com page
      // (`/practice/tabroom`) is still routed but deliberately has no sidebar row.
      { href: "/tournaments", title: "Tournaments", icon: Trophy },
      { href: "/coaching", title: "Coach Workspace", icon: Presentation },
      { href: "/coaching/ai-coach", title: "AI Coach Mode", icon: Bot },
      { href: "/coaching/programs", title: "Coaching Programs", icon: CalendarCheck },
      { href: "/coaching/materials", title: "Coach Materials", icon: FolderOpen },
      { href: "/coaching/progress", title: "Research Progress", icon: TrendingUp },
      { href: "/coaching/laptopless", title: "Laptop-less Debating", icon: Smartphone },
    ],
  },
  {
    // Individual and team standing, debate-wide data, rules, terminology,
    // and product reference information — in two labelled subgroups.
    id: INSIGHTS_SECTION_ID,
    title: "Insights",
    href: "/coaching/rankings",
    icon: ChartColumn,
    tools: [
      { href: "/coaching/rankings", title: "Team Rankings", icon: Medal },
      { href: "/coaching/leaderboard", title: "Leaderboard", icon: Trophy },
      { href: "/practice/level", title: "Debater Level", icon: Star },
      { href: "/practice/statistics", title: "Topics & Video Statistics", icon: BarChart3 },
      { href: "/practice/rules", title: "Formats & Rules", icon: Scale },
      { href: "/practice/glossary", title: "Glossary of Terms", icon: BookOpen },
      { href: "/practice/features", title: "All Features", icon: Sparkles },
    ],
  },
];
