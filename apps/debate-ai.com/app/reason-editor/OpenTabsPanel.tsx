"use client"

/**
 * "Open Tabs" sidebar panel — ported from quick search's REASON editor
 * sidebar (`packages/reason-editor-sidebar`'s `renderOpenTabs`), simplified
 * to this app's document model (files only, no chat tabs).
 */

import { FileText, X } from "lucide-react"
import { cn } from "debate-ui/src/lib/utils"
import type { ReasonDocument } from "./types"

interface OpenTabsPanelProps {
  documents: ReasonDocument[]
  openTabs: number[]
  activeId: number | null
  onSelect: (id: number) => void
  onClose: (id: number) => void
}

export function OpenTabsPanel({ documents, openTabs, activeId, onSelect, onClose }: OpenTabsPanelProps) {
  const byId = new Map(documents.map((d) => [d.id, d]))

  return (
    <div className="flex-1 overflow-auto py-1">
      {openTabs.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">No open tabs. Select a file to open it.</p>
      ) : (
        openTabs.map((id) => {
          const doc = byId.get(id)
          const title = doc?.title || "Untitled"
          const isActive = id === activeId
          return (
            <div
              key={id}
              className={cn(
                "group flex items-center gap-2 mx-1 px-2 py-1.5 rounded-md cursor-pointer text-sm truncate",
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
              onClick={() => onSelect(id)}
            >
              <FileText className="h-4 w-4 shrink-0 opacity-60" />
              <span className="flex-1 truncate">{title}</span>
              <button
                type="button"
                className="shrink-0 h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(id)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
