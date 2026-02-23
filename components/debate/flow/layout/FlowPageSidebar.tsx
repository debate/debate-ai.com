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

interface FlowPageSidebarProps {
  /** Array of flows */
  flows: Flow[]
  /** Selected flow index */
  selected: number
  /** Array of rounds */
  rounds: Round[]
  /** Current active flow */
  currentFlow: Flow | null
  /** Whether split mode is active */
  splitMode: boolean
  /** Whether on mobile device */
  isMobile: boolean
  /** Handler to select a flow */
  onSelectFlow: (index: number) => void
  /** Handler to add new flow */
  onAddFlow: () => void
  /** Handler to rename flow */
  onRenameFlow: (index: number, newName: string) => void
  /** Handler to archive flow */
  onArchiveFlow: (index: number) => void
  /** Handler to delete flow */
  onDeleteFlow: (index: number) => void
  /** Handler to toggle split mode */
  onToggleSplitMode: () => void
  /** Handler to open history dialog */
  onOpenHistory: () => void
  /** Handler to edit round */
  onEditRound: (roundId: number) => void
  /** Handler to close mobile menu */
  onCloseMobileMenu?: () => void
}

/**
 * Sidebar with flow navigation, quick actions, and timers
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
