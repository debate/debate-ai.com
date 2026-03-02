/**
 * @fileoverview Category navigation dock for videos page
 * @module components/debate/videos/components/CategoryDock
 */

import Image from "next/image"
import { cn } from "@/lib/utils"
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock"

interface CategoryDockProps {
  currentCategory: CategoryType
  onCategoryChange: (category: CategoryType) => void
}

const DOCK_ITEMS: { category: CategoryType; label: string; icon: string }[] = [
  { category: "rounds",      label: "Debates",     icon: "/icons/icon-rounds.svg" },
  { category: "lectures",    label: "Lectures",    icon: "/icons/icon-lectures.svg" },
  { category: "topPicks",    label: "Top Picks",   icon: "/icons/icon-top-rounds.svg" },
  { category: "champions",   label: "Champions",   icon: "/icons/icon-trophy.svg" },
  { category: "dictionary",  label: "Dictionary",  icon: "/icons/icon-book.svg" },
  { category: "leaderboard", label: "Leaderboard", icon: "/icons/icon-leaderboard.png" },
]

/**
 * Navigation dock with category icons.
 * On mobile: circular icon-only buttons matching the bottom app dock style.
 * On desktop: icons with visible text labels below.
 */
export function CategoryDock({ currentCategory, onCategoryChange }: CategoryDockProps) {
  return (
    <Dock direction="middle" className="mb-4 sm:mb-8">
      {DOCK_ITEMS.map(({ category, label, icon }) => (
        <DockItem
          key={category}
          onClick={() => onCategoryChange(category)}
          className={cn(
            "aspect-square rounded-full transition-colors group",
            currentCategory === category
              ? "bg-primary/20 ring-2 ring-primary"
              : "bg-gray-200 dark:bg-neutral-800",
          )}
        >
          <DockLabel>{label}</DockLabel>
          <DockIcon className={currentCategory === category ? "text-blue-500" : ""}>
            <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" />
          </DockIcon>
        </DockItem>
      ))}
    </Dock>
  )
}
