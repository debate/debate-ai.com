/**
 * Turning a short code into the ticket that opens a round.
 *
 * The code is the address: the shell derives one key and one relay from it, so
 * the host binds a temporary endpoint the guest already knows how to dial and
 * nothing is published or looked up anywhere. What crosses that connection is
 * this module's whole subject, and it is short - the guest says who it is, the
 * host answers with a `Ticket` of the format that already exists, and the
 * endpoint stops. Everything after the ticket is the protocol that was already
 * here.
 *
 * The guest's EndpointId and relay are read off the connection rather than
 * taken from what the guest says about itself: iroh proved the far side holds
 * that key, and an address a peer reports is one it could have made up.
 *
 * A partner code admits one person. It is spent when the ticket goes out and
 * not when a guest dials, so a dial that fails part way leaves the code alive
 * for that same partner to try again.
 */

import { HANDSHAKE_MS, type PairingPort, type PeerConn } from "./peerLink";
import { defaultSchedule } from "./sync";

/**
 * How long a code lives.
 *
 * Long enough to read one across a table and have a partner find the Join
 * button, short enough that a share sheet left open behind a locked screen is
 * not an open door for the rest of the tournament.
 */
export const PAIR_TTL_MS = 10 * 60 * 1000;

/** A guest that redeemed a code, as the connection proved them. */
export interface PairGuest {
    endpointId: string;
    /** What they call themselves, when they said. A suggestion, never a name. */
    name?: string;
    /** Where they were reached, so a later open of this round has a route. */
    relayUrl?: string;
}

export interface HostPairingDeps {
    port: PairingPort;
    code: string;
    /** One person, then the code is spent. False for a view-only code. */
    once: boolean;
    /**
     * The ticket for the guest being answered right now. Called per guest, so
     * a view-only code hands each of them their own single-use secret.
     */
    mintTicket(): Promise<string>;
    displayName?: string;
    roundLabel?: string;
    onGuest(guest: PairGuest): void;
    schedule?: (fn: () => void, ms: number) => () => void;
}

export interface HostPairing {
    /** The endpoint the code names, which is what the guest dials. */
    endpointId: string;
    stop(): Promise<void>;
}

export interface PairedTicket {
    ticket: string;
    hostName?: string;
    roundLabel?: string;
}

export interface RedeemDeps {
    port: PairingPort;
    code: string;
    displayName?: string;
    schedule?: (fn: () => void, ms: number) => () => void;
}

/** What a guest is told when a code led nowhere. */
const NO_ANSWER = "That code did not answer. Check it and try again.";

export async function hostPairing(deps: HostPairingDeps): Promise<HostPairing> {
    const schedule = deps.schedule ?? defaultSchedule;
    let spent = false;
    /** A ticket being minted right now, so two dials cannot both take it. */
    let minting = false;
    let stopped = false;
    let expire: (() => void) | null = null;

    async function stop(): Promise<void> {
        if (stopped) return;
        stopped = true;
        expire?.();
        expire = null;
        await deps.port.pairStop();
    }

    function answer(conn: PeerConn): void {
        let greeted = false;
        // A dialler that opens a connection and says nothing is refused by
        // nothing below, so the clock is what bounds it. A spent code is not
        // refused here either: a close before the far side has finished
        // wiring up its handlers is a link that vanishes rather than one that
        // says no, and the guest is owed the second.
        const ungreeted = schedule(() => {
            if (!greeted) conn.close();
        }, HANDSHAKE_MS);
        conn.onMessage((msg) => {
            if (greeted || msg.type !== "pairHello") return;
            greeted = true;
            ungreeted();
            if (stopped || spent || minting) {
                conn.close();
                return;
            }
            minting = true;
            const said = msg.name;
            void deps
                .mintTicket()
                .then((ticket) => {
                    if (stopped) {
                        conn.close();
                        return;
                    }
                    // Spent as the ticket goes out. A mint that threw leaves
                    // the code alive, which is what lets the one partner it
                    // was made for try again.
                    if (deps.once) spent = true;
                    conn.send({
                        type: "pairAck",
                        ticket,
                        ...(deps.displayName ? { name: deps.displayName } : {}),
                        ...(deps.roundLabel ? { roundLabel: deps.roundLabel } : {}),
                    });
                    const relayUrl = conn.relayUrl();
                    deps.onGuest({
                        endpointId: conn.id,
                        ...(said ? { name: said } : {}),
                        ...(relayUrl ? { relayUrl } : {}),
                    });
                })
                .catch(() => conn.close())
                .finally(() => {
                    minting = false;
                });
        });
    }

    const endpointId = await deps.port.pairHost(deps.code, answer);
    expire = schedule(() => void stop(), PAIR_TTL_MS);
    return { endpointId, stop };
}

/** Dials the endpoint a code names and comes back with the ticket it holds. */
export async function redeemCode(deps: RedeemDeps): Promise<PairedTicket> {
    const schedule = deps.schedule ?? defaultSchedule;
    const conn = await deps.port.pairDial(deps.code);
    return new Promise<PairedTicket>((resolve, reject) => {
        let answered = false;
        function refuse(): void {
            if (answered) return;
            answered = true;
            late();
            conn.close();
            reject(new Error(NO_ANSWER));
        }
        // A host that took the connection and said nothing is a half-open link
        // or a build that does not speak this, and either way the guest is
        // owed an answer rather than a spinner.
        const late = schedule(refuse, HANDSHAKE_MS);
        conn.onMessage((msg) => {
            if (answered || msg.type !== "pairAck") return;
            answered = true;
            late();
            // The pairing connection has done its whole job. What opens the
            // round is the ticket, over the session's own endpoint.
            conn.close();
            resolve({
                ticket: msg.ticket,
                ...(msg.name ? { hostName: msg.name } : {}),
                ...(msg.roundLabel ? { roundLabel: msg.roundLabel } : {}),
            });
        });
        conn.onClose(refuse);
        // Sent last: a transport can answer synchronously, so the listener has
        // to be in place before the question goes out.
        conn.send({
            type: "pairHello",
            ...(deps.displayName ? { name: deps.displayName } : {}),
        });
    });
}
