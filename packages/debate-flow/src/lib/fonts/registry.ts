/**
 * Font registry — single source of truth for the curated flow-font lineup.
 *
 * Each entry's `cssVar` is the CSS variable emitted by the matching
 * `next/font/local` declaration in `src/app/layout.tsx`. The selected flow
 * font is applied by writing one of these `cssVar` strings to `--font-flow`.
 */

export type FontId =
    | "commit-mono"
    | "plex-mono"
    | "pretendard"
    | "dm-sans"
    | "plex-sans"
    | "cabin"
    | "lato"
    | "open-sans";
export type FontCategory = "mono" | "sans";

export interface FontOption {
    id: FontId;
    label: string;
    cssVar: string;
    category: FontCategory;
}

export const FONTS: FontOption[] = [
    {
        id: "commit-mono",
        label: "Commit Mono",
        cssVar: "var(--font-commit-mono)",
        category: "mono",
    },
    {
        id: "plex-mono",
        label: "IBM Plex Mono",
        cssVar: "var(--font-ibm-plex-mono)",
        category: "mono",
    },
    {
        id: "pretendard",
        label: "Pretendard",
        cssVar: "var(--font-pretendard)",
        category: "sans",
    },
    {
        id: "dm-sans",
        label: "DM Sans",
        cssVar: "var(--font-dm-sans)",
        category: "sans",
    },
    {
        id: "plex-sans",
        label: "IBM Plex Sans",
        cssVar: "var(--font-ibm-plex-sans)",
        category: "sans",
    },
    {
        id: "cabin",
        label: "Cabin",
        cssVar: "var(--font-cabin)",
        category: "sans",
    },
    {
        id: "lato",
        label: "Lato",
        cssVar: "var(--font-lato)",
        category: "sans",
    },
    {
        id: "open-sans",
        label: "Open Sans",
        cssVar: "var(--font-open-sans)",
        category: "sans",
    },
];

export const DEFAULT_FONT_ID: FontId = "pretendard";

const BY_ID: Record<FontId, FontOption> = Object.fromEntries(FONTS.map((f) => [f.id, f])) as Record<
    FontId,
    FontOption
>;

export function isFontId(value: unknown): value is FontId {
    return typeof value === "string" && value in BY_ID;
}

export function resolveFontId(value: unknown): FontId {
    return isFontId(value) ? value : DEFAULT_FONT_ID;
}

export function fontCssVar(id: FontId): string {
    return BY_ID[id].cssVar;
}

export function fontLabel(id: FontId): string {
    return BY_ID[id].label;
}

const BY_LABEL: Record<string, FontId> = Object.fromEntries(
    FONTS.map((f) => [f.label.toLowerCase(), f.id]),
);

/**
 * Resolves a config-file font value to a FontId. Accepts the human font name
 * ("DM Sans", case-insensitive) that config.toml exposes, and falls back to a
 * bare FontId for older files that stored the internal id.
 */
export function resolveFontName(value: unknown): FontId {
    if (typeof value === "string") {
        const byLabel = BY_LABEL[value.trim().toLowerCase()];
        if (byLabel) return byLabel;
        if (isFontId(value)) return value;
    }
    return DEFAULT_FONT_ID;
}
