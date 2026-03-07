/**
 * @fileoverview Floating action buttons (FABs) for the CARD search interface.
 *
 * Renders circular buttons fixed to the bottom-right corner:
 * - **AI Analysis** button: always visible on desktop when the AI sidebar
 *   is collapsed; always visible on mobile.
 * - **Search** button: mobile-only, opens the search sidebar overlay.
 *
 * @module components/debate/DebateCARDSearch/layout/FloatingActions
 */

"use client"

import { Search, Bot } from "lucide-react"

/** Props for the {@link FloatingActions} component. */
interface FloatingActionsProps {
  /** Whether the AI analysis sidebar is currently collapsed. */
  isAiCollapsed: boolean
  /** Callback to open/expand the AI analysis sidebar. */
  onOpenAi: () => void
  /** Callback to open the search sidebar (mobile only). */
  onOpenSearch: () => void
}

/**
 * Bottom-right floating action buttons for sidebar toggling.
 *
 * @param props - See {@link FloatingActionsProps}.
 */
export function FloatingActions({ isAiCollapsed, onOpenAi, onOpenSearch }: FloatingActionsProps) {
  return (
    <div
      className={`md:fixed md:bottom-4 md:right-4 ${isAiCollapsed ? "md:block" : "md:hidden"} fixed bottom-20 right-4 flex flex-col gap-3 z-30`}
    >
      <button
        onClick={onOpenAi}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="Open AI Analysis"
      >
        <Bot className="h-6 w-6" />
      </button>
      <button
        onClick={onOpenSearch}
        className="md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="Open Search"
      >
        <Search className="h-6 w-6" />
      </button>
    </div>
  )
}
