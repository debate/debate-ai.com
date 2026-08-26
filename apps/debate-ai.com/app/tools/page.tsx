import type { Metadata } from "next"
import Link from "next/link"
import {
  Trophy, Inbox, Award, Library, NotebookPen, History, Gavel, Users, Dumbbell,
  ClipboardList, GraduationCap, Scale, FileText, Swords, MessageSquareText, Type,
  ListTree, Bot, Lightbulb, PlayCircle, TrendingUp, BarChart3, Users2, School,
  FolderTree, ThumbsUp, Medal, Target, BookOpen, PieChart, Presentation,
  ListChecks, Flame, CheckSquare, Landmark, MapPin, Sparkles, Bell, Compass,
  Rss, Gauge, Crosshair, Crown, Send,
  type LucideIcon,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "debate-ui/src/primitives/card"
import { ToolsSearch } from "./ToolsSearch"

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
      {
        href: "/cards/leaderboard", label: "Leaderboard", icon: Trophy,
        description: "Rank contributors by helpfulness score, tier, badges, and quest streak.",
        highlights: ["Ranked by total helpfulness score across every contribution kind", "Tier, streak, and merged tier/streak-milestone badges per row", "Your own row highlighted with a \"You\" badge when signed in"],
      },
      {
        href: "/news", label: "News Stream", icon: Rss,
        description: "A single feed for product updates and community announcements — new features, Daily Best Card winners, and Contributor Award standings.",
        highlights: ["Hand-picked product-update posts", "Auto-posts Daily Best Card and Contributor Award announcements", "Filter by category, like, and mark read"],
      },
      {
        href: "/cards/contributions", label: "Contributions Feed", icon: ThumbsUp,
        description: "Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations.",
        highlights: ["Every contribution kind in one scored feed", "Like, save, and endorse signals feed the Leaderboard"],
      },
      {
        href: "/cards/awards", label: "Contributor Awards", icon: Medal,
        description: "See category winners for best evidence finder, best explainer, and more, ranked by helpfulness score.",
        highlights: ["One card per contribution kind — evidence, summaries, highlights, annotations, arguments, refutations", "Freeze a day's standings as an official announced result"],
      },
      {
        href: "/cards/best-card", label: "Daily Best Card", icon: Sparkles,
        description: "Check today's highest-helpfulness card along with every past day's winner.",
        highlights: ["Live leader computed from the Contributions Feed", "Announce a day's winner to freeze it against later submissions"],
      },
      {
        href: "/cards/inbox", label: "Task Inbox", icon: Inbox,
        description: "See research tasks routed to contributors, grouped by topic.",
        highlights: ["Coverage-gap tasks routed by skill level, grouped by topic", "Mark done, then a different contributor verifies before it counts"],
      },
      {
        href: "/cards/progress", label: "Progress", icon: Award,
        description: "Track every contributor's unlock tier, badges, and daily-quest streak.",
        highlights: ["Tier, unlocked task skill level, streak, and badges per row", "Shows exactly how far each contributor is from the next tier"],
      },
      {
        href: "/cards/library", label: "Evidence Library", icon: Library,
        description: "Search shared cut cards and reusable analytic blocks by keyword, citation, or argument.",
        highlights: ["Full-text search plus kind/topic/case-area/tag filters", "Edit and Delete per entry — edits score toward Revision Incentives"],
      },
      {
        href: "/cards/scoring", label: "LLM Card Scoring", icon: Gauge,
        description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability.",
        highlights: ["Deterministic five-dimension heuristic score, ranked across every submitted card", "Likely-duplicate flag checked against the real Shared Evidence Library corpus", "Optional real Anthropic-backed qualitative verdict per card"],
      },
      {
        href: "/cards/revisions", label: "Revision Incentives", icon: History,
        description: "See contributors ranked by reward points earned improving weak cards, strengthening citations, and refreshing stale evidence.",
        highlights: ["Points for quality gains, citation completeness, and fresher evidence", "Weak-card improvements score double"],
      },
      {
        href: "/cards/reviews", label: "Review Queue", icon: MessageSquareText,
        description: "Move a submitted card through peer review by commenting, requesting changes, approving, and publishing it.",
        highlights: ["Full lifecycle: draft → in review → changes requested → approved → published", "Blocking comments must be resolved before approval"],
      },
      {
        href: "/cards/argument-library", label: "Argument Library", icon: FolderTree,
        description: "Browse shared research organized into topic folders, case areas, and tag-based collections.",
        highlights: ["Topic folders split into case-area subgroups", "Cross-cutting, tag-based collections alongside the folder view"],
      },
      {
        href: "/cards/group-challenges", label: "Group Challenges", icon: Target,
        description: "Create squad-scoped friendly challenges, like completing a set of blocks or winning a rebuttal exercise.",
        highlights: ["Contribution-count or recorded-win challenge goals", "Live per-member standings with an MVP badge for the leader"],
      },
      {
        href: "/cards/coverage", label: "Topic Coverage Dashboard", icon: PieChart,
        description: "See which arguments are well-covered, which are missing, and where the team needs more work.",
        highlights: ["Missing / thin / covered, by card count and word count", "Untracked section for submitted cards nobody added to the checklist"],
      },
      {
        href: "/cards/prep-room", label: "Collaboration Prep Room", icon: Presentation,
        description: "Share a topic's prep space, covering evidence, draft blocks, and routed research tasks.",
        highlights: ["Keyword search scoped to just this topic's evidence and drafts", "Active-now roster of teammates currently working the topic"],
      },
      {
        href: "/cards/progress-tracking", label: "Research Progress", icon: ListChecks,
        description: "Review each contributor's contribution history and per-topic task completion.",
        highlights: ["Contributions, task completion rate, and per-topic breakdown per row"],
      },
      {
        href: "/cards/streaks", label: "Quest Streaks", icon: Flame,
        description: "See every contributor's daily-quest streak and the milestone badges it has earned.",
        highlights: ["Current and longest streak, plus 3/7/14/30-day milestone badges", "Run today's mission check on demand"],
      },
      {
        href: "/cards/quests", label: "Daily Quests", icon: CheckSquare,
        description: "Track team goals like \"find 5 solvency cards\" against today's live progress from real contributions.",
        highlights: ["Progress tracked live against same-day contribution submissions", "Bulk-seed quests from a topic's under-covered arguments"],
      },
      {
        href: "/cards/brainstorm", label: "Team Brainstorm Assist", icon: Lightbulb,
        description: "Submit and upvote squad ideas for an argument block, grouped into boards by category.",
        highlights: ["Boards for new arguments, impact framing, frontlines, and turns", "Near-duplicate badge, plus AI-generated idea seeding"],
      },
      {
        href: "/cards/collaboration", label: "Team Collaboration Mode", icon: Users2,
        description: "Leave live prep notes on a shared topic sprint, grouped by topic.",
        highlights: ["Open / covered / needs-follow-up cycle per note", "Assign a note to a teammate directly from the board"],
      },
    ],
  },
  {
    heading: "Prep & Practice",
    tools: [
      {
        href: "/prep-notes", label: "Prep Notes", icon: NotebookPen,
        description: "Keep live prep notes across every flow, grouped by status.",
        highlights: ["Needs-follow-up notes surfaced first, then open, then covered", "Assign a note to a teammate — they get a real Notifications entry"],
      },
      {
        href: "/notifications", label: "Notifications", icon: Bell,
        description: "See assignee notifications for prep notes handed off to you as a task.",
        highlights: ["Fires automatically the moment a Prep Note is assigned to you", "Mark individual notifications read, newest first"],
      },
      {
        href: "/judges", label: "Judge Profiles", icon: Gavel,
        description: "Check side-vote bias, average speaker points, and tendencies for every saved judge profile.",
        highlights: ["Side-vote bias, speed tolerance, and theory receptiveness per judge", "Sorted by rounds judged — most experienced first"],
      },
      {
        href: "/opponents", label: "Opponent Team Profiles", icon: Users,
        description: "Review records, side-record tendencies, and common arguments or cases for every saved opponent scouting profile.",
        highlights: ["Overall and Aff/Neg side record, with a \"notably stronger side\" flag", "Most commonly run argument tags and cases per team"],
      },
      {
        href: "/drills", label: "Practice Drills", icon: Dumbbell,
        description: "Run quick practice drills generated from each round's flow.",
        highlights: ["Overview, frontline, cross-ex, and collapse-scenario prompts", "Generated straight from a round's already-flowed arguments"],
      },
      {
        href: "/briefings", label: "Pre-Round Briefings", icon: ClipboardList,
        description: "Pull opponent scouting, judge tendencies, head-to-head record, and prep notes together for a round.",
        highlights: ["Pulls straight from saved Opponent and Judge Profiles", "One briefing per round, with free-text team prep notes attached"],
      },
      {
        href: "/strategy", label: "Scout-to-Strategy", icon: Crosshair,
        description: "Turn opponent scouting and judge tendencies into a case-choice ranking and matchup risk level.",
        highlights: ["Reads straight from saved Opponent Team and Judge Profiles", "Ranks case options with a judge-adaptation note per option", "Also mounted in the Coach Workspace's Scouting section"],
      },
      {
        href: "/coaching", label: "AI Coach Mode", icon: GraduationCap,
        description: "Get extension, refutation, collapse, and weighing prompts generated from each round's flow.",
        highlights: ["Template prompts per round + side, generated from the flow", "\"Get AI feedback\" expands any prompt into open-ended coaching"],
      },
      {
        href: "/paradigms", label: "Judge Paradigm Picker", icon: Scale,
        description: "Pick a built-in or custom AI judge paradigm for a practice round.",
        highlights: ["Six built-ins: Flow, Lay, Policymaker, Kritikal, Educator, Truth Over Tech", "Or build a custom paradigm from a real judge's stated preferences"],
      },
      {
        href: "/judge-decision", label: "AI Judge Decision", icon: Landmark,
        description: "Generate an AI round decision under a round's saved judge paradigm and flow summary.",
        highlights: ["Decision reasoning grounded in the round's saved paradigm", "Reads the same flow summary the Argument Tree Outline shows"],
      },
      {
        href: "/summaries", label: "Speech Transcript Summaries", icon: FileText,
        description: "Get per-argument summaries derived from each round's flow, with cross-exam questions and extension ideas.",
        highlights: ["One summary per argument, straight from the flowed grid", "Cross-exam question and extension-idea suggestions included"],
      },
      {
        href: "/practice-opponent", label: "Opponent Persona Picker", icon: Swords,
        description: "Pick the AI practice-opponent style for a session.",
        highlights: ["Four built-ins: Policy Heavy, Kritik, Lay, Fast Flow", "Or describe your own opponent's debating style as a custom persona"],
      },
      {
        href: "/word-count", label: "Word-Count Speeches", icon: Type,
        description: "Practice speeches bounded by a maximum word count instead of a time limit.",
        highlights: ["Live word-count badge recomputed on every keystroke", "One text area per speech in the chosen word-count format"],
      },
      {
        href: "/outline", label: "Argument Tree Outline", icon: ListTree,
        description: "Browse a filterable outline of each round's flow, grouped by heading.",
        highlights: ["Filter by kind, side, speech, argument type, contributor, and evidence status", "\"Unanswered only\" toggle to spot open arguments fast"],
      },
      {
        href: "/versus-ai", label: "Online Debate Versus AI", icon: Bot,
        description: "Practice a full round against an AI opponent, choosing your own format and side.",
        highlights: ["Speeches submitted one at a time, in real turn order", "Any debate-timer format, aff or neg"],
      },
      {
        href: "/practice-round", label: "Practice Round Simulator", icon: PlayCircle,
        description: "Recreate a tournament round with a timer, judge paradigm, and AI opponent persona.",
        highlights: ["Format, side, AI judge paradigm, and AI opponent persona in one setup", "Built-in or custom paradigms and personas, same as the standalone pickers"],
      },
      {
        href: "/annotations", label: "Flow Annotations", icon: MapPin,
        description: "Drop timestamped flow annotations while watching a streamed or recorded round, and jump back to them.",
        highlights: ["Tied to a specific flowed argument, not just a raw timestamp", "Jump straight back to the moment from the annotation later"],
      },
      {
        href: "/speech-documents", label: "Speech Documents", icon: Send,
        description: "View and manage evidence sent from the Reason Editor toward the speech you're building.",
        highlights: ["Sent via Reason Editor's Mod-Shift-S shortcut or \"→Speech\" toolbar button", "Find-or-create by title, with a per-block Remove and a plain-text preview"],
      },
    ],
  },
  {
    heading: "Coaching & Analytics",
    tools: [
      {
        href: "/standings", label: "CX NDCA Standings", icon: TrendingUp,
        description: "See cumulative, ranked season standings built from recorded tournament results.",
        highlights: ["Record outround finish, prelim record, division, and bid level per result", "Ranked standings aggregated across every tournament a team attended"],
      },
      {
        href: "/outcomes", label: "AI Response-Outcome Charts", icon: BarChart3,
        description: "See per-side exposure and the most vulnerable arguments in each round's flow.",
        highlights: ["\"What if\" picker recomputes exposure under a hypothetical extend/answer/concede", "AI counsel panel assesses likely response paths for exposed arguments"],
      },
      {
        href: "/rank", label: "Team Rankings", icon: Crown,
        description: "Debate team rankings, leaderboard, and Elo ratings.",
        highlights: ["Elo-based team leaderboard", "Complements CX NDCA Standings' tournament-result view"],
      },
      {
        href: "/coaching-programs", label: "Coaching Programs", icon: School,
        description: "Run group coaching spaces scoped to a squad roster.",
        highlights: ["A shared topic sprint, group-challenge standings, and drills in one board", "Scoped to a named squad roster you control"],
      },
      {
        href: "/coach-materials", label: "Coach Materials", icon: BookOpen,
        description: "Upload grounding materials for the team coach AI and preview which ones answer a question.",
        highlights: ["Upload a .docx/.txt/.md file or dictate by voice instead of pasting text", "Preview which materials a question would draw on before asking"],
      },
    ],
  },
]

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tools</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every workspace, research, and practice tool in one place.</p>
          </div>
          <Link
            href="/reason-editor"
            className="hidden sm:inline-flex h-9 items-center rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-accent"
            title="Open the command palette from anywhere in the app"
          >
            Press Ctrl/Cmd+Shift+Space for the command menu
          </Link>
        </div>
        <ToolsSearch />
        <div className="flex flex-col gap-10" data-tools-grid>
          {TOOL_GROUPS.map((group) => (
            <section key={group.heading} data-tool-section>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{group.heading}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="block"
                    data-tool-search={[tool.label, tool.description, ...(tool.highlights ?? [])].join(" ").toLowerCase()}
                  >
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
