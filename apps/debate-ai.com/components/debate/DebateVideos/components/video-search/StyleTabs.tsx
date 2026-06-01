"use client"

import { cn } from "@/lib/utils"
import type { DebateStyle } from "@/lib/types/videos"

const TABS: { value: DebateStyle; label: string }[] = [
  { value: 2, label: "Public Forum" },
  { value: 3, label: "LD" },
  { value: 1, label: "Policy" },
  { value: 4, label: "College NDT" },
]

interface StyleTabsProps {
  selectedStyle?: DebateStyle | ""
  onStyleChange: (style: DebateStyle | "") => void
}

export function StyleTabs({ selectedStyle, onStyleChange }: StyleTabsProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5 h-9 shrink-0">
      {TABS.map((tab, i) => {
        const active = selectedStyle === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onStyleChange(active ? "" : tab.value)}
            className={cn(
              "px-2.5 h-full text-xs font-medium rounded-md transition-colors whitespace-nowrap",
              i > 0 && "ml-0.5",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
