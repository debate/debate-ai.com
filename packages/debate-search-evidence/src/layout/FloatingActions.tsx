/**
 * @fileoverview Floating action buttons (FABs) for the CARD search interface.
 *
 * Renders a circular button fixed to the bottom-right corner:
 * - **AI Analysis** button: visible on desktop when the AI sidebar is
 *   collapsed. Hidden on mobile, where the search list is the default view and
 *   an open card carries its own AI summary tab.
 *
 * @module components/debate/DebateCardSearch/layout/FloatingActions
 */

"use client"

import { Bot } from "lucide-react"

/** Props for the {@link FloatingActions} component. */
interface FloatingActionsProps {
  /** Whether the AI analysis sidebar is currently collapsed. */
  isAiCollapsed: boolean
  /** Callback to open/expand the AI analysis sidebar. */
  onOpenAi: () => void
}

/**
 * Bottom-right floating action buttons for sidebar toggling.
 *
 * @param props - See {@link FloatingActionsProps}.
 */
export function FloatingActions({ isAiCollapsed, onOpenAi }: FloatingActionsProps) {
  return (
    <div
      className={`hidden md:fixed md:bottom-4 md:right-4 ${isAiCollapsed ? "md:block" : "md:hidden"} flex-col gap-3 z-30`}
    >
      <button
        onClick={onOpenAi}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="Open AI Analysis"
      >
        <Bot className="h-6 w-6" />
      </button>
    </div>
  )
}
