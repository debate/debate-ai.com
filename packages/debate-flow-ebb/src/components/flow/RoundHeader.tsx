"use client";

import { FilePlus, FolderOpen, Gear, Question, SignIn } from "@phosphor-icons/react";

import { Button } from "../ui/button";
import { Tip } from "../ui/tooltip";
import { executeCommand } from "../../lib/commands/commands";
import { openFlowFromPicker } from "../../lib/commands/fileCommands";
import { sideLabels } from "../../lib/format/events";
import { teamCode } from "../../lib/model/teamCode";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { isDesktop } from "../../lib/update/adapter";

import ExportMenu from "./ExportMenu";
import RecentFlowsMenu from "./RecentFlowsMenu";
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
                <Tip label="New flow">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => useFlowStore.getState().setNewFlowOpen(true)}
                        aria-label="New flow"
                        data-testid="new-flow-btn"
                    >
                        <FilePlus className="size-4.5" />
                    </Button>
                </Tip>
                <Tip label="Open a flow">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void openFlowFromPicker()}
                        aria-label="Open a flow"
                        data-testid="open-flow-btn"
                    >
                        <FolderOpen className="size-4.5" />
                    </Button>
                </Tip>
                <RecentFlowsMenu />
                {isDesktop() && (
                    <Tip label="Join with a code">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => executeCommand("collab.join")}
                            aria-label="Join with a code"
                            data-testid="join-code-btn"
                        >
                            <SignIn className="size-4.5" />
                        </Button>
                    </Tip>
                )}
                <span aria-hidden="true" className="bg-border h-4 w-px flex-none" />
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
                <Tip label="Settings" command="settings.open">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => useFlowStore.getState().setSettingsOpen(true)}
                        aria-label="Settings"
                        data-testid="settings-btn"
                    >
                        <Gear className="size-4.5 rotate-[22.5deg]" />
                    </Button>
                </Tip>
                <ExportMenu />
            </div>
        </header>
    );
}
