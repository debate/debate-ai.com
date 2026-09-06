/**
 * @file tool-guides.tsx
 * @description Landing-page cards for the task-oriented guides — the same
 * three groupings the app's tool page headers link to.
 */
import Link from "next/link"
import { ArrowRight, Dumbbell, Swords, Users2 } from "lucide-react"

const guides = [
  {
    href: "/docs/guides/training-tools",
    icon: Dumbbell,
    title: "Training tools",
    description:
      "Coach a flowed round: argument trees, AI coaching prompts, drills, coach materials, scouting, and briefings — the Coach Workspace end to end.",
    routes: ["/coach", "/coaching", "/drills", "/coaching-programs"],
  },
  {
    href: "/docs/guides/practice-tools",
    icon: Swords,
    title: "Practice tools",
    description:
      "Debate between tournaments: full rounds against an AI opponent, the practice round simulator, judge paradigms, opponent personas, and word-count speeches.",
    routes: ["/versus-ai", "/practice-round", "/paradigms", "/word-count"],
  },
  {
    href: "/docs/guides/research-collaboration",
    icon: Users2,
    title: "Research collaboration",
    description:
      "Run a squad's research sprint: topic coverage, the prep room, task routing, brainstorming, peer review, quests, and the leaderboard — the Research Workspace end to end.",
    routes: ["/research", "/cards/prep-room", "/cards/inbox", "/community-hub"],
  },
]

export function ToolGuides() {
  return (
    <section className="py-16 md:py-24 border-b border-border">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Start with a <span className="text-primary">guide</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Each guide walks one workflow through the app, then links to the feature spec for every tool it touches.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="animated-border-card group flex flex-col p-5 hover:bg-card/80 transition-all duration-300"
            >
              <div className="relative z-10 flex flex-1 flex-col">
                <guide.icon className="h-7 w-7 text-primary mb-3 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="font-semibold mb-1.5 text-foreground">{guide.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{guide.description}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {guide.routes.map((route) => (
                    <li key={route} className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {route}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read the guide
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
