"use client";

import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { bareCode, looksLikeCode } from "../../lib/collab/codeText";
import { useJoinDialog } from "../../lib/store/useJoinDialog";

/**
 * One field and one button.
 *
 * The field is the only thing that takes focus, because a debater who opened
 * this is about to type into it. It lives in the content, which unmounts with
 * the dialog, so each opening starts empty without an effect to reset it.
 */
export default function JoinDialog() {
    const open = useJoinDialog((s) => s.open);
    const submit = useJoinDialog((s) => s.submit);
    const close = useJoinDialog((s) => s.close);

    // A join waiting on a dialog that goes away with the tree would wait
    // forever, so leaving settles the request as a cancel.
    useEffect(() => close, [close]);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Join a shared round</DialogTitle>
                    <DialogDescription>Type the code your partner read out.</DialogDescription>
                </DialogHeader>
                <CodeField onSubmit={submit} />
            </DialogContent>
        </Dialog>
    );
}

function CodeField({ onSubmit }: { onSubmit: (code: string) => void }) {
    const [typed, setTyped] = useState("");
    const ready = looksLikeCode(typed);

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (ready) onSubmit(bareCode(typed));
            }}
        >
            <Input
                autoFocus
                data-testid="join-code-field"
                aria-label="Pairing code"
                value={typed}
                maxLength={9}
                placeholder="K7QM-3XPV"
                className="text-center font-mono text-2xl tracking-[0.2em]"
                onChange={(e) => setTyped(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={!ready} data-testid="join-code-submit">
                Join
            </Button>
        </form>
    );
}
