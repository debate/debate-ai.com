"use client";

import { useBridgeHost } from "../lib/bridge/useBridgeHost";

/**
 * Mounts the inbound cardmirror-bridge listener once, app-wide, so a send
 * from CardMirror gets an answer on every route rather than only on the flow
 * screen.
 */
export function BridgeHost(): null {
    useBridgeHost();
    return null;
}
