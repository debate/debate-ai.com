/**
 * Shared tools registry — the single source of truth for "every workspace,
 * research, and practice tool in one place." Extracted out of
 * `app/tools/page.tsx` so the same list also backs the global command
 * palette (`components/layout/GlobalCommandPalette.tsx`), instead of that
 * palette carrying its own, driftable copy of every tool's href/label.
 */

import {
  Trophy, Inbox, Award, Library, NotebookPen, History, Gavel, Users, Dumbbell,
  ClipboardList, GraduationCap, Scale, FileText, Swords, MessageSquareText, Type,
  ListTree, Bot, Lightbulb, PlayCircle, TrendingUp, BarChart3, Users2, School,
  FolderTree, ThumbsUp, Medal, Target, BookOpen, PieChart, Presentation,
  ListChecks, Flame, CheckSquare, Landmark, MapPin, Sparkles, Bell, Compass,
  Newspaper,
  type LucideIcon,
} from "lucide-react"

export type Tool = {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export type ToolGroup = { heading: string; tools: Tool[] }

export const TOOL_GROUPS: ToolGroup[] = [
  {
    heading: "Workspaces",
    tools: [
      { href: "/reason-editor", label: "Reason Editor", icon: FileText, description: "Draft and organize debate cards and outlines in the native REASON document editor, saved to your own account." },
      { href: "/doc", label: "Debate Docs", icon: BookOpen, description: "Write annotated summaries and case outlines in the REASON Docs research editor." },
      { href: "/research", label: "Research Workspace", icon: Library, description: "Work the squad research workspace end to end, covering topic coverage, the evidence library, task routing, quests, leaderboards, and peer review." },
      { href: "/community-hub", label: "Community Research Hub", icon: Compass, description: "Search a directory of every shared research, collaboration, and pre-round or practice space across the community." },
      { href: "/coach", label: "Coach Workspace", icon: GraduationCap, description: "Coach a round from the argument tree and flow summary through coaching prompts, drills, scouting, briefings, and practice rounds." },
    ],
  },
  {
    heading: "Community & Progress",
    tools: [
      { href: "/news", label: "News Stream", icon: Newspaper, description: "See recently shipped features across the whole product, newest first." },
      { href: "/cards/leaderboard", label: "Leaderboard", icon: Trophy, description: "Rank contributors by helpfulness score, tier, badges, and quest streak." },
      { href: "/cards/contributions", label: "Contributions Feed", icon: ThumbsUp, description: "Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations." },
      { href: "/cards/awards", label: "Contributor Awards", icon: Medal, description: "See category winners for best evidence finder, best explainer, and more, ranked by helpfulness score." },
      { href: "/cards/best-card", label: "Daily Best Card", icon: Sparkles, description: "Check today's highest-helpfulness card along with every past day's winner." },
      { href: "/cards/inbox", label: "Task Inbox", icon: Inbox, description: "See research tasks routed to contributors, grouped by topic." },
      { href: "/cards/progress", label: "Progress", icon: Award, description: "Track every contributor's unlock tier, badges, and daily-quest streak." },
      { href: "/cards/library", label: "Evidence Library", icon: Library, description: "Search shared cut cards and reusable analytic blocks by keyword, citation, or argument." },
      { href: "/cards/revisions", label: "Revision Incentives", icon: History, description: "See contributors ranked by reward points earned improving weak cards, strengthening citations, and refreshing stale evidence." },
      { href: "/cards/reviews", label: "Review Queue", icon: MessageSquareText, description: "Move a submitted card through peer review by commenting, requesting changes, approving, and publishing it." },
      { href: "/cards/argument-library", label: "Argument Library", icon: FolderTree, description: "Browse shared research organized into topic folders, case areas, and tag-based collections." },
      { href: "/cards/group-challenges", label: "Group Challenges", icon: Target, description: "Create squad-scoped friendly challenges, like completing a set of blocks or winning a rebuttal exercise." },
      { href: "/cards/coverage", label: "Topic Coverage Dashboard", icon: PieChart, description: "See which arguments are well-covered, which are missing, and where the team needs more work." },
      { href: "/cards/prep-room", label: "Collaboration Prep Room", icon: Presentation, description: "Share a topic's prep space, covering evidence, draft blocks, and routed research tasks." },
      { href: "/cards/progress-tracking", label: "Research Progress", icon: ListChecks, description: "Review each contributor's contribution history and per-topic task completion." },
      { href: "/cards/streaks", label: "Quest Streaks", icon: Flame, description: "See every contributor's daily-quest streak and the milestone badges it has earned." },
      { href: "/cards/quests", label: "Daily Quests", icon: CheckSquare, description: "Track team goals like \"find 5 solvency cards\" against today's live progress from real contributions." },
      { href: "/cards/brainstorm", label: "Team Brainstorm Assist", icon: Lightbulb, description: "Submit and upvote squad ideas for an argument block, grouped into boards by category." },
      { href: "/cards/collaboration", label: "Team Collaboration Mode", icon: Users2, description: "Leave live prep notes on a shared topic sprint, grouped by topic." },
    ],
  },
  {
    heading: "Prep & Practice",
    tools: [
      { href: "/prep-notes", label: "Prep Notes", icon: NotebookPen, description: "Keep live prep notes across every flow, grouped by status." },
      { href: "/notifications", label: "Notifications", icon: Bell, description: "See assignee notifications for prep notes handed off to you as a task." },
      { href: "/judges", label: "Judge Profiles", icon: Gavel, description: "Check side-vote bias, average speaker points, and tendencies for every saved judge profile." },
      { href: "/opponents", label: "Opponent Team Profiles", icon: Users, description: "Review records, side-record tendencies, and common arguments or cases for every saved opponent scouting profile." },
      { href: "/drills", label: "Practice Drills", icon: Dumbbell, description: "Run quick practice drills generated from each round's flow." },
      { href: "/briefings", label: "Pre-Round Briefings", icon: ClipboardList, description: "Pull opponent scouting, judge tendencies, head-to-head record, and prep notes together for a round." },
      { href: "/coaching", label: "AI Coach Mode", icon: GraduationCap, description: "Get extension, refutation, collapse, and weighing prompts generated from each round's flow." },
      { href: "/paradigms", label: "Judge Paradigm Picker", icon: Scale, description: "Pick a built-in or custom AI judge paradigm for a practice round." },
      { href: "/judge-decision", label: "AI Judge Decision", icon: Landmark, description: "Generate an AI round decision under a round's saved judge paradigm and flow summary." },
      { href: "/summaries", label: "Speech Transcript Summaries", icon: FileText, description: "Get per-argument summaries derived from each round's flow, with cross-exam questions and extension ideas." },
      { href: "/practice-opponent", label: "Opponent Persona Picker", icon: Swords, description: "Pick the AI practice-opponent style for a session." },
      { href: "/word-count", label: "Word-Count Speeches", icon: Type, description: "Practice speeches bounded by a maximum word count instead of a time limit." },
      { href: "/outline", label: "Argument Tree Outline", icon: ListTree, description: "Browse a filterable outline of each round's flow, grouped by heading." },
      { href: "/versus-ai", label: "Online Debate Versus AI", icon: Bot, description: "Practice a full round against an AI opponent, choosing your own format and side." },
      { href: "/practice-round", label: "Practice Round Simulator", icon: PlayCircle, description: "Recreate a tournament round with a timer, judge paradigm, and AI opponent persona." },
      { href: "/annotations", label: "Flow Annotations", icon: MapPin, description: "Drop timestamped flow annotations while watching a streamed or recorded round, and jump back to them." },
      { href: "/speech-documents", label: "Speech Documents", icon: FileText, description: "See evidence sent from the Reason Editor toward the speech you're building." },
    ],
  },
  {
    heading: "Coaching & Analytics",
    tools: [
      { href: "/standings", label: "CX NDCA Standings", icon: TrendingUp, description: "See cumulative, ranked season standings built from recorded tournament results." },
      { href: "/outcomes", label: "AI Response-Outcome Charts", icon: BarChart3, description: "See per-side exposure and the most vulnerable arguments in each round's flow." },
      { href: "/coaching-programs", label: "Coaching Programs", icon: School, description: "Run group coaching spaces scoped to a squad roster." },
      { href: "/coach-materials", label: "Coach Materials", icon: BookOpen, description: "Upload grounding materials for the team coach AI and preview which ones answer a question." },
    ],
  },
]

/** Flattened list of every tool, for search/lookup by href. */
export const ALL_TOOLS: Tool[] = TOOL_GROUPS.flatMap((group) => group.tools)

export function findToolByHref(href: string): Tool | undefined {
  return ALL_TOOLS.find((tool) => tool.href === href)
}
