/**
 * @fileoverview Quick action buttons toolbar
 * @module components/debate/core/controls/QuickActionsBar
 */

import { Plus, Clock, Users, Columns2, X, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface QuickActionsBarProps {
  /** Handler for new flow */
  onNewFlow: () => void
  /** Handler for settings */
  onSettings?: () => void
  /** Handler for history */
  onHistory: () => void
  /** Handler for clear history */
  onClearHistory?: () => void
  /** Handler for toggle split */
  onToggleSplit: () => void
  /** Handler for edit round */
  onEditRound?: () => void
  /** Whether split mode is active */
  splitMode: boolean
  /** Whether round editing is enabled */
  canEditRound?: boolean
}

/**
 * Quick action buttons for common operations
 */
export function QuickActionsBar({
  onNewFlow,
  onSettings,
  onHistory,
  onClearHistory,
  onToggleSplit,
  onEditRound,
  splitMode,
  canEditRound = false,
}: QuickActionsBarProps) {
  return (
    <div className="h-auto pb-[var(--padding)] grid grid-cols-4 gap-0.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onToggleSplit} size="icon" variant="ghost" className="h-7 w-7">
              {splitMode ? <X className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{splitMode ? "Exit Split Mode" : "Split Mode"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onNewFlow} size="icon" variant="ghost" className="h-7 w-7">
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add Flow</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onHistory}>
              <Clock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Flow History</p>
          </TooltipContent>
        </Tooltip>

        {onEditRound && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEditRound}
                disabled={!canEditRound}
              >
                <Users className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit Round</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
}
