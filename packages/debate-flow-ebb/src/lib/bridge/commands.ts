/**
 * The two commands that reach out to CardMirror: jump to a cell's source
 * document position, and send the selection into the open document.
 *
 * Both are fire-and-forget from the command layer's point of view. They never
 * throw and never leave the user guessing: every outcome, including a
 * CardMirror that is closed or a cell with no provenance, ends in a toast
 * that names the next move.
 *
 * On the web build, and with the integration switched off in Settings, both
 * are silent no-ops: the feature is absent there, and an absent feature owes
 * the user nothing, not even a toast.
 */

import { toast } from "sonner";

import { isForeignSource, sourceOwner } from "../collab/foreignSource";
import { getReplica, replicaActor } from "../collab/replica";
import { getActiveHot, getActiveSheetId } from "../grid/hotInstance";
import type { CellSource } from "../model/flow";
import { useFlowStore } from "../store/useFlowStore";

import type { BridgeCall, BridgeFailure, CardMirrorReply } from "./cardmirror";
import { cardmirrorInsert, cardmirrorJump } from "./cardmirror";
import { cardmirrorLive } from "./enabled";

const TRANSPORT_MESSAGE: Record<BridgeFailure, string> = {
    "not-registered": "CardMirror has never run on this machine.",
    "not-running": "CardMirror is not running.",
    timeout: "CardMirror did not answer.",
    "bad-response": "CardMirror sent something ebb could not read.",
    unsupported: "This works in the ebb desktop app.",
};

const JUMP_MESSAGE: Record<string, string> = {
    "not-found": "That card is no longer in the document.",
    "bad-request": "CardMirror could not read this cell's source.",
};

const INSERT_MESSAGE: Record<string, string> = {
    "no-target-doc": "Open a document in CardMirror first.",
    "doc-readonly": "That CardMirror document is in read mode.",
    "bad-request": "CardMirror would not take that text.",
};

/**
 * CardMirror's consent layer. One decision per app governs its whole gated
 * surface, so these read the same on jump and insert alike.
 *
 * All three are terminal: the user either made this choice deliberately or
 * has to change it in CardMirror. Retrying would nag them, and reaching the
 * document another way would route around a decision they made on purpose,
 * so ebb does neither - it says what happened and stops.
 */
const CONSENT_MESSAGE: Record<string, string> = {
    unidentified: "CardMirror did not recognize ebb. Check for an ebb update.",
    "inserts-disabled": "CardMirror is refusing inserts from other apps.",
    "not-allowed": "CardMirror is blocking ebb. Allow it under External apps in its settings.",
};

/**
 * CardMirror queued the action behind its consent prompt and has done
 * nothing yet. Approving there replays what was queued, so the user's click
 * is the redo and a second send would only queue a duplicate.
 */
const CONSENT_PENDING = "Waiting for approval in CardMirror. No need to try again.";

/** The provenance on the focused cell, or null when it was typed here. */
function selectedSource(): CellSource | null {
    const hot = getActiveHot();
    const selection = hot?.getSelectedLast();
    if (!hot || !selection) return null;
    // Handsontable types cell meta as an open bag, so the read is asserted the
    // same way the rest of the grid layer asserts className.
    return (hot.getCellMeta(selection[0], selection[1]).source as CellSource | undefined) ?? null;
}

/** Whether the focused cell's provenance was written on another machine. */
function selectedSourceIsForeign(): boolean {
    const hot = getActiveHot();
    const selection = hot?.getSelectedLast();
    const sheetId = getActiveSheetId();
    const doc = getReplica();
    if (!hot || !selection || !sheetId || !doc) return false;
    const owner = sourceOwner(doc.sheets[sheetId], selection[1], selection[0]);
    return isForeignSource(owner, replicaActor());
}

/**
 * Every non-empty selected cell, row-major within each selected range, one
 * per line. CardMirror's insert builds one block per line, so a single
 * newline is the paragraph break; a blank line between cells would leave an
 * empty paragraph behind in the document.
 */
function selectedText(): string {
    const hot = getActiveHot();
    const ranges = hot?.getSelectedRange();
    if (!hot || !ranges) return "";
    const parts: string[] = [];
    for (const range of ranges) {
        const tl = range.getTopLeftCorner();
        const br = range.getBottomRightCorner();
        for (let r = tl.row ?? 0; r <= (br.row ?? -1); r++) {
            for (let c = tl.col ?? 0; c <= (br.col ?? -1); c++) {
                const value = hot.getDataAtCell(r, c);
                if (typeof value === "string" && value.trim()) parts.push(value.trim());
            }
        }
    }
    return parts.join("\n");
}

/**
 * Null when CardMirror finished the job, else what to tell the user: a
 * transport failure, a refusal, or a consent prompt still waiting on them.
 */
function outcomeMessage(
    call: BridgeCall<CardMirrorReply>,
    errors: Record<string, string>,
    fallback: string,
): string | null {
    if (!call.ok) return TRANSPORT_MESSAGE[call.error];
    // Checked before `ok`, because a queued action answers `ok: true` with
    // nothing done. Consent is the only pending kind the bridge spec defines;
    // treating any other as unfinished keeps a future one from being reported
    // as a success that never happened.
    if (call.value.pending) return CONSENT_PENDING;
    if (call.value.ok) return null;
    const error = call.value.error ?? "";
    if (error === "doc-not-open") {
        const title = call.value.docTitle;
        return title ? `Open "${title}" in CardMirror first.` : "Open the document in CardMirror.";
    }
    return CONSENT_MESSAGE[error] ?? errors[error] ?? fallback;
}

/**
 * Jump to the document position a given cell came from. The caller names the
 * cell, so the right-click menu can act on the cell it was opened over rather
 * than on whatever the keyboard last selected.
 */
export async function jumpToSource(source: CellSource | null, foreign = false): Promise<void> {
    if (!cardmirrorLive()) return;
    if (!source) {
        toast("This cell did not come from CardMirror.");
        return;
    }
    // A partner's token means nothing to the CardMirror on this machine, so
    // this degrades to the same path a stale local source takes rather than
    // handing over a token that can only fail obscurely.
    if (foreign) {
        toast(
            source.title
                ? `Open "${source.title}" in CardMirror first.`
                : "That cell came from a partner's CardMirror.",
        );
        return;
    }
    const message = outcomeMessage(
        await cardmirrorJump(source.token),
        JUMP_MESSAGE,
        "CardMirror could not open this cell's source.",
    );
    if (message) toast(message);
}

export function runJumpToSource(): Promise<void> {
    return jumpToSource(selectedSource(), selectedSourceIsForeign());
}

export async function runSendToDoc(): Promise<void> {
    if (!cardmirrorLive()) return;
    const text = selectedText();
    if (!text) {
        toast("Select a cell with text to send.");
        return;
    }
    const call = await cardmirrorInsert(text, useFlowStore.getState().cardmirrorTextType);
    const message = outcomeMessage(call, INSERT_MESSAGE, "CardMirror could not take that text.");
    if (message) {
        toast(message);
        return;
    }
    const title = call.ok ? call.value.docTitle : undefined;
    toast(title ? `Sent to "${title}".` : "Sent to CardMirror.");
}
