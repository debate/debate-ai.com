/**
 * @fileoverview Network calls for the User Settings D1 sync (TODO.md idea
 * #17, first slice, plus follow-up (2)'s `colorTheme`/`themeMode` fields).
 * Kept separate from `state/userSettings.ts`'s pure validation/merge
 * helpers so those stay unit-testable without mocking `fetch`, mirroring
 * `round/judge-decision-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/settings` route, which requires an
 * authenticated session — `fetchUserSettings` resolves to `null` (rather
 * than throwing) on a `401`, letting the caller fall back to the local
 * `settings`/theme-dropdown stores for signed-out users instead of showing
 * an error. `debate-round`'s `UserSettingsPanel` and `theme-dropdown.tsx`'s
 * `useThemeState` (both in `apps/debate-ai.com`) share these two functions
 * rather than each having their own client, since both read/write the same
 * `/api/settings` row.
 *
 * @module round/user-settings-client
 */

import type { UserSettingsPayload } from "../state/userSettings";
import type { ThemeSettingsPayload } from "../state/themeSettings";
import type { FavoriteToolOp, FavoriteToolsPayload } from "../state/favoriteTools";
import type { WordLimitPresetOp, WordLimitPresetsPayload } from "../state/wordLimitPresets";
import type { OutlineFilterPresetOp, OutlineFilterPresetsPayload } from "../state/outlineFilterPresets";

/** The full shape `/api/settings` reads/writes — app preferences, the theme fields (idea #17, follow-up (2)), the favorite-tools list (idea #17, "integrate tools into user settings" follow-up), the custom word-limit presets list (idea #2's "per-style word-limit preset manager" follow-up), and the named Outline filter presets list (idea #10's "Save and reuse named filter presets" follow-up). The News Stream read/liked id lists (`packages/debate-help-docs/content/docs/internals/news-stream.mdx`'s "Read/like state is per-browser" Known gap) are typed separately by `debate-community` to avoid a package cycle (`debate-team-collaboration` already depends on this package) — the `/api/settings` route still reads/writes them on the same row. */
export type FullUserSettingsPayload = UserSettingsPayload &
  ThemeSettingsPayload &
  FavoriteToolsPayload &
  WordLimitPresetsPayload &
  OutlineFilterPresetsPayload;

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetches the current user's saved settings. Returns `null` when signed
 * out (a `401` response) rather than throwing, since that's an expected,
 * recoverable state for this panel.
 */
export async function fetchUserSettings(
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  return (await res.json()) as FullUserSettingsPayload;
}

/**
 * Saves a settings patch for the current user. Throws (with the server's
 * `{ error }` message when present) on a `401`/`400`/other failure — the
 * caller is expected to have already applied the change locally, so a
 * failed account sync is reported but not fatal to the UI.
 */
export async function saveUserSettings(
  patch: Partial<FullUserSettingsPayload>,
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(patch, endpoint);
}

/**
 * Saves a single star/unstar op — `{ addFavoriteTool }` or
 * `{ removeFavoriteTool }` — instead of a whole-list `favoriteTools`
 * replace. The route resolves it against the account's currently stored
 * list rather than the caller's own (possibly stale) copy, closing the
 * "two tabs star different tools in quick succession" lost-update gap
 * `saveUserSettings({ favoriteTools })` is exposed to — see
 * `state/favoriteTools.ts#applyFavoriteToolOp`'s docstring.
 */
export async function saveFavoriteToolOp(
  op: FavoriteToolOp,
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(op, endpoint);
}

/**
 * Saves a single "just opened this tool" op — `{ recordRecentTool }` —
 * instead of a whole-list `recentTools` replace, for the same lost-update
 * reason `saveFavoriteToolOp` avoids one. The `recentTools` field itself
 * (validation, serialization, the op type) lives in `apps/debate-ai.com`'s
 * `lib/recentTools.ts` rather than this package — see that file's header —
 * so the op shape is inlined here rather than imported.
 */
export async function saveRecentToolOp(
  op: { recordRecentTool: string },
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(op, endpoint);
}

/**
 * Saves a single add/update/remove op — `{ addWordLimitPreset }`,
 * `{ updateWordLimitPreset }` or `{ removeWordLimitPreset }` — instead of a
 * whole-list `wordLimitPresets` replace. The route resolves it against the
 * account's currently stored list rather than the caller's own (possibly
 * stale) copy, closing the same "two tabs/devices edit presets at once"
 * lost-update gap `saveFavoriteToolOp` already closed for `favoriteTools` —
 * see `state/wordLimitPresets.ts#applyWordLimitPresetOp`'s docstring.
 */
export async function saveWordLimitPresetOp(
  op: WordLimitPresetOp,
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(op, endpoint);
}

/**
 * Saves a single add/remove op — `{ addOutlineFilterPreset }` or
 * `{ removeOutlineFilterPreset }` — instead of a whole-list
 * `outlineFilterPresets` replace. The route resolves it against the
 * account's currently stored list rather than the caller's own (possibly
 * stale) copy, closing the same "two tabs/devices edit presets at once"
 * lost-update gap `saveWordLimitPresetOp` already closed for
 * `wordLimitPresets` — see
 * `state/outlineFilterPresets.ts#applyOutlineFilterPresetOp`'s docstring.
 */
export async function saveOutlineFilterPresetOp(
  op: OutlineFilterPresetOp,
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(op, endpoint);
}

/**
 * Saves a single "mark read" op — `{ recordNewsRead }` — instead of a
 * whole-list `newsRead` replace, for the same lost-update reason
 * `saveFavoriteToolOp` avoids one. The News Stream fields (validation,
 * serialization, the op types) live in `debate-community` rather than this
 * package — see `FullUserSettingsPayload`'s doc comment above — so the op
 * shape is inlined here rather than imported, mirroring
 * `saveRecentToolOp`'s own out-of-package field.
 */
export async function saveNewsReadOp(
  op: { recordNewsRead: string },
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(op, endpoint);
}

/**
 * Saves a single like/unlike op — `{ addNewsLiked }` or
 * `{ removeNewsLiked }` — instead of a whole-list `newsLiked` replace, the
 * same lost-update fix `saveNewsReadOp` above closes for `newsRead`.
 */
export async function saveNewsLikedOp(
  op: { addNewsLiked: string } | { removeNewsLiked: string },
  endpoint = "/api/settings",
): Promise<FullUserSettingsPayload> {
  return putSettingsPatch(op, endpoint);
}

async function putSettingsPatch(patch: unknown, endpoint: string): Promise<FullUserSettingsPayload> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
  return (await res.json()) as FullUserSettingsPayload;
}
