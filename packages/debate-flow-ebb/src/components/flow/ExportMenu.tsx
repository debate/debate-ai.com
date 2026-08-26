"use client";

import { CaretDown, Export } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tip } from "../ui/tooltip";
import { errorMessage } from "../../lib/errorMessage";
import { downloadXlsx } from "../../lib/export/xlsx";
import type { FlowRound } from "../../lib/model/flow";
import { useFlowStore } from "../../lib/store/useFlowStore";

export default function ExportMenu() {
    async function run(fn: (round: FlowRound) => unknown | Promise<unknown>) {
        const round = useFlowStore.getState().round;
        if (!round) return;
        try {
            await fn(round);
        } catch (err) {
            toast.error(`Export failed: ${errorMessage(err, "unknown error")}`);
        }
    }

    return (
        <DropdownMenu>
            <Tip label="Export round">
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        aria-label="Export"
                        data-testid="export-btn"
                    >
                        <Export className="size-4" />
                        <span className="ribbon:inline hidden">Export</span>
                        <CaretDown className="ribbon:block hidden size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end">
                {/* No JSON entry: a .ebb file already is the round's JSON, and
                    Save As writes one wherever the user wants it. */}
                <DropdownMenuItem
                    data-testid="export-excel"
                    onSelect={() => run((r) => downloadXlsx(r, useFlowStore.getState().contacts))}
                >
                    Excel
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
