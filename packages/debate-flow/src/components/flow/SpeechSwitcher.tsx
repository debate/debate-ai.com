"use client";

import { CaretDown } from "@phosphor-icons/react";

import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tip } from "../ui/tooltip";
import { getEvent, speechOrder } from "../../lib/format/events";
import { useFlowStore } from "../../lib/store/useFlowStore";

export default function SpeechSwitcher() {
    const switchSpeech = useFlowStore((s) => s.switchSpeech);
    const event = useFlowStore((s) => s.round?.event);
    const firstSide = useFlowStore((s) => s.round?.firstSide);
    const hasRound = useFlowStore((s) => s.round != null);
    const cols = hasRound ? speechOrder(getEvent(event), firstSide ?? "aff") : [];

    return (
        <DropdownMenu>
            <Tip label="Jump to a speech across every sheet">
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        data-testid="speech-switcher-btn"
                        className="ribbon:inline-flex hidden"
                    >
                        Speech
                        <CaretDown className="size-4 opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end">
                {cols.map((col) => (
                    <DropdownMenuItem
                        key={col.id}
                        data-testid={`speech-${col.id}`}
                        onSelect={() => switchSpeech(col.id)}
                    >
                        {col.name}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
