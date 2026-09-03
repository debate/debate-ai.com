/**
 * @fileoverview "ebb Flow" quick-access menu — New flow / Open / Join with a
 * code / Settings and the recent-flows list, the entry points that used to
 * live on ebb's own full-screen start screen (shown only once the pinned
 * ebb tab was selected and no flow was open). Moved here, into the round
 * toolbar's quick-action row, so they're reachable in one click regardless
 * of which tab is active, and so an otherwise-empty ebb panel isn't the
 * only way to reach them.
 *
 * Every action also switches to the pinned ebb tab (`onSelectEbb`) so the
 * flow it opens, or the dialog it raises, is immediately visible — ebb's
 * own dialogs (New flow, Settings, Join) mount only inside the embed.
 *
 * @module layout/EbbToolsMenu
 */

import { useState } from "react"
import { Workflow } from "lucide-react"
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
import {
  isDesktop,
  joinEbbWithCode,
  openEbbFlowPath,
  openEbbFlowPicker,
  openEbbSettings,
  openNewEbbFlow,
  relativeTime,
  useRecentFlows,
} from "debate-flow-ebb/quick-actions"

/** Props for the EbbToolsMenu component. */
interface EbbToolsMenuProps {
  /** Switches the round workspace to the pinned ebb Flow tab. */
  onSelectEbb: () => void
}

/**
 * Icon-button dropdown offering ebb's start-screen actions (new/open/join/
 * settings) plus its recent-flows list, without requiring the ebb panel to
 * already be open and empty.
 *
 * @param props.onSelectEbb - See {@link EbbToolsMenuProps.onSelectEbb}.
 */
export function EbbToolsMenu({ onSelectEbb }: EbbToolsMenuProps) {
  const { entries, refresh } = useRecentFlows()
  const [open, setOpen] = useState(false)

  function runAndSwitch(action: () => void) {
    onSelectEbb()
    action()
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Recent flows can change on disk (renamed, edited, deleted) between
        // openings, so re-read them each time rather than only once ever.
        if (next) refresh()
      }}
    >
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
        <DropdownMenuLabel>ebb Flow</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => runAndSwitch(openNewEbbFlow)}>New flow</DropdownMenuItem>
        <DropdownMenuItem onClick={() => runAndSwitch(() => void openEbbFlowPicker())}>
          Open…
        </DropdownMenuItem>
        {isDesktop() && (
          <DropdownMenuItem onClick={() => runAndSwitch(joinEbbWithCode)}>
            Join with a code
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => runAndSwitch(openEbbSettings)}>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Recent flows</DropdownMenuLabel>
        {entries === null ? (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">No flows yet</div>
        ) : (
          entries.map((entry) => (
            <DropdownMenuItem
              key={entry.path}
              onClick={() => runAndSwitch(() => openEbbFlowPath(entry.path))}
              className="flex flex-col items-start gap-0.5 py-1"
            >
              <span className="flex w-full items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{entry.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {relativeTime(entry.updatedAt)}
                </span>
              </span>
              <span className="text-muted-foreground w-full truncate text-xs">{entry.display}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
