/**
 * @fileoverview Sidebar for flow navigation and controls
 * @module components/debate/flow/layout/FlowPageSidebar
 */

import type React from "react"
import { Plus, Clock, Users, Columns2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FlowTab } from "../../flow/navigation/FlowTab"
import { TimersPanel } from "../timers/TimersPanel"

/** Props for the FlowPageSidebar component. */
interface FlowPageSidebarProps {
  /** Full list of flows to display as tabs. */
  flows: Flow[]
  /** Index of the currently selected flow. */
  selected: number
  /** All rounds available for the current session. */
  rounds: Round[]
  /** The currently active flow, or null if none is selected. */
  currentFlow: Flow | null
  /** Whether split mode is currently active. */
  splitMode: boolean
  /** Whether the sidebar is being rendered on a mobile device. */
  isMobile: boolean
  /** Handler called when the user selects a flow tab. */
  onSelectFlow: (index: number) => void
  /** Handler called when the user adds a new flow. */
  onAddFlow: () => void
  /** Handler called when the user renames a flow. */
  onRenameFlow: (index: number, newName: string) => void
  /** Handler called when the user archives a flow. */
  onArchiveFlow: (index: number) => void
  /** Handler called when the user deletes a flow. */
  onDeleteFlow: (index: number) => void
  /** Handler called when the user toggles split mode. */
  onToggleSplitMode: () => void
  /** Handler called when the user opens the flow history dialog. */
  onOpenHistory: () => void
  /** Handler called when the user opens the round editor for a given round. */
  onEditRound: (roundId: number) => void
  /** Optional handler called when the mobile menu overlay should be dismissed. */
  onCloseMobileMenu?: () => void
}

/**
 * Sidebar panel containing quick action buttons, a scrollable list of flow tabs, and a timers section.
 *
 * @param props - Component props.
 * @param props.flows - Array of all flows; sorted internally (active first, then archived).
 * @param props.selected - Index of the currently active flow, used to highlight the matching tab.
 * @param props.currentFlow - Active flow; used to determine whether Edit Round is available.
 * @param props.splitMode - Controls the icon shown on the split-mode toggle button.
 * @param props.isMobile - When true, selecting a flow also closes the mobile menu overlay.
 * @param props.onSelectFlow - Callback invoked with the flow index when a tab is clicked.
 * @param props.onAddFlow - Callback invoked when the Add Flow button is clicked.
 * @param props.onRenameFlow - Callback invoked with the flow index and new name when a tab is renamed.
 * @param props.onArchiveFlow - Callback invoked with the flow index when a tab is archived.
 * @param props.onDeleteFlow - Callback invoked with the flow index when a tab is deleted.
 * @param props.onToggleSplitMode - Callback invoked when the split-mode toggle button is clicked.
 * @param props.onOpenHistory - Callback invoked when the Flow History button is clicked.
 * @param props.onEditRound - Callback invoked with the round ID when the Edit Round button is clicked.
 * @param props.onCloseMobileMenu - Optional callback to close the mobile menu after a flow is selected.
 * @returns A sidebar with quick actions, flow tabs, and the timers panel.
 */
export function FlowPageSidebar({
  flows,
  selected,
  currentFlow,
  splitMode,
  isMobile,
  onSelectFlow,
  onAddFlow,
  onRenameFlow,
  onArchiveFlow,
  onDeleteFlow,
  onToggleSplitMode,
  onOpenHistory,
  onEditRound,
  onCloseMobileMenu,
}: FlowPageSidebarProps) {
  // Sort flows: active first, then archived by most recent
  const sortedFlows = [...flows].sort((a, b) => {
    if (a.archived && !b.archived) return 1
    if (!a.archived && b.archived) return -1
    if (a.archived && b.archived) return b.id - a.id
    return a.index - b.index
  })

  const handleSelectFlow = (index: number) => {
    onSelectFlow(index)
    if (isMobile && onCloseMobileMenu) {
      onCloseMobileMenu()
    }
  }

  return (
    <div className="bg-[var(--background)] w-full h-full md:h-[var(--main-height)] rounded-[var(--border-radius)] p-[var(--padding)] flex flex-col box-border">
      {/* Quick action buttons */}
      <div className="h-auto pb-[var(--padding)] grid grid-cols-4 gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onToggleSplitMode} size="icon" variant="ghost" className="h-7 w-7">
                {splitMode ? <X className="h-4 w-4" /> : <Columns2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{splitMode ? "Exit Split Mode" : "Split Mode"}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onAddFlow} size="icon" variant="ghost" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add Flow</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenHistory}>
                <Clock className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Flow History</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => currentFlow?.roundId && onEditRound(currentFlow.roundId)}
                disabled={!currentFlow || !currentFlow.roundId}
              >
                <Users className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit Round</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Flow tabs list */}
      <div className="overflow-y-auto flex-grow box-border">
        <div className="p-0 m-0">
          {sortedFlows.map((flow) => (
            <FlowTab
              key={flow.id}
              flow={flow}
              selected={flow.index === selected}
              onClick={() => handleSelectFlow(flow.index)}
              onRename={(newName) => onRenameFlow(flow.index, newName)}
              onArchive={() => onArchiveFlow(flow.index)}
              onDelete={() => onDeleteFlow(flow.index)}
            />
          ))}
        </div>
      </div>

      {/* Timers section */}
      <div className="mt-auto pt-[var(--padding)]">
        <TimersPanel />
      </div>
    </div>
  )
}
