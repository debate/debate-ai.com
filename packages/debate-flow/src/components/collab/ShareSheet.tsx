"use client";

import { useEffect } from "react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { groupCode } from "../../lib/collab/codeText";
import { closeShareSheet, useShareSheet } from "../../lib/store/useShareSheet";

/**
 * The code, in three screens: getting ready, the code itself, and who arrived.
 *
 * The code is large selectable text rather than a field, because it is read
 * aloud far more often than it is copied and a partner across a table has to
 * see it from where they are sitting.
 */
export default function ShareSheet() {
    const open = useShareSheet((s) => s.open);
    const screen = useShareSheet((s) => s.screen);
    const role = useShareSheet((s) => s.role);
    const code = useShareSheet((s) => s.code);
    const guest = useShareSheet((s) => s.guest);
    const message = useShareSheet((s) => s.message);
    const warning = useShareSheet((s) => s.warning);

    // A sheet that goes away with the tree would leave its code on the air, so
    // leaving closes it.
    useEffect(() => closeShareSheet, []);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && closeShareSheet()}>
            <DialogContent className="max-w-md" data-testid="share-sheet">
                <DialogHeader>
                    <DialogTitle>
                        {role === "viewer" ? "Share view only" : "Invite partner"}
                    </DialogTitle>
                    <DialogDescription data-testid="share-status">
                        {screen === "ready" && "Getting ready..."}
                        {screen === "code" &&
                            (role === "viewer"
                                ? "Anyone with this code can watch this round while this stays open."
                                : "Read this to your partner. Waiting for your partner.")}
                        {screen === "joined" && `${guest} joined`}
                        {screen === "failed" && message}
                    </DialogDescription>
                </DialogHeader>
                {screen === "code" && (
                    <p
                        data-testid="share-code"
                        className="text-foreground text-center font-mono text-4xl tracking-[0.2em] select-all"
                    >
                        {groupCode(code)}
                    </p>
                )}
                {warning && screen !== "failed" && (
                    <p data-testid="share-warning" className="text-warn text-[12px]">
                        {warning}
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}
