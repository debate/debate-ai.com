"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { APP_DOCK_LINKS } from "@debate/videos"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../../../lib/ui/primitives/sidebar"

/**
 * The app dock's five destinations as icon rows — sidebar-07's `NavProjects`
 * slot, turned inside out. Expanded, the column carries the dock itself
 * (`CategoryDock embedded`), so this group is hidden there rather than saying
 * everything twice; collapsed to icons, the dock does not fit in 3rem and is
 * hidden instead, and these keep the five apps one click away.
 */
export function NavApps() {
  const pathname = usePathname()

  return (
    <SidebarGroup className="hidden group-data-[collapsible=icon]:flex">
      <SidebarMenu>
        {APP_DOCK_LINKS.map((app) => (
          <SidebarMenuItem key={app.href}>
            <SidebarMenuButton
              asChild
              tooltip={app.title}
              isActive={pathname === app.href || (pathname?.startsWith(`${app.href}/`) ?? false)}
            >
              <Link href={app.href}>
                <app.icon />
                <span>{app.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
