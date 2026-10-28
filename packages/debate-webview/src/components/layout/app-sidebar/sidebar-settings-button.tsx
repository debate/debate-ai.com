"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings } from "lucide-react"

import { settingsHrefForPath } from "../../../lib/qwksearch/settings-paths"
import { cn } from "@debate-ai/ui/lib/utils"

/**
 * Settings as an icon button in the sidebar's foot row, right beside the
 * hide-sidebar button (`SidebarAccount` is the row's left part, and this is
 * its last item), on every view, signed in or out. It opens the tab that fits
 * the current page (`settingsHrefForPath`). With `label` it spells the word
 * out, for the phone drawer, which has no foot row. Docs is not pinned beside
 * it: every docs page is a collapsed "Docs" section at the end of the tree
 * (`DocsNavTree` in @debate-ai/videos).
 */
export function SidebarSettingsButton({ label = false, className }: { label?: boolean; className?: string }) {
  const pathname = usePathname()

  return (
    <Link
      href={settingsHrefForPath(pathname)}
      prefetch={false}
      aria-label={label ? undefined : "Settings"}
      title="Settings"
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0",
        label ? "px-2 text-xs font-medium" : "w-8",
        className,
      )}
    >
      <Settings aria-hidden />
      {label && "Settings"}
    </Link>
  )
}
