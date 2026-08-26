import type { Metadata } from "next"
import Link from "next/link"
import {
  Trophy, Inbox, Award, Library, NotebookPen, History, Gavel, Users, Dumbbell,
  ClipboardList, GraduationCap, Scale, FileText, Swords, MessageSquareText, Type,
  ListTree, Bot, Lightbulb, PlayCircle, TrendingUp, BarChart3, Users2, School,
  FolderTree, ThumbsUp, Medal, Target, BookOpen, PieChart, Presentation,
  ListChecks, Flame, CheckSquare, Landmark, MapPin, Sparkles, Bell, Compass,
  Rss,
  type LucideIcon,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "debate-ui/src/primitives/card"

export const metadata: Metadata = {
  title: "Tools",
  description: "Every workspace, research, and practice tool in one place",
}

type Tool = {
  href: string
  label: string
  description: string
  icon: LucideIcon
  /** A few concrete things this tool does, shown under its description.
   *  Optional — most tools stay adequately described by `description`
   *  alone; add highlights where a one-liner undersells what's there. */
  highlights?: string[]
}

const TOOL_GROUPS: { heading: string; tools: Tool[] }[] = [
  {
    heading: "Workspaces",
    tools: [
      {
        href: "/reason-editor", label: "Reason Editor", icon: FileText,
        description: "Draft and organize debate cards and outlines in the native REASON document editor, saved to your own account.",
        highlights: [
          "Google-Docs-style menu bar (File/Edit/Card/Format/Insert/AI/View/Tools/Workspace) above the ribbon",
          "Ctrl/Cmd-Shift-Space opens Search Everything — cards, commands, settings, files, and now other tools, all from one bar",
          "Verbatim/Cardmirror-compatible shortcuts: short cites, condense, emphasis, move-heading, send-to-speech-doc",
        ],
      },
      {
        href: "/doc", label: "Debate Docs", icon: BookOpen,
        description: "Write annotated summaries and case outlines in the REASON Docs research editor.",
        highlights: ["Nested document tree", "Outline Notation for case structure"],
      },
      {
        href: "/research", label: "Research Workspace", icon: Library,
        description: "Work the squad research workspace end to end, covering topic coverage, the evidence library, task routing, quests, leaderboards, and peer review.",
        highlights: ["Topic coverage dashboard", "Evidence library search", "Task routing, quests, and peer review in one place"],
      },
      {
        href: "/community-hub", label: "Community Research Hub", icon: Compass,
        description: "Search a directory of every shared research, collaboration, and pre-round or practice space across the community.",
        highlights: ["Cross-squad directory", "Filters by topic, format, and space type"],
      },
      {
        href: "/coach", label: "Coach Workspace", icon: GraduationCap,
        description: "Coach a round from the argument tree and flow summary through coaching prompts, drills, scouting, briefings, and practice rounds.",
        highlights: ["Argument tree + flow summary in one view", "AI coaching prompts and drills", "Opponent scouting and pre-round briefings"],
      },
    ],
  },
  {
    heading: "Community & Progress",
    tools: [
      { href: "/cards/leaderboard", label: "Leaderboard", icon: Trophy, description: "Rank contributors by helpfulness score, tier, badges, and quest streak." },
      {
        href: "/news", label: "News Stream", icon: Rss,
        description: "A single feed for product updates and community announcements — new features, Daily Best Card winners, and Contributor Award standings.",
        highlights: ["Hand-picked product-update posts", "Auto-posts Daily Best Card and Contributor Award announcements", "Filter by category, like, and mark read"],
      },
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

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every workspace, research, and practice tool in one place.</p>
        </div>
        <div className="flex flex-col gap-10">
          {TOOL_GROUPS.map((group) => (
            <section key={group.heading}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{group.heading}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <Link key={tool.href} href={tool.href} className="block">
                    <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                      <CardHeader className="px-4">
                        <div className="flex items-center gap-2">
                          <tool.icon className="h-5 w-5 shrink-0 text-foreground" />
                          <CardTitle className="text-base">{tool.label}</CardTitle>
                        </div>
                        <CardDescription>{tool.description}</CardDescription>
                        {tool.highlights && tool.highlights.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                            {tool.highlights.map((highlight) => (
                              <li key={highlight} className="flex gap-1.5">
                                <span aria-hidden="true">·</span>
                                <span>{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
