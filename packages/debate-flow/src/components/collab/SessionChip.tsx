"use client";

import { useEffect, useId } from "react";

import { Button } from "../ui/button";
import { disconnectPeer, endSession } from "../../lib/collab/runtime";
import { chipSummary, pendingLine } from "../../lib/collab/statusLine";
import { type CollabPeerView, useCollabStore } from "../../lib/store/useCollabStore";
import { useReleasePopupOnUnmount, useSidebarPopup } from "../../lib/store/useSidebarPopup";
import { cn } from "../../lib/utils";

/** What each role may do, in the words the chip shows a debater. */
const ROLE_LABEL: Record<CollabPeerView["role"], string> = {
    editor: "edit",
    viewer: "view",
};

export interface SessionChipProps {
    className?: string;
}

/**
 * The bottom-left session chip: one sentence about the round's connections,
 * expanding on click into one row per peer - the ones that are here, with role
 * and connection type, and the ones that are not, with what to do about it. A
 * side the host admitted as a viewer is told so, because a grid that refuses
 * every keystroke needs to say why.
 *
 * A session is the only thing it reports, so `status: "off"` renders nothing at
 * all - the master switch leaves no trace in the DOM. It is a plain button and
 * a plain panel, never a dialog: nothing here blocks the grid, autofocuses, or
 * traps focus, because a debater mid-speech cannot afford either.
 */
export default function SessionChip({ className }: SessionChipProps) {
    const status = useCollabStore((s) => s.status);
    const peers = useCollabStore((s) => s.peers);
    const pending = useCollabStore((s) => s.pending);
    const selfRole = useCollabStore((s) => s.selfRole);
    const openPopup = useSidebarPopup((s) => s.open);
    const showPopup = useSidebarPopup((s) => s.show);
    const expanded = openPopup === "session";
    const panelId = useId();
    useReleasePopupOnUnmount("session");

    // A session that ends closes the panel, so the next one opens collapsed.
    useEffect(() => {
        if (status === "off") useSidebarPopup.getState().close("session");
    }, [status]);

    if (status === "off") return null;

    const summary = chipSummary(
        peers.map((p) => ({ name: p.name, relayed: p.connectionType === "relayed" })),
        pending,
    );
    // Green only for a round whose partners are all here. Anything a debater
    // might act on is amber.
    const settled = peers.length > 0 && pending.length === 0;

    return (
        // The caller owns the outer slot's position; the anchor stays `relative`
        // underneath it, so a `fixed` slot class has nothing to fight with.
        <div className={className}>
            <div className="relative">
                {/* The trigger leads in DOM order so a Tab from the chip walks
                    into the panel, while `bottom-full` draws the panel above. */}
                <button
                    type="button"
                    data-testid="collab-chip"
                    data-state={status}
                    aria-expanded={expanded}
                    aria-controls={expanded ? panelId : undefined}
                    onClick={() => showPopup(expanded ? null : "session")}
                    className={cn(
                        "border-border bg-card text-foreground flex w-full items-center gap-1.5 rounded-full border",
                        "hover:bg-accent px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-2",
                    )}
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            settled ? "bg-good" : "bg-warn",
                        )}
                    />
                    <span className="truncate font-medium">{summary}</span>
                </button>
                {expanded && (
                    <div
                        id={panelId}
                        data-testid="collab-chip-peers"
                        className="border-border bg-card absolute bottom-full left-0 z-30 mb-1 flex w-56 flex-col gap-1 rounded-md border p-1.5 shadow-md"
                    >
                        {selfRole === "viewer" && (
                            <p
                                data-testid="collab-self-role"
                                className="text-muted-foreground border-border border-b px-1 py-0.5 text-[12px]"
                            >
                                You are viewing this round, not editing it.
                            </p>
                        )}
                        {peers.length === 0 && pending.length === 0 && (
                            <p className="text-muted-foreground px-1 py-0.5 text-[12px]">
                                No peers connected.
                            </p>
                        )}
                        {peers.map((peer) => (
                            <div
                                key={peer.endpointId}
                                data-testid="collab-peer-row"
                                className="flex flex-col gap-0.5 rounded px-1 py-0.5"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                                        {peer.name}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        data-testid="collab-peer-disconnect"
                                        aria-label={`Disconnect ${peer.name}`}
                                        onClick={() => void disconnectPeer(peer.endpointId)}
                                    >
                                        Disconnect
                                    </Button>
                                </div>
                                <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                                    <span
                                        data-testid="collab-peer-role"
                                        className="border-border shrink-0 rounded-full border px-1.5 py-px"
                                    >
                                        {ROLE_LABEL[peer.role]}
                                    </span>
                                    <span data-testid="collab-peer-connection" className="shrink-0">
                                        {peer.connectionType}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {pending.map((peer) => (
                            <p
                                key={peer.endpointId}
                                data-testid="collab-pending-row"
                                className="text-muted-foreground px-1 py-0.5 text-[12px]"
                            >
                                {pendingLine(peer)}
                            </p>
                        ))}
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="text-warn justify-start"
                            data-testid="collab-end-session"
                            onClick={() => void endSession()}
                        >
                            End session
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
