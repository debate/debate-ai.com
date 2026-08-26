"use client";

import { useEffect, useId } from "react";

import { Button } from "../ui/button";
import { contactName } from "../../lib/collab/contacts";
import { acceptInvite } from "../../lib/collab/inbox";
import { inviteToastFor } from "../../lib/collab/invite";
import { useCollabStore } from "../../lib/store/useCollabStore";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { useReleasePopupOnUnmount, useSidebarPopup } from "../../lib/store/useSidebarPopup";
import { cn } from "../../lib/utils";

export interface InviteChipProps {
    className?: string;
}

/**
 * The invitations waiting, reachable from inside a round.
 *
 * A corner message lasts half a minute and a debater mid-speech is looking at
 * the sheet, so an offer whose toast has gone would otherwise be findable only
 * by closing the round and going back to the start screen. This sits beside the
 * session chip and speaks the same way: a pill that expands into rows, never a
 * dialog, because nothing here may block the grid, autofocus, or trap focus.
 *
 * With nothing waiting it renders nothing at all, so a debater who has been
 * invited to no rounds sees no trace of the feature.
 */
export default function InviteChip({ className }: InviteChipProps) {
    const invites = useCollabStore((s) => s.invites);
    const dismissInvite = useCollabStore((s) => s.dismissInvite);
    const contacts = useFlowStore((s) => s.contacts);
    const openPopup = useSidebarPopup((s) => s.open);
    const showPopup = useSidebarPopup((s) => s.show);
    const expanded = openPopup === "invites";
    const panelId = useId();
    useReleasePopupOnUnmount("invites");

    // The last invitation leaving closes the panel, so the next one opens
    // collapsed.
    const none = invites.length === 0;
    useEffect(() => {
        if (none) useSidebarPopup.getState().close("invites");
    }, [none]);

    if (none) return null;

    return (
        // The caller owns the outer slot's position; the anchor stays `relative`
        // underneath it, so a `fixed` slot class has nothing to fight with.
        <div className={className}>
            <div className="relative">
                {/* The trigger leads in DOM order so a Tab from the chip walks
                    into the panel, while `bottom-full` draws the panel above. */}
                <button
                    type="button"
                    data-testid="collab-invite-chip"
                    aria-expanded={expanded}
                    aria-controls={expanded ? panelId : undefined}
                    onClick={() => showPopup(expanded ? null : "invites")}
                    className={cn(
                        "border-border bg-card text-foreground flex w-full items-center gap-1.5 rounded-full border",
                        "hover:bg-accent px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-2",
                    )}
                >
                    <span aria-hidden="true" className="bg-warn size-1.5 shrink-0 rounded-full" />
                    <span className="font-medium">Invited</span>
                    <span className="text-muted-foreground truncate">
                        {invites.length === 1 ? "1 invite" : `${invites.length} invites`}
                    </span>
                </button>
                {expanded && (
                    <div
                        id={panelId}
                        data-testid="collab-invite-list"
                        className="border-border bg-card absolute bottom-full left-0 z-30 mb-1 flex w-56 flex-col gap-1 rounded-md border p-1.5 shadow-md"
                    >
                        {invites.map((invite) => {
                            const who = contactName(contacts, invite.endpointId);
                            return (
                                <div
                                    key={`${invite.endpointId}-${invite.roundId}`}
                                    data-testid="collab-invite-row"
                                    className="flex flex-col gap-0.5 rounded px-1 py-0.5"
                                >
                                    <span className="text-[12px] leading-snug font-medium break-words">
                                        {inviteToastFor(contacts, invite.endpointId, invite.label)}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="xs"
                                            data-testid="collab-invite-join"
                                            aria-label={`Join the round ${who} shared`}
                                            onClick={() => void acceptInvite(invite)}
                                        >
                                            Join
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="xs"
                                            className="text-muted-foreground"
                                            data-testid="collab-invite-dismiss"
                                            aria-label={`Dismiss the round ${who} shared`}
                                            onClick={() =>
                                                dismissInvite(invite.endpointId, invite.roundId)
                                            }
                                        >
                                            Dismiss
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
