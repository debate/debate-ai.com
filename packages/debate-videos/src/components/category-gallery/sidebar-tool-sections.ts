/**
 * @fileoverview The Coaching / Research / Practice tool sections rendered in
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
  BookMarked,
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
  Hash,
  Highlighter,
  Inbox,
  Library,
  Lightbulb,
  ListTree,
  Map as MapIcon,
  Medal,
  MessageSquare,
  MessagesSquare,
  PenLine,
  Presentation,
  Repeat,
  Rss,
  Scale,
  ScrollText,
  Search,
  Share2,
  StickyNote,
  Swords,
  Timer,
  TrendingUp,
  Trophy,
  User,
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
  { href: "/cards", title: "Shared", icon: Share2 },
  { href: "/debate", title: "Debate", icon: MessageSquare },
  { href: "/versus-ai", title: "Practice vs AI", icon: Swords },
  { href: "/doc", title: "Docs", icon: FileText },
];

/**
 * Id of the Practice section, which also carries the video library's
 * glossary/rankings pair (see `ToolNavTree`). Named for the same reason as
 * {@link RESEARCH_SECTION_ID} below.
 */
export const PRACTICE_SECTION_ID = "practice";

/**
 * Id of the Research section — the one section the `/cards` sidebar keeps
 * (`AppSidebarShell`), where the column is the document tree plus the research
 * tools and nothing else. Named rather than spelled inline at the call site so
 * renaming the section below can't silently empty that sidebar.
 */
export const RESEARCH_SECTION_ID = "research";

export const SIDEBAR_TOOL_SECTIONS: SidebarToolSection[] = [
  {
    id: "coaching",
    title: "Coaching",
    href: "/coach",
    icon: GraduationCap,
    tools: [
      { href: "/coach", title: "Coach Workspace", icon: Presentation },
      { href: "/coaching", title: "AI Coach Mode", icon: Bot },
      { href: "/coaching-programs", title: "Coaching Programs", icon: CalendarCheck },
      { href: "/coach-materials", title: "Coach Materials", icon: FolderOpen },
      { href: "/outcomes", title: "Response-Outcome Charts", icon: ChartLine },
      { href: "/rank", title: "Team Rankings", icon: Medal },
      { href: "/cards/leaderboard", title: "Leaderboard", icon: Trophy },
      { href: "/cards/progress-tracking", title: "Research Progress", icon: TrendingUp },
    ],
  },
  {
    id: "research",
    title: "Research",
    href: "/research",
    icon: Library,
    tools: [
      { href: "/research", title: "Research Workspace", icon: Search },
      { href: "/community-hub", title: "Community Research Hub", icon: Users },
      { href: "/cards/library", title: "Evidence Library", icon: BookMarked },
      { href: "/cards/argument-library", title: "Argument Library", icon: MessagesSquare },
      { href: "/cards/coverage", title: "Topic Coverage", icon: ChartPie },
      { href: "/cards/prep-room", title: "Collaboration Prep Room", icon: DoorOpen },
      { href: "/cards/reviews", title: "Review Queue", icon: ClipboardCheck },
      { href: "/cards/inbox", title: "Task Inbox", icon: Inbox },
      { href: "/cards/contributions", title: "Contributions Feed", icon: Rss },
      { href: "/cards/brainstorm", title: "Team Brainstorm Assist", icon: Lightbulb },
      { href: "/reason-editor", title: "Reason Editor", icon: PenLine },
      { href: "/doc", title: "Debate Docs", icon: FileText },
    ],
  },
  {
    id: "practice",
    title: "Practice",
    href: "/practice-round",
    icon: Dumbbell,
    tools: [
      { href: "/practice-round", title: "Practice Round Simulator", icon: Timer },
      { href: "/versus-ai", title: "Debate Versus AI", icon: Swords },
      { href: "/drills", title: "Practice Drills", icon: Repeat },
      { href: "/briefings", title: "Pre-Round Briefings", icon: ClipboardList },
      { href: "/strategy", title: "Scout-to-Strategy", icon: MapIcon },
      { href: "/opponents", title: "Opponent Team Profiles", icon: Users },
      { href: "/judges", title: "Judge Profiles", icon: Gavel },
      { href: "/paradigms", title: "Judge Paradigm Picker", icon: Scale },
      { href: "/judge-decision", title: "AI Judge Decision", icon: BadgeCheck },
      { href: "/practice-opponent", title: "Opponent Persona Picker", icon: User },
      { href: "/summaries", title: "Speech Summaries", icon: ScrollText },
      { href: "/word-count", title: "Word-Count Speeches", icon: Hash },
      { href: "/outline", title: "Argument Tree Outline", icon: ListTree },
      { href: "/prep-notes", title: "Prep Notes", icon: StickyNote },
      { href: "/annotations", title: "Flow Annotations", icon: Highlighter },
    ],
  },
];
