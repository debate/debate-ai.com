"use client";

import { Question } from "@phosphor-icons/react";

import { Button } from "../ui/button";
import { Tip } from "../ui/tooltip";
import { sideLabels } from "../../lib/format/events";
import { teamCode } from "../../lib/model/teamCode";
import { useFlowStore } from "../../lib/store/useFlowStore";

import ExportMenu from "./ExportMenu";
import SaveStatus from "./SaveStatus";
import SpeechSwitcher from "./SpeechSwitcher";
import ZoomControl from "./ZoomControl";

export default function RoundHeader() {
    const scouting = useFlowStore((s) => s.round?.scouting);
    const sides = sideLabels(useFlowStore((s) => s.round?.event));

    if (!scouting) return null;

    const affCode =
        teamCode(scouting.affSchool ?? "", scouting.aff.first, scouting.aff.second) ||
        sides.aff.label;
    const negCode =
        teamCode(scouting.negSchool ?? "", scouting.neg.first, scouting.neg.second) ||
        sides.neg.label;
    const participants = `${affCode} vs ${negCode}`;

    return (
        <header
            className="border-border bg-card ribbon:gap-4 ribbon:px-4 flex h-12 flex-none items-center gap-2 border-b px-3"
            data-testid="round-header"
        >
            <div className="ribbon:gap-3 flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <span className="text-foreground truncate text-sm font-semibold">
                    {participants}
                </span>
                <SaveStatus />
            </div>

            <div className="no-print ribbon:gap-2 flex flex-none items-center gap-1">
                <SpeechSwitcher />
                <ZoomControl />
                <Tip label="Round info" command="info.open">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => useFlowStore.getState().setInfoOpen(true)}
                        aria-label="Round info"
                        data-testid="info-btn"
                    >
                        Info
                    </Button>
                </Tip>
                <Tip label="RFD" command="rfd.toggle">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const s = useFlowStore.getState();
                            s.setRfdOpen(!s.rfdOpen);
                        }}
                        aria-label="RFD"
                        data-testid="rfd-btn"
                    >
                        RFD
                    </Button>
                </Tip>
                <Tip label="Keyboard shortcuts" command="help.open">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => useFlowStore.getState().setCheatsheetOpen(true)}
                        aria-label="Keyboard shortcuts"
                        data-testid="guide-btn"
                    >
                        <Question className="size-4.5" />
                    </Button>
                </Tip>
                <ExportMenu />
            </div>
        </header>
    );
}
