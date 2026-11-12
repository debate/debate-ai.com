/**
 * @fileoverview "Sidebar sections" menu in the round sidebar's quick-action
 * row: a checkbox per section (speeches, circular timer, cameras, shared
 * headings, open tabs) to show or hide it, plus a toggle to auto-record the
 * screen during a speech. Screen recording captures exactly one window the
 * user chooses (not the whole screen) and saves a clip for each speech.
 *
 * @module layout/SidebarSectionsMenu
 */

"use client"

import { PanelLeft, Monitor, Square } from "lucide-react"
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
import { useScreenRecorder } from "../webcam/useScreenRecorder"

interface SidebarSectionsMenuProps {
  sections: SidebarSectionVisibility
  onChange: (id: SidebarSectionId, shown: boolean) => void
  onReset: () => void
  /** Name of the speech the sidebar is showing, used to key screen clips. */
  currentSpeechName: string
}

export function SidebarSectionsMenu({
  sections,
  onChange,
  onReset,
  currentSpeechName,
}: SidebarSectionsMenuProps) {
  const hidden = SIDEBAR_SECTIONS.filter((s) => !sections[s.id]).length
  const { recordScreen, setRecordScreen, isScreenRecording, awaitingSelection, selectWindow } =
    useScreenRecorder(currentSpeechName)

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
              {recordScreen && (
                <span className="absolute -right-0.5 -bottom-0.5 flex h-2 w-2 items-center justify-center">
                  <Square className="h-2 w-2 fill-red-600 dark:fill-red-400" aria-hidden />
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
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={recordScreen}
          onCheckedChange={(checked) => {
            setRecordScreen(checked)
            if (checked) void selectWindow()
          }}
          onSelect={(event) => event.preventDefault()}
          className={recordScreen ? "text-red-600 dark:text-red-400" : undefined}
        >
          <Monitor className="h-4 w-4 mr-2 shrink-0" />
          <span className="flex-1 flex flex-col">
            <span>Record screen during speech</span>
            <span className="text-xs text-muted-foreground">
              {isScreenRecording ? "Capturing chosen window live" : "One window only, per speech"}
            </span>
          </span>
          {recordScreen && <Square className="h-3 w-3 fill-red-600 dark:fill-red-400 ml-2" />}
        </DropdownMenuCheckboxItem>
        {awaitingSelection && (
          <DropdownMenuItem onSelect={selectWindow} onClick={(event) => event.preventDefault()}>
            <Monitor className="h-4 w-4 mr-2" />
            <span className="flex-1">Select window to record</span>
          </DropdownMenuItem>
        )}
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
