/**
 * @file features-grid.tsx
 * @description Grid component displaying key facts about the Debate AI docs site.
 */
import {
  BookOpen,
  Compass,
  Search,
  Package,
  Github,
} from "lucide-react"

const features = [
  {
    icon: Compass,
    title: "Task Guides",
    description: "Walkthroughs of the training, practice, and research collaboration tools — the same three groups the app's page headers link to.",
  },
  {
    icon: BookOpen,
    title: "Feature Docs",
    description: "Behavior specs for every feature in the product, sourced from docs/features/.",
  },
  {
    icon: Package,
    title: "Package READMEs",
    description: "Every workspace package's README, published as a browsable reference.",
  },
  {
    icon: Search,
    title: "Full-Text Search",
    description: "Client-side search across all documentation, powered by Orama.",
  },
  {
    icon: Github,
    title: "GitHub-Linked",
    description: "Every page links back to its source file in debate/debate-ai.com.",
  },
]

export function FeaturesGrid() {
  return (
    <section className="relative py-20 md:py-32 border-b border-border overflow-hidden">
      <div className="absolute inset-0 animated-grid-bg opacity-30" />

      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="animated-border-card group p-5 hover:bg-card/80 transition-all duration-300"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="relative z-10">
                <feature.icon className="h-7 w-7 text-primary mb-3 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="font-semibold mb-1.5 text-foreground text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
