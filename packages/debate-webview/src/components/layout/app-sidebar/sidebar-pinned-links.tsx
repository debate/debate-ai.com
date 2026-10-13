"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleHelp, Settings } from "lucide-react"

import { settingsHrefForPath } from "../../../lib/qwksearch/settings-paths"
import { cn } from "../../../lib/ui/lib/utils"

const LINK =
  "flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0"

/**
 * Docs and Settings, always on screen at the foot of the sidebar, above the
 * account row — on every view, signed in or out, whatever is selected. Both
 * are also in the account menu, but a reader should not have to open a menu
 * to find them. `/docs` renders without the app shell, so it takes a full
 * page load (like `footer-links.ts`' `hardNavigate`); Settings opens the tab
 * that fits the current page (`settingsHrefForPath`).
 */
export function SidebarPinnedLinks({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Docs and settings" className={cn("flex items-center gap-1", className)}>
      <a href="/docs" className={LINK}>
        <CircleHelp />
        Docs
      </a>
      <Link href={settingsHrefForPath(pathname)} prefetch={false} className={LINK}>
        <Settings />
        Settings
      </Link>
    </nav>
  )
}
