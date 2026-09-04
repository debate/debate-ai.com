"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useAutoUpdate, type AutoUpdate } from "../../lib/update/useAutoUpdate";

const UpdateContext = createContext<AutoUpdate | null>(null);

/**
 * Instantiates the single update lifecycle (one `useAutoUpdate` for the whole
 * app) and shares it. The chip and the settings panel both read from this one
 * state machine so a manual check and the background poller never diverge.
 * Inert on web — the hook does nothing without the Tauri runtime.
 */
export function UpdateProvider({ children }: { children: ReactNode }) {
    const update = useAutoUpdate();
    return <UpdateContext.Provider value={update}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): AutoUpdate {
    const ctx = useContext(UpdateContext);
    if (!ctx) {
        throw new Error("useUpdate must be used within an UpdateProvider");
    }
    return ctx;
}
