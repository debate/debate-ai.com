"use client"

import { useEffect, useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { usePathname } from "next/navigation"
import { LibrarySidebarTree, ToolSidebarFooter } from "@debate-ai/videos"
import { playUISoundEffect } from "@debate-ai/timer"
import { SidebarSettingsButton } from "./app-sidebar/sidebar-settings-button"
import { ReasonDocsSidebarPanels } from "@debate-ai/reason-docs/docs/ReasonDocsSidebarPanels"
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

  // A sound confirms the drawer opening or closing. The first
  // run (mount) is skipped, so a drawer that starts closed
  // stays silent.
  const prevOpen = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevOpen.current === null) {
      prevOpen.current = open
      return
    }
    if (prevOpen.current !== open) {
      playUISoundEffect(open ? "popUpOn" : "popDown")
      prevOpen.current = open
    }
  }, [open])

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
            {kind === "editor" && <ReasonDocsSidebarPanels className="shrink-0" />}
            {/* The same tree as the desktop column: Videos (Lectures
                included) and the tool sections. Not beside the document
                panels, which are the whole sidebar there as on desktop;
                the bottom dock is the way back out. */}
            {kind !== "own" && kind !== "editor" && (
              <>
                <LibrarySidebarTree />
                <ToolSidebarFooter />
              </>
            )}
            {/* Settings on every view, as beside the desktop column's hide
                button. Docs is a section of the tree above. */}
            <div className="mt-2 flex shrink-0 justify-end border-t border-border/60 pt-2">
              <SidebarSettingsButton label />
            </div>
          </ChromeErrorBoundary>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
