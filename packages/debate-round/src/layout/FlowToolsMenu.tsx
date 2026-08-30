/**
 * @fileoverview "Tools for this round" quick-access menu — TODO.md idea #17
 * follow-up (4)'s first concrete slice (see `round/flow-tool-links.ts`'s
 * header comment for the full rationale). Rendered in
 * `layout/FlowPageSidebar.tsx`'s quick-action row alongside the existing
 * split-mode/history/round buttons, so a debater actively flowing a round
 * can jump straight to a flow-driven analysis tool without first finding it
 * in the separate `/tools` grid.
 *
 * @module layout/FlowToolsMenu
 */

import Link from "next/link"
import { Wrench } from "lucide-react"
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
import type { Flow } from "debate-core/src/types/flow"
import { buildFlowToolsMenuItems } from "../round/flow-tool-links"

/** Props for the FlowToolsMenu component. */
interface FlowToolsMenuProps {
  /** The round workspace's currently selected flow, or null if none is selected. */
  currentFlow: Flow | null
}

/**
 * Icon-button dropdown listing the flow-driven analysis tools (Argument
 * Tree Outline, AI Response-Outcome Charts, Practice Drills, AI Coach
 * Mode) that act on the round workspace's currently selected flow. Every
 * item is disabled — but still visible, so the tool stays discoverable —
 * until a flow is selected.
 *
 * @param props.currentFlow - See {@link FlowToolsMenuProps.currentFlow}.
 */
export function FlowToolsMenu({ currentFlow }: FlowToolsMenuProps) {
  const items = buildFlowToolsMenuItems(currentFlow)

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Wrench className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Tools for this round</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Tools for this round</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.href} disabled={item.disabled} asChild={!item.disabled}>
            {item.disabled ? (
              <div className="flex flex-col items-start gap-0.5 py-1">
                <span className="text-sm">{item.label}</span>
                <span className="text-xs text-muted-foreground">Select a flow first</span>
              </div>
            ) : (
              <Link href={item.href} className="flex flex-col items-start gap-0.5 py-1">
                <span className="text-sm">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </Link>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
