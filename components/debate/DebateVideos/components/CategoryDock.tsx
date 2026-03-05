/**
 * @fileoverview Category navigation dock for videos page
 * @module components/debate/videos/components/CategoryDock
 */

import Image from "next/image"
import { cn } from "@/lib/utils"
import { Trophy, BookOpen, BarChart3, Presentation, Radio } from "lucide-react"
import type { CategoryType } from "@/lib/types/videos"
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock"
import {
  IconRoundsYoutube,
  IconLectures,
  IconTopRounds,
  IconBook,
  IconLeaderboard,
} from "@/components/icons"

interface CategoryDockProps {
  currentCategory: CategoryType
  onCategoryChange: (category: CategoryType) => void
}

const DOCK_ITEMS: { category: CategoryType; label: string; icon: any }[] = [
  { category: "rounds", label: "Debates", icon: IconRoundsYoutube },
  { category: "lectures", label: "Lectures", icon: IconLectures },
  { category: "topPicks", label: "Top Picks", icon: IconTopRounds },
  { category: "dictionary", label: "Dictionary", icon: IconBook },
  { category: "leaderboard", label: "Leaderboard", icon: IconLeaderboard },
]

/**
 * Navigation dock with category icons.
 * On mobile: circular icon-only buttons matching the bottom app dock style.
 * On desktop: icons with visible text labels below.
 */
export function CategoryDock({ currentCategory, onCategoryChange }: CategoryDockProps) {
  return (
    <Dock direction="middle" className="h-[52px] shrink-0">
      {DOCK_ITEMS.map(({ category, label, icon }) => (
        <DockItem
          key={category}
          onClick={() => onCategoryChange(category)}
          className={cn(
            "flex flex-col items-center gap-0.5  rounded-full transition-colors group",
            currentCategory === category
              ? "bg-primary/20 ring-2 ring-primary"
              : "bg-gray-200 dark:bg-neutral-800",
          )}
        >
          <DockLabel className="hidden sm:block">{label}</DockLabel>
          <DockIcon className={currentCategory === category ? "text-blue-500" : ""}>
            <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" />
          </DockIcon>
          <span className={cn(
            "text-[9px] leading-none font-medium sm:hidden",
            currentCategory === category ? "text-blue-500" : "",
          )}>{label}</span>
        </DockItem>
      ))}
    </Dock>
  )
}
