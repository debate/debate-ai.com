"use client";

import { useInviteWatch } from "../../lib/collab/useInviteWatch";

/**
 * Mounts the idle invite listener app-wide. Rendered once in the root layout,
 * because a partner's invite has to reach the start screen too: that is where
 * a debater is sitting when they have no round open to be invited into.
 * No-op on web, and no-op with shared editing off. Renders nothing.
 */
export default function InviteWatch() {
    useInviteWatch();
    return null;
}
