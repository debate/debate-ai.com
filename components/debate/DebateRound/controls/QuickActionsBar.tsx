/**
 * @fileoverview Quick action buttons toolbar
 * @module components/debate/flow/controls/QuickActionsBar
 */

import { Plus, Clock, Users, Columns2, Grid3x3, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/** Props for the QuickActionsBar component. */
interface QuickActionsBarProps {
  /** Handler called when the user requests a new flow. */
  onNewFlow: () => void
  /** Optional handler called when the user opens settings. */
  onSettings?: () => void
  /** Handler called when the user opens flow history. */
  onHistory: () => void
  /** Optional handler called when the user clears flow history. */
  onClearHistory?: () => void
  /** Handler called when the user toggles split mode. */
  onToggleSplit: () => void
  /** Optional handler called when the user opens the round editor. */
  onEditRound?: () => void
  /** Whether split mode is currently active. */
  splitMode: boolean
  /** Whether the edit-round action is available. */
  canEditRound?: boolean
}

/**
 * Quick action buttons for common flow operations.
 *
 * @param props - Component props.
 * @param props.onNewFlow - Callback invoked when the Add Flow button is clicked.
 * @param props.onSettings - Optional callback invoked when the settings button is clicked.
 * @param props.onHistory - Callback invoked when the Flow History button is clicked.
 * @param props.onClearHistory - Optional callback invoked when history is cleared.
 * @param props.onToggleSplit - Callback invoked when the split-mode toggle is clicked.
 * @param props.onEditRound - Optional callback invoked when the Edit Round button is clicked.
 * @param props.splitMode - Whether split mode is currently active; controls the toggle icon.
 * @param props.canEditRound - Whether the Edit Round button should be enabled.
 * @returns A grid of icon buttons with tooltips for quick flow actions.
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
              {splitMode ? <Grid3x3 className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{splitMode ? "Go to Spreadsheet Flow" : "Speech Side-by-Side View"}</p>
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
              >
                <Users className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{canEditRound ? "Edit Round" : "New Round"}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  )
}
