"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { AnimatePresence, m } from "motion/react";

import { cn } from "../../lib/utils";

import { useUpdate } from "./UpdateProvider";

/**
 * The "Update x.y.z · Install" chip. Appears only when a verified update has
 * been downloaded. The download never touches the install on disk; clicking the
 * chip is the user's explicit confirmation to rewrite it and relaunch. Renders
 * nothing in every other state, so it never nags mid-round.
 */
export default function UpdateChip() {
    const { state, installAndRestart } = useUpdate();
    const ready = state.status === "ready";
    const version = ready ? state.manifest.version : "";

    return (
        <AnimatePresence>
            {ready && (
                <m.button
                    key="update-chip"
                    type="button"
                    onClick={() => void installAndRestart()}
                    data-testid="update-chip"
                    aria-label={`Update ${version} downloaded - install and restart`}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    className={cn(
                        // z-[100]: see dialog.tsx - a host page's own dialog can portal to
                        // document.body at the same z-50 this would otherwise use.
                        "fixed right-4 bottom-4 z-[100] flex items-center gap-1.5 rounded-full",
                        "border-border bg-card text-foreground border px-3 py-1.5 text-[12px] shadow-sm",
                        "hover:bg-accent transition-colors focus-visible:outline-2",
                    )}
                >
                    <DownloadSimple className="size-3.5" />
                    <span className="font-medium">Update {version}</span>
                    <span className="text-muted-foreground">· Install</span>
                </m.button>
            )}
        </AnimatePresence>
    );
}
