export type ThemeMode = "light" | "dark" | "system";

const MODES: ThemeMode[] = ["light", "dark", "system"];

/** Falls back to "system" for missing or invalid persisted values. */
export function resolveThemeMode(value: unknown): ThemeMode {
    return MODES.includes(value as ThemeMode) ? (value as ThemeMode) : "system";
}

/** "system" resolves against the OS's prefers-color-scheme match. */
export function resolveMode(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return prefersDark ? "dark" : "light";
}
