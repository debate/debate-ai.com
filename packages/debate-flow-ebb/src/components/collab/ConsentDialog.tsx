"use client";

import { useEffect } from "react";

import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { useCollabConsent } from "../../lib/store/useCollabConsent";

/**
 * The one question ebb asks before it can reach anybody.
 *
 * Not now holds the focus, because the safe answer is the one a debater who
 * did not mean to click Share gives by reflex, and Escape gives the same
 * answer.
 */
export default function ConsentDialog() {
    const open = useCollabConsent((s) => s.open);
    const answer = useCollabConsent((s) => s.answer);
    const close = useCollabConsent((s) => s.close);

    // A caller waiting on a dialog that goes away with the tree would wait
    // forever, so leaving settles the question as a no.
    useEffect(() => close, [close]);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent className="max-w-md" data-testid="collab-consent">
                <DialogHeader>
                    <DialogTitle>Turn on sharing?</DialogTitle>
                    <DialogDescription>
                        Sharing lets ebb connect to your partner over the network. Nothing is sent
                        anywhere until you share a round.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                    <Button
                        autoFocus
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid="collab-consent-no"
                        onClick={() => answer(false)}
                    >
                        Not now
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        data-testid="collab-consent-yes"
                        onClick={() => answer(true)}
                    >
                        Turn on sharing
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
