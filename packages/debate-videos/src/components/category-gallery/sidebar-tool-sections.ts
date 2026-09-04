/**
 * @fileoverview The Coaching / Research / Practice tool sections rendered in
 * the videos sidebar underneath the "Lectures" node. Mirrors the entries of
 * the app's `/tools` catalog (`app/tools/tool-groups.ts`), regrouped into the
 * three headings the sidebar shows and trimmed to the label + href the tree
 * needs — the sidebar lives in this package, which cannot import app-local
 * modules, so the links are restated here rather than derived.
 *
 * @module components/category-gallery/sidebar-tool-sections
 */

import { Dumbbell, GraduationCap, Library, type LucideIcon } from "lucide-react";

export interface SidebarToolLink {
  /** In-app path this entry links to. */
  href: string;
  title: string;
}

export interface SidebarToolSection {
  /** Stable id, used to key the section's expanded state. */
  id: string;
  title: string;
  /** Destination of the section heading itself — its flagship tool. */
  href: string;
  icon: LucideIcon;
  tools: SidebarToolLink[];
}

export const SIDEBAR_TOOL_SECTIONS: SidebarToolSection[] = [
  {
    id: "coaching",
    title: "Coaching",
    href: "/coach",
    icon: GraduationCap,
    tools: [
      { href: "/coach", title: "Coach Workspace" },
      { href: "/coaching", title: "AI Coach Mode" },
      { href: "/coaching-programs", title: "Coaching Programs" },
      { href: "/coach-materials", title: "Coach Materials" },
      { href: "/outcomes", title: "Response-Outcome Charts" },
      { href: "/rank", title: "Team Rankings" },
      { href: "/cards/leaderboard", title: "Leaderboard" },
      { href: "/cards/progress-tracking", title: "Research Progress" },
    ],
  },
  {
    id: "research",
    title: "Research",
    href: "/research",
    icon: Library,
    tools: [
      { href: "/research", title: "Research Workspace" },
      { href: "/community-hub", title: "Community Research Hub" },
      { href: "/cards/library", title: "Evidence Library" },
      { href: "/cards/argument-library", title: "Argument Library" },
      { href: "/cards/coverage", title: "Topic Coverage" },
      { href: "/cards/prep-room", title: "Collaboration Prep Room" },
      { href: "/cards/reviews", title: "Review Queue" },
      { href: "/cards/inbox", title: "Task Inbox" },
      { href: "/cards/contributions", title: "Contributions Feed" },
      { href: "/cards/brainstorm", title: "Team Brainstorm Assist" },
      { href: "/reason-editor", title: "Reason Editor" },
      { href: "/doc", title: "Debate Docs" },
    ],
  },
  {
    id: "practice",
    title: "Practice",
    href: "/practice-round",
    icon: Dumbbell,
    tools: [
      { href: "/practice-round", title: "Practice Round Simulator" },
      { href: "/versus-ai", title: "Debate Versus AI" },
      { href: "/drills", title: "Practice Drills" },
      { href: "/briefings", title: "Pre-Round Briefings" },
      { href: "/strategy", title: "Scout-to-Strategy" },
      { href: "/opponents", title: "Opponent Team Profiles" },
      { href: "/judges", title: "Judge Profiles" },
      { href: "/paradigms", title: "Judge Paradigm Picker" },
      { href: "/judge-decision", title: "AI Judge Decision" },
      { href: "/practice-opponent", title: "Opponent Persona Picker" },
      { href: "/summaries", title: "Speech Summaries" },
      { href: "/word-count", title: "Word-Count Speeches" },
      { href: "/outline", title: "Argument Tree Outline" },
      { href: "/prep-notes", title: "Prep Notes" },
      { href: "/annotations", title: "Flow Annotations" },
    ],
  },
];
