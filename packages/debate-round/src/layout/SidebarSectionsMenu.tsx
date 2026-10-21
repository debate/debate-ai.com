/**
 * @fileoverview "Sidebar sections" menu in the round sidebar's quick-action
 * row: a checkbox per section (speeches, circular timer, cameras, shared
 * headings, open tabs) to show or hide it.
 *
 * @module layout/SidebarSectionsMenu
 */

import { PanelLeft } from "lucide-react"
import { Button } from "../ui/primitives/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/primitives/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/primitives/tooltip"
import { SIDEBAR_SECTIONS, type SidebarSectionId, type SidebarSectionVisibility } from "../utils/sidebar-sections"

interface SidebarSectionsMenuProps {
  sections: SidebarSectionVisibility
  onChange: (id: SidebarSectionId, shown: boolean) => void
  onReset: () => void
}

export function SidebarSectionsMenu({ sections, onChange, onReset }: SidebarSectionsMenuProps) {
  const hidden = SIDEBAR_SECTIONS.filter((s) => !sections[s.id]).length

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-7 w-7" aria-label="Sidebar sections">
              <PanelLeft className="h-4 w-4" />
              {hidden > 0 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-muted px-1 text-[9px] leading-tight">
                  {hidden}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sidebar sections</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Show in sidebar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SIDEBAR_SECTIONS.map((section) => (
          <DropdownMenuCheckboxItem
            key={section.id}
            checked={sections[section.id]}
            onCheckedChange={(checked) => onChange(section.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="flex flex-col">
              <span>{section.label}</span>
              <span className="text-xs text-muted-foreground">{section.description}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {hidden > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onReset}>Show all</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
