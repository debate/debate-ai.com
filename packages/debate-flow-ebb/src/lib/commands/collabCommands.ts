/**
 * The collaboration commands, and nothing else reaches a session.
 *
 * No chord and no accelerator: flowing owns most of the letter space, and a
 * printable key bound outside `HotGrid`'s guard erases the cell the debater is
 * standing on. They are reached by click - the palette, the sidebar's sharing
 * controls, and for join, the File menu, which is the one route a guest with a
 * code can take before any flow is open.
 *
 * Sharing and joining ask for consent first rather than checking a switch and
 * refusing. A debater who has just clicked Share has said what they want, and
 * that is a better moment to ask than a settings pane they never opened.
 */

import { contactName, type Contacts } from "../collab/contacts";
import { collabLive, collabSettings } from "../collab/enabled";
import { inviteContact, joinByCode, resumeJoined, startPairing } from "../collab/runtime";
import { currentSession, endSession } from "../collab/runtime";
import type { Role } from "../collab/types";
import { useFlowStore } from "../store/useFlowStore";

/** What turning relaying off costs, said before a code is minted. */
const RELAY_OFF_WARNING = "Relaying is off, so this code only works on the same wifi.";

export interface CollabCommandDeps {
    /**
     * Picks the saved contact to grant `role` on this round and answers with
     * their EndpointId, or null when the user backs out. The grant arrives
     * already chosen, from the menu entry the debater clicked.
     */
    chooseContact?(contacts: Contacts, role: Role): Promise<string | null>;
    /** Corner messages. Nothing here blocks the grid or takes focus. */
    notify(message: string): void;
    fail(message: string): void;
    /** Whether this install may reach a peer, asking the debater if it must. */
    consent(): Promise<boolean>;
    /** Puts the share sheet up with nothing on it, while the endpoint homes. */
    openShare(role: Role, warning: string): void;
    /** Puts the code on that sheet, with the call that takes it off the air. */
    showCode(code: string, stop: () => Promise<void>): void;
    /** Says on that same sheet why there is no code. */
    failShare(message: string): void;
    /** Reads the code a guest was given. Returns null when they back out. */
    askForCode(): Promise<string | null>;
    /** Routes to a flow file, for a join that landed. */
    openFlow(path: string): void;
}

/**
 * Puts a pairing code on the air for the open round and shows it, starting a
 * session first when none is running. A view-only code grants its holders the
 * round as it unfolds and nothing more: the host drops the writes that come
 * back from them.
 */
export async function runShare(deps: CollabCommandDeps, role: Role = "editor"): Promise<void> {
    if (!(await deps.consent())) return;
    const round = useFlowStore.getState().round;
    if (!round) {
        deps.fail("Open a flow to share it");
        return;
    }
    // Said before anything is minted rather than after a partner fails to
    // arrive: with relaying off there is no route between two networks, and a
    // debater who set that switch is owed the consequence up front.
    deps.openShare(role, collabSettings().relay ? "" : RELAY_OFF_WARNING);
    try {
        const hosted = await startPairing(round, role);
        if (!hosted) {
            deps.failShare("Could not start a session");
            return;
        }
        deps.showCode(hosted.code, hosted.stop);
    } catch (err) {
        deps.failShare(err instanceof Error ? err.message : "Could not share this round");
    }
}

/** Takes a code, fetches the round, and opens the file it landed in. */
export async function runJoin(deps: CollabCommandDeps): Promise<void> {
    if (!(await deps.consent())) return;
    const code = await deps.askForCode();
    if (!code) return;
    try {
        const joined = await joinByCode(code);
        if (!joined) {
            // Either the switch went off behind the code, or the debater
            // declined to admit the issuer to a round they already hold. The
            // second has had its dialog and wants no corner message.
            if (!collabLive()) deps.fail("Turn on shared editing in Settings first");
            return;
        }
        // Started before the route is asked, so the check reads the flow this
        // window is holding rather than the one it is about to.
        const resuming = resumeJoined(joined.path);
        deps.notify(joined.created ? "Joined. The round is yours to keep." : "Joined.");
        deps.openFlow(joined.path);
        await resuming;
    } catch (err) {
        deps.fail(err instanceof Error ? err.message : "Could not join that round");
    }
}

/**
 * Drops every peer. The flow stays open and stays editable.
 *
 * Wrapped like its siblings, and for the same reason twice over: it is fired
 * as `void runEnd(...)`, so a rejection here surfaces as an unhandled promise
 * and never reaches the user, and End session is a button a debater presses
 * mid-round. The session is torn down before the transport is asked to stop,
 * so a failure past that point has already left this side ended.
 */
export async function runEnd(deps: CollabCommandDeps): Promise<void> {
    if (!currentSession()) {
        deps.fail("No session is running");
        return;
    }
    try {
        await endSession();
        deps.notify("Session ended. The flow is still yours.");
    } catch (err) {
        deps.fail(err instanceof Error ? err.message : "Could not end the session cleanly");
    }
}

/** Dials a saved contact. No code: their EndpointId already authorizes. */
export async function runInvite(deps: CollabCommandDeps, role: Role = "editor"): Promise<void> {
    if (!(await deps.consent())) return;
    const round = useFlowStore.getState().round;
    if (!round) {
        deps.fail("Open a flow to share it");
        return;
    }
    const contacts = useFlowStore.getState().contacts;
    if (Object.keys(contacts).length === 0) {
        deps.fail("No saved partners yet. Share a round once to save one.");
        return;
    }
    const endpointId = await deps.chooseContact?.(contacts, role);
    if (!endpointId) return;
    try {
        await inviteContact(round, endpointId, role);
        deps.notify(
            role === "viewer"
                ? `Invited ${contactName(contacts, endpointId)} to view`
                : `Invited ${contactName(contacts, endpointId)} to edit`,
        );
    } catch (err) {
        deps.fail(err instanceof Error ? err.message : "Could not reach that partner");
    }
}
