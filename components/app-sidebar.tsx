/**
 * @fileoverview Application navigation dock in the top-left corner.
 * Uses the same CategoryDock style on all pages.
 */

"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock"
import { cn } from "@/lib/utils"
import {
  IconCollectiveMind,
  IconRounds,
  IconRead,
  IconLectures,
} from "@/components/icons"

const NAV_ITEMS = [
  { href: "/cards", label: "Shared", icon: IconCollectiveMind },
  { href: "/debate", label: "Debate", icon: IconRounds },
  { href: "/edit", label: "Docs", icon: IconRead },
  { href: "/videos", label: "Videos", icon: IconLectures },
]

/**
 * Primary application navigation dock.
 * Renders a horizontal CategoryDock-style dock in the top-left corner on all pages.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <div className="fixed top-2 left-2 z-50">
      <Dock direction="middle" className="h-[52px] shrink-0">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link key={href} href={href}>
            <DockItem
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-full transition-colors",
                pathname === href
                  ? "bg-primary/20 ring-2 ring-primary"
                  : "bg-gray-200 dark:bg-neutral-800",
              )}
            >
              <DockLabel>{label}</DockLabel>
              <DockIcon>
                <Image src={icon} alt={label} width={24} height={24} className="w-full h-full" />
              </DockIcon>
            </DockItem>
          </Link>
        ))}
      </Dock>
    </div>
  )
}
