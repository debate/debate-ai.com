"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { navigateToFlow } from "../../lib/commands/flowNav";
import { openFlowFromPicker } from "../../lib/commands/fileCommands";
import { errorMessage } from "../../lib/errorMessage";
import { makeFlowRound } from "../../lib/model/flow";
import { createFlowFile, resolveResumePath } from "../../lib/persistence/flowSession";
import { Button } from "../ui/button";

import { EditorLoadingSkeleton } from "./EditorLoadingSkeleton";

/**
 * Fills the gap between the embed mounting and a flow being open.
 *
 * ebb used to hold this moment on its own start screen (New flow / Open /
 * Settings, a list of recents). The host app now owns that role — the
 * pinned "ebb Flow" entry already sits in its own sidebar beside every other
 * flow tab — so ebb no longer needs a page of its own to pick one from. This
 * resumes the flow last worked on, or opens a fresh one when there isn't
 * one, and the toolbar's New/Open/Recent buttons (`RoundHeader`) cover
 * everything else the start screen used to offer.
 */
export default function ResumeFlow() {
    const [attempt, setAttempt] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        void (async () => {
            try {
                const path = await resolveResumePath();
                if (cancelled) return;
                if (path) {
                    navigateToFlow(path);
                    return;
                }
                const created = await createFlowFile(makeFlowRound());
                if (!cancelled) navigateToFlow(created, { isNew: true });
            } catch (err) {
                if (cancelled) return;
                toast.error(errorMessage(err, "Could not open a flow"));
                setFailed(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    if (failed) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-muted-foreground text-sm">Could not open a flow.</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                        Try again
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void openFlowFromPicker()}>
                        Open a flow
                    </Button>
                </div>
            </div>
        );
    }

    return <EditorLoadingSkeleton />;
}
