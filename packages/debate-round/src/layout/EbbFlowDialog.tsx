/**
 * @fileoverview Overlay that brings up ebb - the standalone local-first flow
 * editor, ported in as the `debate-flow-ebb` package - from inside the live
 * round editor.
 * @module components/debate/flow/layout/EbbFlowDialog
 */
"use client"

import { useEffect, useRef } from "react"

import { EbbFlowEmbed } from "debate-flow-ebb"

interface EbbFlowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * ebb is its own substantial workspace (a grid, a toolbar, its own document
 * tree, and a full set of dialogs of its own - Settings, New flow, Join,
 * Share) - not something that fits a sidebar's few inches, and not
 * something a debater wants docked and taking up screen space between
 * rounds. A large overlay is the middle ground "bring it up when needed"
 * asks for: reachable in one click from the sidebar, sized as one contained
 * column rather than edge-to-edge, and gone again on close rather than
 * permanently claiming a slice of the layout.
 *
 * A plain overlay rather than `debate-ui`'s Radix-based Dialog on purpose:
 * ebb's own dialogs (New flow, Settings, Join, ...) are Base UI, a second,
 * independent modal library. Base UI tracks its own dialog above the page's
 * background it dims; nested inside a Radix Dialog it doesn't recognize as
 * a sibling, that tracking gets confused and Base UI's own popup stops
 * accepting pointer events - New flow's event picker becomes unclickable.
 * Wrapping ebb in a second real dialog buys nothing (ebb already dims and
 * frames itself for every dialog it opens); a bare backdrop leaves ebb's own
 * modal system as the only one in play.
 */
export function EbbFlowDialog({ open, onOpenChange }: EbbFlowDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ebb flow editor"
        className="bg-background relative flex h-[90vh] w-[95vw] max-w-6xl flex-col overflow-hidden rounded-lg border shadow-lg"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-2 right-2 z-10 rounded-md p-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <EbbFlowEmbed className="min-h-0" />
      </div>
    </div>
  )
}
