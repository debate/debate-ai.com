/**
 * @fileoverview "Submit card" button for the cards search page, opening the
 * Shared Evidence Library's submission form and page check in a popup.
 */

"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { FilePlus2, X } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { EvidenceLibraryPanel } from "../panels/EvidenceLibraryPanel"

/**
 * An icon button that opens a modal with the evidence submission form — card
 * or block, topic, case area, citation (with **Format citation**), source URL,
 * tags and text — plus the "Check this page" lookup. Closes on Escape, the
 * close button, or a click on the backdrop.
 *
 * Focus moves into the dialog when it opens, so keyboard and screen-reader
 * users land in the form rather than behind the backdrop, and returns to the
 * **Submit card** button when it closes.
 */
export function SubmitEvidenceDialog() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    const dialog = dialogRef.current
    const trigger = triggerRef.current
    dialog?.focus()
    return () => {
      window.removeEventListener("keydown", onKey)
      // Take focus back only when it was inside the dialog — or fell to <body>
      // as the dialog unmounted — never from somewhere the user moved it.
      const active = document.activeElement
      if (!active || active === document.body || dialog?.contains(active)) trigger?.focus()
    }
  }, [open])

  return (
    <>
      <Button
        ref={triggerRef}
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
              aria-describedby="submit-evidence-description"
              tabIndex={-1}
              ref={dialogRef}
              className="relative outline-none w-full max-w-2xl rounded-xl border bg-background p-4 shadow-xl sm:p-6"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h2 id="submit-evidence-title" className="text-lg font-semibold">
                    Submit to the Evidence Library
                  </h2>
                  <p id="submit-evidence-description" className="text-sm text-muted-foreground">
                    Share a cut card or a reusable analytic block with the team, or check whether a page is already in the
                    library.
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
