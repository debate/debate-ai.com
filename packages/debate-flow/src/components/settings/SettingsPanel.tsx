"use client";

import { X } from "@phosphor-icons/react";

import { Dialog, DialogClose, DialogContent, DialogTitle } from "../ui/dialog";
import { Tip } from "../ui/tooltip";
import { useSettingsShortcut } from "../../lib/keymap/useSettingsShortcut";
import { useFlowStore } from "../../lib/store/useFlowStore";

import SettingsPanelBody from "./SettingsPanelBody";

/**
 * Full-screen settings dialog, opened via the in-app "Settings" shortcut or
 * menu item. The actual settings UI lives in `SettingsPanelBody`, shared
 * with `EmbeddedSettingsPanel` (mounted inline, no dialog chrome, on the
 * app-wide `/settings` page).
 */
export default function SettingsPanel() {
    // The panel owns the chord that opens it, so it works on every screen.
    useSettingsShortcut();

    const open = useFlowStore((s) => s.settingsOpen);
    const setSettingsOpen = useFlowStore((s) => s.setSettingsOpen);

    function close() {
        setSettingsOpen(false);
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) close();
            }}
        >
            <DialogContent
                showCloseButton={false}
                data-testid="settings-panel"
                aria-label="Settings"
                className="inset-0 top-0 left-0 h-full max-h-full w-full max-w-full translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-full"
            >
                <DialogTitle className="sr-only">Settings</DialogTitle>

                {/* Header */}
                <div className="border-border flex shrink-0 items-center justify-between border-b px-6 py-3.5">
                    <span className="text-foreground text-[15px] font-semibold">Settings</span>
                    <Tip label="Close" hoverOnly>
                        <DialogClose
                            data-testid="settings-close"
                            aria-label="Close settings"
                            className="text-muted-foreground hover:text-foreground rounded transition-colors focus-visible:outline-2"
                        >
                            <X className="size-4" />
                        </DialogClose>
                    </Tip>
                </div>

                <SettingsPanelBody />
            </DialogContent>
        </Dialog>
    );
}
