"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { navigateToFlow } from "../../lib/commands/flowNav";
import { errorMessage } from "../../lib/errorMessage";
import type { EventId } from "../../lib/format/events";
import { makeFlowRound } from "../../lib/model/flow";
import type { Side } from "../../lib/model/types";
import { createFlowFile } from "../../lib/persistence/flowSession";

/**
 * useCreateFlow - the single way a new round comes into being.
 *
 * The file is written into the flows folder before the editor opens, so the
 * round is on disk from its first keystroke and autosave has somewhere to go.
 * That is what keeps "start a new flow" a single keypress rather than a save
 * dialog standing between the debater and a speech already underway; the file
 * can be moved later with Save As.
 */
export function useCreateFlow(): (event?: EventId, firstSide?: Side) => void {
    return useCallback((event: EventId = "policy", firstSide: Side = "aff") => {
        void createFlowFile(makeFlowRound({ event, firstSide }))
            .then((path) => navigateToFlow(path, { isNew: true }))
            .catch((err: unknown) => {
                toast.error(errorMessage(err, "Could not create that flow"));
            });
    }, []);
}
