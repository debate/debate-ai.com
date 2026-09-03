"use client";

import { ClockCounterClockwise } from "@phosphor-icons/react";

import { useRecentFlows } from "../start/useRecentFlows";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tip } from "../ui/tooltip";
import { navigateToFlow } from "../../lib/commands/flowNav";

/**
 * Recent flows, reachable from the toolbar. The one piece of ebb's retired
 * start screen without another way in once that screen is gone — everything
 * else it offered (New, Open, Settings) is its own toolbar button.
 */
export default function RecentFlowsMenu() {
    const { entries, refresh } = useRecentFlows();

    return (
        <DropdownMenu onOpenChange={(open) => open && refresh()}>
            <Tip label="Recent flows">
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Recent flows"
                        data-testid="recent-flows-btn"
                    >
                        <ClockCounterClockwise className="size-4.5" />
                    </Button>
                </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end" className="w-64">
                {!entries || entries.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-1.5 text-xs">
                        {entries === null ? "Loading…" : "No other flows yet."}
                    </div>
                ) : (
                    entries.map((entry) => (
                        <DropdownMenuItem
                            key={entry.path}
                            onSelect={() => navigateToFlow(entry.path)}
                            data-testid={`recent-flow-${entry.path}`}
                        >
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate">{entry.label}</span>
                                <span className="text-muted-foreground truncate text-xs">
                                    {entry.display}
                                </span>
                            </span>
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
