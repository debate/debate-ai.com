/**
 * Being reachable between rounds.
 *
 * A session binds an endpoint for the round it is holding, so with no round
 * open there is nothing for a partner to dial and an invite lands nowhere.
 * This binds the same endpoint for one purpose only: hearing a saved contact
 * offer a round, so the corner can say so.
 *
 * It joins nothing and answers nothing else. A dialler who is not in the
 * contact table gets no reply at all, not even a refusal, because an
 * EndpointId is permanent and every peer who has ever shared with this install
 * holds one.
 *
 * Every window hears every inbound connection, because the shell cannot know
 * which window owns one at the moment it accepts: the round only arrives in
 * the hello. So a hello naming the round this window has open is left entirely
 * alone - it belongs to whichever window is sharing that round - and a peer
 * this listener never answered is hung up on once a deadline passes. An
 * immediate hang-up would drop a peer another window had just admitted;
 * leaving it open forever would let anyone holding this EndpointId pin a
 * connection for the life of the process. The deadline is a stopgap for this
 * one path: the durable cap on unauthenticated inbound connections belongs to
 * the shell, which is the only place that sees one that no window is told
 * about.
 *
 * Two switches gate it, not one. The master switch, exactly like a session;
 * and Listen for invites, which is its own setting because this is the only
 * route in ebb that binds an endpoint with no round in hand. Off - which is
 * the default - the app reaches the network when a debater shares or joins a
 * round and at no other moment, so a cold launch says nothing to anyone.
 */

import type { Contacts } from "./contacts";
import { collabSettings, type CollabSettings } from "./enabled";
import { INVITED, inviteFrom, type InviteNotice } from "./invite";
import { HANDSHAKE_MS, type PeerLinkFactory } from "./peerLink";
import { defaultSchedule } from "./sync";

export interface InviteListenerDeps {
    createLink: PeerLinkFactory;
    contacts(): Contacts;
    /** The round this window has open, whose peers are not this listener's. */
    openRoundId(): string | null;
    onInvite(notice: InviteNotice): void;
    settings?: () => CollabSettings;
    /** The clock the deadline runs on. The window's own, unless a test says. */
    schedule?: (fn: () => void, ms: number) => () => void;
}

export interface InviteListener {
    endpointId: string;
    /**
     * The relay setting this endpoint bound with. Kept because the choice is
     * made once, at bind time, so the only way to honour a debater turning
     * relay off is to notice the handle no longer matches and bind again.
     */
    relay: boolean;
    stop(): Promise<void>;
}

/** Null unless both the master switch and Listen for invites are on. */
export async function startInviteListener(
    deps: InviteListenerDeps,
): Promise<InviteListener | null> {
    const settings = (deps.settings ?? collabSettings)();
    if (!settings.enabled || !settings.listen) return null;

    const link = await deps.createLink({ discovery: "mdns", relay: settings.relay });
    const endpointId = await link.endpointId();
    let stopped = false;
    const schedule = deps.schedule ?? defaultSchedule;

    await link.listen((conn) => {
        if (stopped) return;
        let greeted = false;
        /**
         * A connection this listener is holding is released when the deadline
         * passes, whatever the peer said on it. Traffic beyond the greeting is
         * never another window's admitted peer: the shell addresses an owned
         * connection's messages to the window that claimed it, so a second
         * line reaching here is a peer nobody owns, which is exactly what the
         * deadline bounds. Letting that line hold the connection open would
         * hand anyone with this EndpointId every inbound slot the shell has.
         * A close this window is not entitled to make is refused by the
         * shell's owner check and costs it only its own handle.
         */
        const deadline = schedule(() => conn.close(), HANDSHAKE_MS);
        conn.onClose(() => deadline());
        conn.onMessage((msg) => {
            if (greeted) return;
            greeted = true;
            // No round is held here, so an offer is about someone else's. The
            // round this window has open is the one exception: a peer arriving
            // about that is joining it, not offering it.
            const notice = inviteFrom(msg, deps.contacts(), deps.openRoundId(), conn.id);
            if (!notice) return;
            deps.onInvite(notice);
            conn.send({ type: "helloAck", ok: false, reason: INVITED });
            // Answered, so this one is this window's to release.
            deadline();
            conn.close();
        });
    });

    return {
        endpointId,
        relay: settings.relay,
        async stop() {
            stopped = true;
            await link.stop();
        },
    };
}
