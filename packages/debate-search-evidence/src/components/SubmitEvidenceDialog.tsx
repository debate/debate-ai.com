/**
 * @fileoverview "Submit card" button for the cards search page, opening the
 * Shared Evidence Library's submission form and page check in a popup.
 */

"use client"

import { Suspense, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { FilePlus2, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { EvidenceLibraryPanel } from "../panels/EvidenceLibraryPanel"

/**
 * An icon button that opens a modal with the evidence submission form — card
 * or block, topic, case area, citation, source URL, tags and text — plus the
 * "Check this page" lookup. Closes on Escape or a click on the backdrop.
 */
export function SubmitEvidenceDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Submit a card or block"
        title="Submit a card or block"
      >
        <FilePlus2 className="h-4 w-4" />
      </Button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-evidence-title"
              className="relative w-full max-w-2xl rounded-xl border bg-background p-4 shadow-xl sm:p-6"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h2 id="submit-evidence-title" className="text-lg font-semibold">
                    Evidence Library
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Search shared cut cards and reusable analytic blocks by keyword, citation, or argument.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Suspense>
                <EvidenceLibraryPanel submitOnly />
              </Suspense>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
