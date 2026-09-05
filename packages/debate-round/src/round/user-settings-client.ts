/**
 * @fileoverview Network calls for the User Settings D1 sync (TODO.md idea
 * #17, first slice, plus follow-up (2)'s `colorTheme`/`themeMode` fields).
 * Kept separate from `state/userSettings.ts`'s pure validation/merge
 * helpers so those stay unit-testable without mocking the API client,
 * mirroring `round/judge-decision-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/settings` route (via
 * `debate-api-client`), which requires an authenticated session —
 * `fetchUserSettings` resolves to `null` (rather than throwing) on a `401`,
 * letting the caller fall back to the local `settings`/theme-dropdown
 * stores for signed-out users instead of showing an error. `debate-round`'s
 * `UserSettingsPanel` and `theme-dropdown.tsx`'s `useThemeState` (both in
 * `apps/debate-ai.com`) share these two functions rather than each having
 * their own client, since both read/write the same `/api/settings` row.
 *
 * @module round/user-settings-client
 */

import { getUserSettings, updateUserSettings, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { UserSettingsPayload } from "../state/userSettings";
import type { ThemeSettingsPayload } from "../state/themeSettings";
import type { FavoriteToolsPayload } from "../state/favoriteTools";
import type { WordLimitPresetsPayload } from "../state/wordLimitPresets";
import type { OutlineFilterPresetsPayload } from "../state/outlineFilterPresets";
import type { NewsSyncPayload } from "debate-card-search";

/** The full shape `/api/settings` reads/writes — app preferences, the theme fields (idea #17, follow-up (2)), the favorite-tools list (idea #17, "integrate tools into user settings" follow-up), the custom word-limit presets list (idea #2's "per-style word-limit preset manager" follow-up), the named Outline filter presets list (idea #10's "Save and reuse named filter presets" follow-up), and the News Stream read/liked id lists (`docs/features/news-stream.md`'s "Read/like state is per-browser" Known gap). */
export type FullUserSettingsPayload = UserSettingsPayload &
  ThemeSettingsPayload &
  FavoriteToolsPayload &
  WordLimitPresetsPayload &
  OutlineFilterPresetsPayload &
  NewsSyncPayload;

/**
 * Fetches the current user's saved settings. Returns `null` when signed
 * out (a `401` response) rather than throwing, since that's an expected,
 * recoverable state for this panel.
 */
export async function fetchUserSettings(client: Client = apiClient): Promise<FullUserSettingsPayload | null> {
  const { data, error } = await getUserSettings({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load account settings.");
  }
  return data as FullUserSettingsPayload;
}

/**
 * Saves a settings patch for the current user. Throws on a `401`/`400`/other
 * failure — the caller is expected to have already applied the change
 * locally, so a failed account sync is reported but not fatal to the UI.
 */
export async function saveUserSettings(
  patch: Partial<FullUserSettingsPayload>,
  client: Client = apiClient,
): Promise<FullUserSettingsPayload> {
  const { data, error } = await updateUserSettings({ body: patch }, { client });
  if (error) {
    throw new Error("Failed to save account settings.");
  }
  return data as FullUserSettingsPayload;
}
