import { DEFAULT_UPDATE_CONFIG, type UpdateConfig } from "./types";

const UPDATE_SETTINGS_KEY = "df-update-settings";

/** Loads the persisted update config, merged over defaults (SSR-safe). */
export function loadUpdateConfig(): UpdateConfig {
    if (typeof window === "undefined") return { ...DEFAULT_UPDATE_CONFIG };
    try {
        const raw = window.localStorage.getItem(UPDATE_SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_UPDATE_CONFIG };
        const parsed = JSON.parse(raw) as Partial<UpdateConfig>;
        return {
            autoCheckEnabled: parsed.autoCheckEnabled ?? DEFAULT_UPDATE_CONFIG.autoCheckEnabled,
        };
    } catch {
        return { ...DEFAULT_UPDATE_CONFIG };
    }
}

/** Persists the update config (SSR-safe; failures swallowed, local-first). */
export function saveUpdateConfig(config: UpdateConfig): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(UPDATE_SETTINGS_KEY, JSON.stringify(config));
    } catch {
        // best effort
    }
}
