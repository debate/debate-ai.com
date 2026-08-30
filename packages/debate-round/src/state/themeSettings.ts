/**
 * @fileoverview Account-linked color-theme/light-dark preference — TODO.md
 * idea #17 ("User Settings — account-linked debate preferences"), follow-up
 * (2). Pure validation/merge helpers shared by the `/api/settings` D1-backed
 * route (`apps/debate-ai.com`) and `components/theme-dropdown.tsx`'s
 * `useThemeState` hook, mirroring `state/userSettings.ts`'s split so both
 * sides validate a patch identically.
 *
 * `THEME_NAMES` is the single source of truth for which color-theme values
 * are valid — `theme-dropdown.tsx` re-exports it instead of keeping its own
 * copy, so the picker UI and the account-sync validator can never drift.
 *
 * @module state/themeSettings
 */

/** Registry of all available colour theme names. Mirrors the theme CSS classes in `app/themes.css`. */
export const THEME_NAMES = [
  "modern-minimal",
  "elegant-luxury",
  "cyberpunk",
  "twitter",
  "mocha-mousse",
  "amethyst-haze",
  "notebook",
  "doom-64",
  "catppuccin",
  "graphite",
  "perpetuity",
  "kodama-grove",
  "cosmic-night",
  "tangerine",
  "nature",
  "bold-tech",
  "amber-minimal",
  "supabase",
  "neo-brutalism",
  "quantum-rose",
  "solar-dusk",
  "bubblegum",
  "pink-lemonade",
  "claymorphism",
  "pastel-dreams",
] as const;

/** Valid `next-themes` mode values — matches what `ThemeProvider`'s `attribute="class"` setup accepts. */
export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export type ThemeSettingsPayload = {
  colorTheme: string;
  themeMode: ThemeMode;
};

/** Mirrors `app/layout.tsx`'s `<ThemeProvider defaultTheme="light">` and `theme-dropdown.tsx`'s local-storage fallback. */
export const DEFAULT_THEME_SETTINGS: ThemeSettingsPayload = {
  colorTheme: "modern-minimal",
  themeMode: "light",
};

export function isValidColorTheme(value: unknown): value is string {
  return typeof value === "string" && (THEME_NAMES as readonly string[]).includes(value);
}

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

export type ThemeSettingsPatchResult = {
  /** Only the fields present in `input` *and* valid. */
  valid: Partial<ThemeSettingsPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch against
 * `THEME_NAMES`/`THEME_MODES`. Unknown/extra fields are ignored; a
 * present-but-invalid field is dropped into `errors` rather than silently
 * clamped, matching `normalizeUserSettingsPatch`'s convention.
 */
export function normalizeThemeSettingsPatch(input: unknown): ThemeSettingsPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<ThemeSettingsPayload> = {};
  const errors: string[] = [];

  if ("colorTheme" in record) {
    if (isValidColorTheme(record.colorTheme)) {
      valid.colorTheme = record.colorTheme;
    } else {
      errors.push(`"colorTheme" must be one of: ${THEME_NAMES.join(", ")}.`);
    }
  }

  if ("themeMode" in record) {
    if (isValidThemeMode(record.themeMode)) {
      valid.themeMode = record.themeMode;
    } else {
      errors.push(`"themeMode" must be one of: ${THEME_MODES.join(", ")}.`);
    }
  }

  return { valid, errors };
}
