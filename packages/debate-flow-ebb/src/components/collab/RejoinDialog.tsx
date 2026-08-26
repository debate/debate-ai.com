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
import { contactName } from "../../lib/collab/contacts";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { useRejoinDialog, type RejoinAsk } from "../../lib/store/useRejoinDialog";

/**
 * The one question a join asks after the code: an invitation naming a round
 * already on this machine wants a place in it, which is the debater's to
 * grant.
 *
 * Cancel holds the focus, because the safe answer is the one a debater who
 * does not recognise the round gives by reflex, and Escape gives the same
 * answer.
 */
export default function RejoinDialog() {
    const open = useRejoinDialog((s) => s.open);
    const ask = useRejoinDialog((s) => s.ask);
    const answer = useRejoinDialog((s) => s.answer);
    const close = useRejoinDialog((s) => s.close);

    // A join waiting on a dialog that goes away with the tree would wait
    // forever, so leaving settles the request as a cancel.
    useEffect(() => close, [close]);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent className="max-w-md" data-testid="rejoin-dialog">
                {ask && <Rejoin ask={ask} onAnswer={answer} />}
            </DialogContent>
        </Dialog>
    );
}

function Rejoin({ ask, onAnswer }: { ask: RejoinAsk; onAnswer: (answer: true | null) => void }) {
    const contacts = useFlowStore((s) => s.contacts);
    // A name a peer broadcast is theirs to choose, so this takes the saved one
    // and falls back to a short EndpointId rather than to anything they sent.
    const who = contactName(contacts, ask.endpointId);

    return (
        <>
            <DialogHeader>
                <DialogTitle>You already have this round</DialogTitle>
                <DialogDescription>
                    This code opens{" "}
                    <strong className="text-foreground font-medium">{ask.round}</strong>, which is
                    already on this machine. Adding {who} shares your copy with them, and every
                    later open of the round dials them, with no code and nothing to accept.
                </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
                <Button
                    autoFocus
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAnswer(null)}
                    data-testid="rejoin-cancel"
                >
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    onClick={() => onAnswer(true)}
                    data-testid="rejoin-add"
                >
                    Add {who}
                </Button>
            </div>
        </>
    );
}
