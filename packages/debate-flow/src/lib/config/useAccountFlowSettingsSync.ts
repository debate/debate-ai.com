"use client";

/**
 * Mirrors the flow editor's account-synced display/keymap settings
 * (`accountSettings.ts`) to the signed-in user's `/api/settings` row.
 *
 * localStorage stays the source of truth for a signed-out browser: a `401`
 * (or any network failure) leaves local settings untouched and disables the
 * push. When signed in, the account's saved values are applied once on mount,
 * then every later local change is pushed, debounced. A first sign-in with
 * nothing saved yet pushes the local values up instead.
 */

import { useEffect } from "react";

import { accountSettingsOf, useFlowStore } from "../store/useFlowStore";
import { normalizeFlowEditorSettingsPatch, type FlowEditorAccountSettingsPayload } from "./accountSettings";

export const ACCOUNT_SETTINGS_PUSH_DEBOUNCE_MS = 800;

/** The settings keys whose value differs between two payloads. */
export function changedAccountSettings(
    prev: FlowEditorAccountSettingsPayload,
    next: FlowEditorAccountSettingsPayload,
): FlowEditorAccountSettingsPayload {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(next) as (keyof FlowEditorAccountSettingsPayload)[]) {
        if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) out[key] = next[key];
    }
    return out as FlowEditorAccountSettingsPayload;
}

export function useAccountFlowSettingsSync(): void {
    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let unsubscribe: (() => void) | null = null;
        let synced = accountSettingsOf(useFlowStore.getState());

        const push = (patch: FlowEditorAccountSettingsPayload) => {
            if (Object.keys(patch).length === 0) return;
            void fetch("/api/settings", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ flowEditorSettings: patch }),
            }).catch(() => {
                // Best-effort - a failed account sync does not undo the local change.
            });
        };

        void (async () => {
            try {
                const res = await fetch("/api/settings");
                if (!res.ok || cancelled) return;
                const payload = (await res.json()) as { flowEditorSettings?: unknown };
                if (cancelled) return;
                const saved = normalizeFlowEditorSettingsPatch(payload.flowEditorSettings ?? {}).valid;
                if (Object.keys(saved).length > 0) {
                    useFlowStore.getState().applyAccountSettings(saved);
                } else {
                    push(accountSettingsOf(useFlowStore.getState()));
                }
                synced = accountSettingsOf(useFlowStore.getState());

                unsubscribe = useFlowStore.subscribe(() => {
                    if (timer) clearTimeout(timer);
                    timer = setTimeout(() => {
                        const current = accountSettingsOf(useFlowStore.getState());
                        const patch = changedAccountSettings(synced, current);
                        synced = current;
                        push(patch);
                    }, ACCOUNT_SETTINGS_PUSH_DEBOUNCE_MS);
                });
            } catch {
                // Signed out or offline - local settings stay authoritative.
            }
        })();

        return () => {
            cancelled = true;
            unsubscribe?.();
            if (timer) clearTimeout(timer);
        };
    }, []);
}
