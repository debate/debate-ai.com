/**
 * @fileoverview Network calls for the flow-editor settings account sync (see
 * `flow-editor-settings-sync.ts`). Talks to `/api/settings`; a `401` resolves
 * to `null` so a signed-out browser keeps using localStorage.
 *
 * @module lib/store/flow-editor-settings-sync-client
 */

import type { FlowEditorSettingsSyncPayload } from "./flow-editor-settings-sync";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
        const payload = (await res.json()) as { error?: string };
        return payload?.error ?? fallback;
    } catch {
        return fallback;
    }
}

/** `null` when signed out; `{ settings: null }` when signed in with nothing synced yet. */
export async function fetchFlowEditorSettings(
    endpoint = "/api/settings",
): Promise<{ settings: FlowEditorSettingsSyncPayload | null } | null> {
    const res = await fetch(endpoint);
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to load account settings."));
    const payload = (await res.json()) as { flowEditorSettings?: FlowEditorSettingsSyncPayload | null };
    return { settings: payload.flowEditorSettings ?? null };
}

export async function saveFlowEditorSettings(
    settings: FlowEditorSettingsSyncPayload | null,
    endpoint = "/api/settings",
): Promise<void> {
    const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flowEditorSettings: settings }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save account settings."));
}
