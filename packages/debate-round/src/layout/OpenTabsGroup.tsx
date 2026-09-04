/**
 * @fileoverview Collapsible sidebar group listing every open tab: the
 * pinned ebb Flow editor plus every database-backed flow.
 */

"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Plus, Workflow } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { cn } from "../ui/lib/utils"
import { FlowTab } from "../navigation/FlowTab"
import type { Flow } from "../types/flow"

interface OpenTabsGroupProps {
  flows: Flow[]
  selected: number
  onSelectFlow: (index: number) => void
  onAddFlow: () => void
  onRenameFlow: (index: number, newName: string) => void
  onArchiveFlow: (index: number) => void
  onDeleteFlow: (index: number) => void
  ebbActive: boolean
  onSelectEbb: () => void
}

export function OpenTabsGroup({
  flows,
  selected,
  onSelectFlow,
  onAddFlow,
  onRenameFlow,
  onArchiveFlow,
  onDeleteFlow,
  ebbActive,
  onSelectEbb,
}: OpenTabsGroupProps) {
  const [open, setOpen] = useState(true)

  /**
   * Sort flows for rendering:
   * - active flows first
   * - archived flows last, newest archive first
   * - active flows in their configured index order
   */
  const sortedFlows = [...flows].sort((a, b) => {
    if (a.archived && !b.archived) return 1
    if (!a.archived && b.archived) return -1
    if (a.archived && b.archived) return b.id - a.id
    return a.index - b.index
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full shrink-0 items-center gap-1.5 rounded-[var(--border-radius)] p-[var(--padding)] text-left hover:bg-[var(--background-indent)]"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span className="flex-1 truncate text-sm font-bold">Open Tabs</span>
      </button>

      {open && (
        <div className="min-h-0 flex-1 overflow-y-auto pl-2">
          <div className="p-0 m-0">
            {/* ebb Flow is a separate local-first editor, not a database-backed
                Flow record, so it gets a pinned entry above the real flow tabs
                rather than a fake Flow object slotted into the list — it has
                no rename/archive/delete, only select. */}
            <div
              onClick={onSelectEbb}
              className={cn(
                "w-full text-left p-[var(--padding)] rounded-[var(--border-radius)]",
                "transition-colors duration-[var(--transition-speed)]",
                "hover:bg-[var(--background-indent)]",
                "flex items-center gap-1.5 cursor-pointer",
                ebbActive && "bg-[var(--background-active)] font-bold",
              )}
            >
              <Workflow className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="flex-1 truncate">ebb Flow</span>
            </div>
            {sortedFlows.map((flow) => (
              <FlowTab
                key={flow.id}
                flow={flow}
                selected={!ebbActive && flow.index === selected}
                onClick={() => onSelectFlow(flow.index)}
                onRename={(newName) => onRenameFlow(flow.index, newName)}
                onArchive={() => onArchiveFlow(flow.index)}
                onDelete={() => onDeleteFlow(flow.index)}
              />
            ))}
          </div>
          <div className="flex justify-center ">
            <Button
              onClick={onAddFlow}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground flex items-center "
            >
              <Plus className="h-4 w-4" />
              <span>Add Flow</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
