/**
 * Network side of the flow-editor account sync: one fetch on mount, then a
 * debounced PUT of whatever synced setting changed. Local-first - the store has
 * already applied every change before anything here runs, and a signed-out
 * browser (a `401`), an offline one or a failed request simply stays local.
 */

import {
    diffSyncedSettings,
    parseFlowEditorSettings,
    pickSyncedSettings,
    type FlowEditorSettings,
} from "./accountSettings";

const ENDPOINT = "/api/settings";
const PUSH_DEBOUNCE_MS = 1000;

/** The account's synced settings, or `null` when signed out or unreachable. */
export async function fetchFlowEditorSettings(endpoint = ENDPOINT): Promise<FlowEditorSettings | null> {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const payload = (await res.json()) as { flowEditorSettings?: unknown };
    return parseFlowEditorSettings(JSON.stringify(payload.flowEditorSettings ?? {}));
}

/** Saves a patch; resolves `false` (never throws) when the account rejected or could not be reached. */
export async function saveFlowEditorSettings(patch: FlowEditorSettings, endpoint = ENDPOINT): Promise<boolean> {
    try {
        const res = await fetch(endpoint, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ flowEditorSettings: patch }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

/** The slice of the store the sync reads and writes; `useFlowStore` satisfies it. */
export interface SyncableStore {
    getState(): { applyAccountSettings(patch: Record<string, unknown>): void };
    subscribe(listener: () => void): () => void;
}

/**
 * Starts the sync and returns its stop function. The account wins on load; an
 * account with nothing saved is seeded from this browser instead, so the first
 * device's settings are not lost to an empty row.
 */
export function startFlowSettingsSync(store: SyncableStore, endpoint = ENDPOINT): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: FlowEditorSettings = pickSyncedSettings(store.getState());

    const push = () => {
        const current = pickSyncedSettings(store.getState());
        const patch = diffSyncedSettings(last, current);
        if (Object.keys(patch).length === 0) return;
        const before = last;
        last = current;
        void saveFlowEditorSettings(patch, endpoint).then((ok) => {
            if (ok) return;
            // Roll the baseline back for the unsaved keys so the next change retries them.
            const rolledBack = { ...last };
            for (const key of Object.keys(patch)) {
                if (key in before) rolledBack[key] = before[key];
                else delete rolledBack[key];
            }
            last = rolledBack;
        });
    };

    const unsubscribe = store.subscribe(() => {
        if (stopped) return;
        clearTimeout(timer);
        timer = setTimeout(push, PUSH_DEBOUNCE_MS);
    });

    void fetchFlowEditorSettings(endpoint)
        .then((account) => {
            if (stopped || account === null) return;
            if (Object.keys(account).length > 0) {
                store.getState().applyAccountSettings(account);
                last = pickSyncedSettings(store.getState());
            } else {
                void saveFlowEditorSettings(last, endpoint);
            }
        })
        .catch(() => undefined);

    return () => {
        stopped = true;
        clearTimeout(timer);
        unsubscribe();
    };
}
