/**
 * @fileoverview Category navigation dock for videos page
 * @module components/debate/videos/components/CategoryDock
 */

import Image from "next/image"
import { Dock, DockIcon, DockItem } from "@/components/ui/dock"

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
 * Navigation dock with category icons
 */
export function CategoryDock({ currentCategory, onCategoryChange }: CategoryDockProps) {
  return (
    <Dock direction="middle" className="mb-8">
      {DOCK_ITEMS.map(({ category, label, icon }) => (
        <DockItem key={category} onClick={() => onCategoryChange(category)} className="flex flex-col items-center gap-2 min-w-[70px] group">
          <DockIcon className={currentCategory === category ? "text-blue-500" : ""}>
            <Image src={icon} alt={label} width={32} height={32} className="w-full h-full" />
          </DockIcon>
          <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === category ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
            {label}
          </span>
        </DockItem>
      ))}
    </Dock>
  )
}
