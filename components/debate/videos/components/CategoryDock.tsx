/**
 * @fileoverview Category navigation dock for videos page
 * @module components/debate/videos/components/CategoryDock
 */

import Image from "next/image"
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock"
import type { CategoryType } from "../hooks/useVideoState"

interface CategoryDockProps {
  currentCategory: CategoryType
  onCategoryChange: (category: CategoryType) => void
}

/**
 * Navigation dock with category icons
 */
export function CategoryDock({ currentCategory, onCategoryChange }: CategoryDockProps) {
  return (
    <Dock direction="middle" className="mb-8">
      <DockItem onClick={() => onCategoryChange("rounds")} className="flex flex-col items-center gap-2 min-w-[70px] group">
        <DockIcon className={currentCategory === "rounds" ? "text-blue-500" : ""}>
          <Image src="/icons/icon-rounds.svg" alt="Debates" width={32} height={32} className="w-full h-full" />
        </DockIcon>
        <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === "rounds" ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
          Debates
        </span>
      </DockItem>

      <DockItem onClick={() => onCategoryChange("lectures")} className="flex flex-col items-center gap-2 min-w-[70px] group">
        <DockIcon className={currentCategory === "lectures" ? "text-blue-500" : ""}>
          <Image src="/icons/icon-lectures.svg" alt="Lectures" width={32} height={32} className="w-full h-full" />
        </DockIcon>
        <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === "lectures" ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
          Lectures
        </span>
      </DockItem>

      <DockItem onClick={() => onCategoryChange("topPicks")} className="flex flex-col items-center gap-2 min-w-[70px] group">
        <DockIcon className={currentCategory === "topPicks" ? "text-blue-500" : ""}>
          <Image src="/icons/icon-top-rounds.svg" alt="Top Picks" width={32} height={32} className="w-full h-full" />
        </DockIcon>
        <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === "topPicks" ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
          Top Picks
        </span>
      </DockItem>

      <DockItem onClick={() => onCategoryChange("champions")} className="flex flex-col items-center gap-2 min-w-[70px] group">
        <DockIcon className={currentCategory === "champions" ? "text-blue-500" : ""}>
          <Image src="/icons/icon-trophy.svg" alt="Champions" width={32} height={32} className="w-full h-full" />
        </DockIcon>
        <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === "champions" ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
          Champions
        </span>
      </DockItem>

      <DockItem onClick={() => onCategoryChange("dictionary")} className="flex flex-col items-center gap-2 min-w-[70px] group">
        <DockIcon className={currentCategory === "dictionary" ? "text-blue-500" : ""}>
          <Image src="/icons/icon-book.svg" alt="Dictionary" width={32} height={32} className="w-full h-full" />
        </DockIcon>
        <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === "dictionary" ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
          Dictionary
        </span>
      </DockItem>

      <DockItem onClick={() => onCategoryChange("leaderboard")} className="flex flex-col items-center gap-2 min-w-[70px] group">
        <DockIcon className={currentCategory === "leaderboard" ? "text-blue-500" : ""}>
          <Image src="/icons/icon-leaderboard.png" alt="Leaderboard" width={32} height={32} className="w-full h-full" />
        </DockIcon>
        <span className={`text-xs font-medium whitespace-nowrap transition-colors ${currentCategory === "leaderboard" ? "text-blue-500 font-semibold" : "text-muted-foreground group-hover:text-foreground"}`}>
          Leaderboard
        </span>
      </DockItem>
    </Dock>
  )
}
