/**
 * @fileoverview "ebb Flow tools" quick-access menu — New flow / Open a flow /
 * Join with a code / Settings, plus a list of recent flows, for ebb's pinned
 * "ebb Flow" tab. These used to be ebb's own full-screen start screen, shown
 * only once that tab was selected with no flow open. Rendered here instead,
 * in `layout/FlowPageSidebar.tsx`'s quick-action row alongside `FlowToolsMenu`,
 * so they're reachable in one click regardless of which tab is active —
 * choosing one switches to the ebb tab (mounting `EbbFlowEmbed` if it isn't
 * already) and queues the action for it to run once mounted.
 *
 * Uses the host's own `debate-ui` components rather than ebb's UI kit: ebb's
 * kit is styled for `.ebb-scope` (see `EbbFlowEmbed.tsx`'s docstring) and
 * would render unstyled out here in the sidebar.
 *
 * @module layout/EbbFlowToolsMenu
 */

import { FilePlus, FolderOpen, LogIn, Settings, Workflow } from "lucide-react"
import { Button } from "debate-ui/src/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "debate-ui/src/primitives/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "debate-ui/src/primitives/tooltip"
import { isDesktop, useRecentFlows } from "debate-flow-ebb/tools"
import type { EbbFlowToolAction } from "debate-flow-ebb"

/** Props for the EbbFlowToolsMenu component. */
interface EbbFlowToolsMenuProps {
  /** Switches to the ebb tab and queues `action` for it to run once mounted. */
  onAction: (action: EbbFlowToolAction) => void
}

/**
 * Icon-button dropdown covering everything ebb's retired start screen
 * offered (New flow, Open a flow, Join with a code, Settings, recent flows),
 * reachable whether or not the pinned ebb tab is currently selected.
 *
 * @param props.onAction - See {@link EbbFlowToolsMenuProps.onAction}.
 */
export function EbbFlowToolsMenu({ onAction }: EbbFlowToolsMenuProps) {
  const { entries, refresh } = useRecentFlows()

  return (
    <DropdownMenu onOpenChange={(open) => open && refresh()}>
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
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>ebb Flow tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction({ type: "new" })}>
          <FilePlus className="mr-2 h-4 w-4" />
          New flow
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction({ type: "open" })}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open a flow
        </DropdownMenuItem>
        {isDesktop() && (
          <DropdownMenuItem onSelect={() => onAction({ type: "join" })}>
            <LogIn className="mr-2 h-4 w-4" />
            Join with a code
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onAction({ type: "settings" })}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Recent flows
        </DropdownMenuLabel>
        {!entries || entries.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">
            {entries === null ? "Loading…" : "No other flows yet."}
          </div>
        ) : (
          entries.map((entry) => (
            <DropdownMenuItem
              key={entry.path}
              onSelect={() => onAction({ type: "open-path", path: entry.path })}
            >
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-0.5">
                <span className="truncate text-sm">{entry.label}</span>
                <span className="text-muted-foreground truncate text-xs">{entry.display}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
