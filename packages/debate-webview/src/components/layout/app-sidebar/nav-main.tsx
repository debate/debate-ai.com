"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { SIDEBAR_TOOL_SECTIONS, sidebarSectionForPath } from "@debate/videos"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../lib/ui/primitives/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "../../../lib/ui/primitives/sidebar"

/**
 * Team and school profiles are opened from the Team Rankings table rather
 * than nested under `/coaching/rankings`, so they count as "still on Team
 * Rankings" for highlighting — the same rule `ToolNavTree` applies.
 */
const TEAM_RANKINGS_HREF = "/coaching/rankings"
const TEAM_RANKINGS_PROFILE_PREFIXES = ["/teams", "/schools"]

/**
 * Exact match only, so one row lights up at a time: a prefix match would
 * light "Research Workspace" (`/research`) on every `/research/cards/*` page
 * alongside the row you are actually on.
 */
export function isToolActive(href: string, pathname: string | null): boolean {
  if (pathname == null) return false
  if (pathname === href) return true
  if (href !== TEAM_RANKINGS_HREF) return false
  return TEAM_RANKINGS_PROFILE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * The Research / Prep & Scout / Practice / Coaching / Insights tool sections
 * (`SIDEBAR_TOOL_SECTIONS`, from @debate/videos) in sidebar-07's collapsible
 * `NavMain` form.
 *
 * Every section starts expanded, and a navigation that lands in a section
 * you closed by hand opens it again; sections are never closed for you. Collapsed to icons, the section's icon
 * expands the sidebar and opens that section, since a submenu cannot show in
 * a 3rem column.
 */
export function NavMain({ sectionIds }: { sectionIds?: readonly string[] }) {
  const pathname = usePathname()
  const { state, setOpen } = useSidebar()
  const activeSectionId = sidebarSectionForPath(pathname)

  const sections = sectionIds
    ? SIDEBAR_TOOL_SECTIONS.filter((section) => sectionIds.includes(section.id))
    : SIDEBAR_TOOL_SECTIONS

  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(SIDEBAR_TOOL_SECTIONS.map((section) => section.id)),
  )

  useEffect(() => {
    if (!activeSectionId) return
    setOpenIds((prev) => (prev.has(activeSectionId) ? prev : new Set(prev).add(activeSectionId)))
  }, [activeSectionId])

  const setSectionOpen = (id: string, open: boolean) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tools</SidebarGroupLabel>
      <SidebarMenu>
        {sections.map((section) => {
          const sectionActive = section.id === activeSectionId
          return (
            <Collapsible
              key={section.id}
              asChild
              open={openIds.has(section.id)}
              onOpenChange={(open) => setSectionOpen(section.id, open)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={section.title}
                    // Collapsed, the section's rows have nowhere to open: widen
                    // the sidebar first, with the section showing.
                    onClick={(event) => {
                      if (state !== "collapsed") return
                      event.preventDefault()
                      setOpen(true)
                      setSectionOpen(section.id, true)
                    }}
                    // In icon mode this is the only hint of where you are.
                    isActive={state === "collapsed" && sectionActive}
                  >
                    <section.icon />
                    <span>{section.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {section.tools.map((tool) => (
                      <SidebarMenuSubItem key={tool.href}>
                        <SidebarMenuSubButton asChild isActive={isToolActive(tool.href, pathname)}>
                          <Link href={tool.href}>
                            <tool.icon />
                            <span>{tool.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
