"use client"

import Link from "next/link"
import { Scale } from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../../lib/ui/primitives/sidebar"
import { APP_NAME } from "../../../lib/config/site"

/**
 * sidebar-07's `TeamSwitcher` slot. There are no workspaces to switch
 * between, so it is the site's name linking home, drawn in the same
 * `size="lg"` row so the header keeps the block's shape — and its square
 * icon is what stays visible when the sidebar collapses to icons.
 */
export function SidebarBrand() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild tooltip={APP_NAME}>
          <Link href="/">
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Scale className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{APP_NAME}</span>
              <span className="truncate text-xs text-muted-foreground">Research · Practice · Compete</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
