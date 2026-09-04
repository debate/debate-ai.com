"use client";

import { CaretDown, Eye, PencilSimple, ShareNetwork, SignIn } from "@phosphor-icons/react";

import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tip } from "../ui/tooltip";
import { executeCommand } from "../../lib/commands/commands";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { useReleasePopupOnUnmount, useSidebarPopup } from "../../lib/store/useSidebarPopup";
import { isDesktop } from "../../lib/update/adapter";

/**
 * Sharing, beside the round it shares.
 *
 * Not in Settings: Settings is where a debater changes how the application
 * behaves, and this does a thing to the flow that is open. Every entry runs
 * the same command the palette does, so there is still one route to a session
 * and the consent question still guards it.
 *
 * One button rather than a row of them, because the choice a debater makes is
 * two questions and not four buttons: who is arriving, and what they may do.
 * The grant is on the entry itself rather than a step behind it, so edit is
 * never what happens by default - it is chosen by name, for this round, every
 * time.
 *
 * Absent off the desktop, the way the Collaboration settings pane is. A
 * session is an iroh endpoint, which a browser cannot bind, so a button here
 * would offer a debater something that cannot exist and answer their click
 * with nothing.
 */
export default function ShareButton() {
    const round = useFlowStore((s) => s.round);
    const contacts = useFlowStore((s) => s.contacts);
    // Shown even with nothing saved, so a debater learns the route exists
    // before they have a partner to take it with.
    const noContacts = Object.keys(contacts).length === 0;
    // One slot for the whole corner, so this menu and the two chip panels
    // above it can never be drawn over one another.
    const openPopup = useSidebarPopup((s) => s.open);
    const showPopup = useSidebarPopup((s) => s.show);
    useReleasePopupOnUnmount("share");

    if (!isDesktop()) return null;

    return (
        <div className="flex flex-wrap items-center gap-1" data-testid="share-controls">
            {round && (
                <DropdownMenu
                    open={openPopup === "share"}
                    onOpenChange={(open) => showPopup(open ? "share" : null)}
                >
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            data-testid="sidebar-share"
                        >
                            <ShareNetwork />
                            Invite
                            <CaretDown className="size-3 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuGroup>
                            <DropdownMenuGroupLabel>Saved partner</DropdownMenuGroupLabel>
                            <DropdownMenuItem
                                disabled={noContacts}
                                data-testid="sidebar-invite-editor"
                                onSelect={() => executeCommand("collab.invite")}
                            >
                                <PencilSimple />
                                Invite to edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                disabled={noContacts}
                                data-testid="sidebar-invite-viewer"
                                onSelect={() => executeCommand("collab.inviteView")}
                            >
                                <Eye />
                                Invite to view
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuGroup>
                            <DropdownMenuGroupLabel>Generate a code</DropdownMenuGroupLabel>
                            <DropdownMenuItem
                                data-testid="sidebar-code-editor"
                                onSelect={() => executeCommand("collab.share")}
                            >
                                <PencilSimple />
                                Code to edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                data-testid="sidebar-code-viewer"
                                onSelect={() => executeCommand("collab.shareView")}
                            >
                                <Eye />
                                Code to view
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            <Tip label="Join with a code" command="collab.join">
                <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label="Join with a code"
                    data-testid="sidebar-join"
                    onClick={() => executeCommand("collab.join")}
                >
                    <SignIn />
                    Join
                </Button>
            </Tip>
        </div>
    );
}
