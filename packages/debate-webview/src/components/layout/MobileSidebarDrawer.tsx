"use client"

import { useEffect } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { usePathname } from "next/navigation"
import { QuickLinksGrid, ToolNavTree, ToolSidebarFooter } from "@debate/videos"
import { ReasonDocsSidebarPanels } from "../reason-docs/ReasonDocsSidebarPanels"
import { ChromeErrorBoundary } from "../../lib/ui/layout/chrome-error-boundary"
import { mobileSidebarKind } from "../../lib/mobile-sidebar"

/**
 * The sidebar a phone gets from the dock's first button: a left drawer whose
 * content follows the view in the centre (`mobileSidebarKind`). It reuses the
 * desktop sidebar's own pieces rather than restating them, so a link added to
 * the tree shows up here too. Closes when the route changes.
 */
export function MobileSidebarDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const kind = mobileSidebarKind(pathname)

  useEffect(() => {
    onOpenChange(false)
    // Only a navigation closes the drawer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-[61] flex w-[85vw] max-w-sm flex-col overflow-y-auto bg-background p-3 pb-24 shadow-lg md:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
        >
          <DialogPrimitive.Title className="sr-only">Sidebar</DialogPrimitive.Title>
          <ChromeErrorBoundary label="MobileSidebarDrawer">
            {(kind === "cards" || kind === "editor") && (
              <ReasonDocsSidebarPanels
                className={kind === "cards" ? "min-h-0 flex-1" : "shrink-0"}
                fill={kind === "cards"}
              />
            )}
            {kind === "videos" && (
              <div className="mb-3">
                <QuickLinksGrid layout="list" />
              </div>
            )}
            {kind !== "cards" && kind !== "own" && (
              <>
                <ToolNavTree defaultExpanded={kind === "tools"} />
                <ToolSidebarFooter />
              </>
            )}
          </ChromeErrorBoundary>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
