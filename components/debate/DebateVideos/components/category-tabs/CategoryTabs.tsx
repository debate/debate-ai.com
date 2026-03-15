/**
 * @fileoverview Category tabs slider for lecture categories
 */

"use client"

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  Lightbulb,
  Shield,
  Brain,
  Scale,
  Gavel,
  TrendingDown,
  Mic,
  BookOpen,
  Globe,
  Video,
  Award,
  Target,
  Sparkles,
  Users,
  Film,
  GraduationCap,
  Rocket,
} from "lucide-react"

interface Category {
  key: string
  label: string
  description: string
  icon?: React.ComponentType<{ className?: string }>
}

interface CategoryTabsProps {
  categories: Category[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

// Icon mapping for each category
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  affirmative_strategy: Lightbulb,
  negative_strategy: Shield,
  kritik_critical_theory: Brain,
  counterplans_and_theory: Scale,
  topicality_and_framework: Gavel,
  disadvantages: TrendingDown,
  speaking_and_delivery: Mic,
  research_and_flowing: BookOpen,
  topic_lectures: Globe,
  demo_debates: Video,
  judge_and_tournament_skills: Award,
  impact_calculus_and_evidence: Target,
  philosophy_and_ir_theory: Sparkles,
  public_forum: Users,
  documentaries_and_culture: Film,
  camp_and_coaching_advice: GraduationCap,
  novice_and_introductory: Rocket,
}

export function CategoryTabs({ categories, selectedCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="w-full mb-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <TooltipProvider>
          <div className="flex gap-2 pb-2">
            {/* All Categories tab */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCategoryChange("all")}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    "border border-border/50",
                    selectedCategory === "all"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-background hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Globe className="h-4 w-4" />
                  <span>All</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Show all lecture categories
              </TooltipContent>
            </Tooltip>

            {/* Category tabs */}
            {categories.map((category) => {
              const Icon = categoryIcons[category.key] || Sparkles
              return (
                <Tooltip key={category.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onCategoryChange(category.key)}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                        "border border-border/50",
                        selectedCategory === category.key
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-background hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{category.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {category.description}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
