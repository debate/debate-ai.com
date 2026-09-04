"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Kbd } from "../ui/kbd";
import { COMMANDS, type CommandId } from "../../lib/commands/registry";
import { prettyChord, buildChordMap } from "../../lib/keymap/displayChord";
import { isMacPlatform } from "../../lib/platform";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { isDesktop } from "../../lib/update/adapter";

const GUIDE_URL = "https://ebb.smodi.net/docs";

/** Grid-native gestures owned by Handsontable; fixed, not rebindable. */
const FIXED_GROUPS: { label: string; rows: { chord: string; label: string }[] }[] = [
    {
        label: "Start screen (fixed)",
        rows: [
            { chord: "n", label: "New flow" },
            { chord: "o", label: "Open a flow" },
            { chord: "s", label: "Settings" },
            { chord: "1 - 6", label: "Open a recent flow" },
            { chord: "j / k", label: "Move the cursor" },
        ],
    },
    {
        label: "Editing (fixed)",
        rows: [
            { chord: "Enter", label: "Next row / commit edit" },
            { chord: "Alt+Enter", label: "New line in cell" },
            { chord: "Tab", label: "Commit and move right" },
            { chord: "Esc", label: "Cancel edit" },
            { chord: "F2", label: "Edit cell" },
            { chord: "Delete", label: "Clear cell" },
        ],
    },
    {
        label: "Navigate (fixed)",
        rows: [
            { chord: "Arrows", label: "Move selection" },
            {
                // Handsontable's jump-to-edge follows the platform primary modifier.
                chord: isMacPlatform() ? "Cmd+Arrows" : "Ctrl+Arrows",
                label: "Jump to data edge",
            },
        ],
    },
    {
        label: "Move mode (fixed)",
        rows: [
            { chord: "Up / Down", label: "Nudge cells one row" },
            {
                chord: isMacPlatform() ? "Cmd+Up / Down" : "Ctrl+Up / Down",
                label: "Nudge to next filled cell",
            },
            { chord: "Enter", label: "Commit move" },
            { chord: "Esc", label: "Cancel move" },
        ],
    },
];

const GROUPS: { label: string; rows: { commandId: CommandId }[] }[] = [
    {
        label: "Format",
        rows: [
            { commandId: "format.toggleBold" as CommandId },
            { commandId: "format.toggleHighlight" as CommandId },
            { commandId: "format.toggleCard" as CommandId },
            { commandId: "format.toggleGroup" as CommandId },
            { commandId: "format.toggleKicked" as CommandId },
        ],
    },
    {
        label: "Edit",
        rows: [
            { commandId: "edit.undo" as CommandId },
            { commandId: "edit.redo" as CommandId },
            { commandId: "cell.insert" as CommandId },
            { commandId: "cell.insertBelow" as CommandId },
            { commandId: "cell.move" as CommandId },
            { commandId: "row.insertAbove" as CommandId },
            { commandId: "row.delete" as CommandId },
        ],
    },
    {
        label: "Sheets",
        rows: [
            { commandId: "sheet.prev" as CommandId },
            { commandId: "sheet.next" as CommandId },
            { commandId: "sheet.moveUp" as CommandId },
            { commandId: "sheet.moveDown" as CommandId },
            { commandId: "sheet.extendUp" as CommandId },
            { commandId: "sheet.extendDown" as CommandId },
            { commandId: "sheet.quickSwitch" as CommandId },
            { commandId: "sheet.newAff" as CommandId },
            { commandId: "sheet.newNeg" as CommandId },
            { commandId: "sheet.rename" as CommandId },
            { commandId: "split.toggle" as CommandId },
            { commandId: "split.focusLeft" as CommandId },
            { commandId: "split.focusRight" as CommandId },
            { commandId: "sheet.jump1" as CommandId },
        ],
    },
    {
        label: "Window",
        rows: [
            { commandId: "window.new" as CommandId },
            { commandId: "window.close" as CommandId },
        ],
    },
    {
        label: "Flow files",
        rows: [
            { commandId: "flow.new" as CommandId },
            { commandId: "flow.save" as CommandId },
            { commandId: "flow.saveAs" as CommandId },
            { commandId: "flow.reveal" as CommandId },
            { commandId: "flow.close" as CommandId },
        ],
    },
    {
        label: "App",
        rows: [
            { commandId: "palette.open" as CommandId },
            { commandId: "settings.open" as CommandId },
            { commandId: "info.open" as CommandId },
            { commandId: "rfd.toggle" as CommandId },
            { commandId: "sidebar.toggle" as CommandId },
            { commandId: "help.open" as CommandId },
        ],
    },
];

/** Only reachable from the desktop app with the integration switched on. */
const CARDMIRROR_GROUP = {
    label: "CardMirror",
    rows: [
        { commandId: "cell.jumpToSource" as CommandId },
        { commandId: "cell.sendToDoc" as CommandId },
    ],
};

export default function KeybindingsCheatsheet() {
    const open = useFlowStore((s) => s.cheatsheetOpen);
    const setCheatsheetOpen = useFlowStore((s) => s.setCheatsheetOpen);
    // isDesktop() gates the bridge itself; the setting gates the user's choice.
    const cardmirrorOn = useFlowStore((s) => s.cardmirrorEnabled) && isDesktop();

    function close() {
        setCheatsheetOpen(false);
    }

    const chordFor = buildChordMap();
    const groups = cardmirrorOn ? [...GROUPS, CARDMIRROR_GROUP] : GROUPS;

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                if (!val) close();
            }}
        >
            <DialogContent
                className="flex max-h-[80vh] max-w-[480px] flex-col overflow-hidden p-0"
                data-testid="cheatsheet-panel"
                onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "?") {
                        e.preventDefault();
                        e.stopPropagation();
                        close();
                    }
                }}
            >
                <DialogHeader className="border-border shrink-0 border-b px-[18px] pt-[14px] pb-2.5">
                    <DialogTitle className="text-foreground text-sm font-semibold">
                        Keyboard shortcuts
                    </DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto">
                    <div
                        className="grid gap-4 px-[18px] py-3"
                        style={{ gridTemplateColumns: "1fr 1fr" }}
                    >
                        {FIXED_GROUPS.map((group) => (
                            <div key={group.label} className="flex flex-col gap-1">
                                <div className="text-muted-foreground mb-1 font-mono text-[9px] font-bold tracking-widest uppercase">
                                    {group.label}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {group.rows.map((row) => (
                                        <div key={row.label} className="flex items-center gap-2">
                                            <Kbd className="min-w-[26px] shrink-0 px-1.5 text-[12px]">
                                                {row.chord}
                                            </Kbd>
                                            <span className="text-foreground text-[12px]">
                                                {row.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {groups.map((group) => (
                            <div key={group.label} className="flex flex-col gap-1">
                                <div className="text-muted-foreground mb-1 font-mono text-[9px] font-bold tracking-widest uppercase">
                                    {group.label}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {group.rows.map((row) => {
                                        const { commandId } = row;
                                        const chord = chordFor[commandId];
                                        const isJumpAnchor = commandId === "sheet.jump1";
                                        if (!chord && !isJumpAnchor) return null;
                                        const displayChord = isJumpAnchor
                                            ? prettyChord(chord ?? "Meta+1").replace("1", "1-9")
                                            : prettyChord(chord!);
                                        const label = isJumpAnchor
                                            ? "Jump to sheet 1-9"
                                            : COMMANDS[commandId].label;

                                        return (
                                            <div
                                                key={commandId}
                                                className="flex items-center gap-2"
                                            >
                                                <Kbd className="min-w-[26px] shrink-0 px-1.5 text-[12px]">
                                                    {displayChord}
                                                </Kbd>
                                                <span className="text-foreground text-[12px]">
                                                    {label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border-border text-muted-foreground flex shrink-0 items-center justify-between gap-2 border-t px-[18px] py-2 text-[11px]">
                    <span>
                        Every action here also lives in the command palette. Press ? to close.
                    </span>
                    <a
                        href={GUIDE_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground shrink-0 underline underline-offset-2"
                        data-testid="cheatsheet-guide-link"
                    >
                        Documentation
                    </a>
                </div>
            </DialogContent>
        </Dialog>
    );
}
