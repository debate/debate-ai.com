/**
 * @fileoverview A "Flow chart" button for a written page (the docs
 * toolbar's last button), opening `PageFlowChartDialog` for that page.
 *
 * It renders a plain `<button>` (icon, then a label `<span>`) so a host
 * toolbar can style it like its other buttons. The modal — and D3 with it —
 * loads only when the button is first pressed.
 * @module components/watch/flow-chart/PageFlowChartButton
 */

"use client"

import { lazy, Suspense, useState } from "react"
import { Network } from "lucide-react"

const PageFlowChartDialog = lazy(() => import("./PageFlowChartDialog"))

export interface PageFlowChartButtonProps {
  /** A stable key for the page, e.g. its URL path. */
  pageKey: string
  title?: string
  /** Where the page's Markdown is served. */
  markdownUrl: string
  className?: string
}

export function PageFlowChartButton({ className, ...props }: PageFlowChartButtonProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
        onClick={() => {
          setLoaded(true)
          setOpen(true)
        }}
        title="Generate an AI flow chart (mind map) of this page's arguments"
      >
        <Network aria-hidden />
        <span>Flow chart</span>
      </button>
      {loaded && (
        <Suspense fallback={null}>
          <PageFlowChartDialog open={open} onOpenChange={setOpen} {...props} />
        </Suspense>
      )}
    </>
  )
}
