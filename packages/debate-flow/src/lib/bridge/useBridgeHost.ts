"use client";

import { useEffect } from "react";

import { isDesktop } from "../update/adapter";
import { listenHere } from "../windowEvents";

import { handleBridgeRequest } from "./inbound";

interface BridgeRequest {
    id: string;
    route: string;
    body: unknown;
}

/**
 * Serves the inbound cardmirror-bridge routes for as long as the app is up.
 *
 * Mounted app-wide rather than on the flow screen: a send that lands while
 * the dashboard is open must still answer "no-active-sheet" promptly, since
 * the Rust host's only other outcome is a deadline the sender reads as a
 * dead app.
 */
export function useBridgeHost(): void {
    useEffect(() => {
        if (!isDesktop()) return;

        let active = true;
        let unlisten: (() => void) | undefined;

        void listenHere<BridgeRequest>("bridge:request", ({ id, route, body }) => {
            const response = handleBridgeRequest(route, body);
            // Dynamic because Tauri's api package only exists inside the desktop
            // shell; a static import would break the web export.
            void import("@tauri-apps/api/core")
                .then(({ invoke }) => invoke("bridge_reply", { id, response }))
                .catch(() => {
                    // The host times the request out on its own, and
                    // the sender hears about it there.
                });
        })
            .then((un) => {
                if (active) unlisten = un;
                else un();
            })
            .catch(() => {
                // No listener means every inbound route times out, which the
                // sender reports; crashing the app over it helps nobody.
            });

        return () => {
            active = false;
            unlisten?.();
        };
    }, []);
}
