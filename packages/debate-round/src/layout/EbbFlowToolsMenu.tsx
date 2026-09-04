"use client"

/**
 * @fileoverview "ebb Flow tools" quick-access menu.
 *
 * ebb (the pinned "ebb Flow" tab) used to hold New flow / Open / Join with a
 * code / Settings / a recent-flows list on its own full-screen start screen,
 * shown only once that tab was selected with no flow open — see
 * `debate-flow-ebb`'s `ResumeFlow.tsx`, which replaced that screen with a
 * lightweight auto-resume (it reopens the last flow, or starts a fresh one,
 * with only a minimal empty state on failure). That left those entry points
 * reachable only from ebb's own toolbar (`RoundHeader`), which meant only
 * once the ebb tab was already active. This menu surfaces the same entry
 * points from the round workspace's quick-action row instead
 * (`layout/FlowPageSidebar.tsx`, alongside `FlowToolsMenu`), so they're one
 * click away regardless of which tab is selected.
 *
 * Every action first switches to the pinned ebb tab (`onSelectEbb`), then
 * fires the matching ebb action from `debate-flow-ebb/quick-actions` — safe
 * to call immediately after, per that module's own header comment: the
 * dialogs it drives are gated by plain Zustand stores that exist
 * independent of whether `EbbFlowEmbed` has mounted yet.
 *
 * @module layout/EbbFlowToolsMenu
 */

import { useState } from "react"
import { FilePlus, FolderOpen, History, LogIn, Settings, Workflow } from "lucide-react"
import { Button } from "debate-ui/src/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "debate-ui/src/primitives/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "debate-ui/src/primitives/tooltip"
import {
  executeCommand,
  isDesktop,
  navigateToFlow,
  openFlowFromPicker,
  useFlowStore,
  useRecentFlows,
} from "debate-flow-ebb/quick-actions"

/** Props for the EbbFlowToolsMenu component. */
interface EbbFlowToolsMenuProps {
  /** Switches the round workspace to the pinned ebb Flow tab. */
  onSelectEbb: () => void
}

/**
 * Icon-button dropdown offering ebb's New flow / Open / Join with a code /
 * Settings actions plus a recent-flows submenu, from outside the ebb tab.
 *
 * @param props.onSelectEbb - See {@link EbbFlowToolsMenuProps.onSelectEbb}.
 */
export function EbbFlowToolsMenu({ onSelectEbb }: EbbFlowToolsMenuProps) {
  // Recent flows are read from disk, so only fetch them once the menu is
  // actually opened rather than on every render of the quick-action row.
  const [wantsRecents, setWantsRecents] = useState(false)
  const { entries } = useRecentFlows(wantsRecents)

  const handleNewFlow = () => {
    onSelectEbb()
    useFlowStore.getState().setNewFlowOpen(true)
  }

  const handleOpenFlow = () => {
    onSelectEbb()
    void openFlowFromPicker()
  }

  const handleJoin = () => {
    onSelectEbb()
    executeCommand("collab.join")
  }

  const handleSettings = () => {
    onSelectEbb()
    useFlowStore.getState().setSettingsOpen(true)
  }

  const handleOpenRecent = (path: string) => {
    onSelectEbb()
    navigateToFlow(path)
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && setWantsRecents(true)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Workflow className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>ebb Flow tools</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>ebb Flow tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleNewFlow}>
          <FilePlus className="mr-2 h-4 w-4" />
          New flow
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleOpenFlow}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open a flow
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <History className="mr-2 h-4 w-4" />
            Recent flows
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {!entries || entries.length === 0 ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                {entries === null ? "Loading…" : "No other flows yet."}
              </div>
            ) : (
              entries.map((entry) => (
                <DropdownMenuItem key={entry.path} onSelect={() => handleOpenRecent(entry.path)}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{entry.label}</span>
                    <span className="text-muted-foreground truncate text-xs">{entry.display}</span>
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {isDesktop() && (
          <DropdownMenuItem onSelect={handleJoin}>
            <LogIn className="mr-2 h-4 w-4" />
            Join with a code
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
