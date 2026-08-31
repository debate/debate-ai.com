/**
 * @fileoverview Network calls for account-synced settings — hits the app's
 * D1-backed `/api/settings` route. Kept separate from `useAccountSettings`
 * (the hook that drives it) so these fetch calls can be unit-tested without
 * mocking React, mirroring `flow/flow-sync-client.ts`'s identical split.
 *
 * @module state/settings-client
 */

import { isValidSettingsData, type SettingsSyncData } from "./savedSettings";

const DEFAULT_ENDPOINT = "/api/settings";

export type AccountSettingsResponse = {
  /** Whether the request carried a signed-in session at all. */
  signedIn: boolean;
  /** The account's saved settings, or `null` if signed out or none saved yet. */
  data: SettingsSyncData | null;
};

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? "";
  } catch {
    return "";
  }
}

/**
 * Fetches the current user's synced settings. Never throws for "signed
 * out" — that's a normal `{ signedIn: false, data: null }` response, not a
 * failure — only a genuinely failed request throws.
 */
export async function fetchAccountSettings(
  endpoint = DEFAULT_ENDPOINT,
): Promise<AccountSettingsResponse> {
  const res = await fetch(endpoint);

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Fetching account settings failed (${res.status}).`);
  }

  const json = (await res.json()) as Partial<AccountSettingsResponse>;
  return {
    signedIn: json.signedIn === true,
    data: isValidSettingsData(json.data) ? json.data : null,
  };
}

/**
 * Pushes the local settings snapshot to the account, overwriting whatever
 * was saved before. Throws a plain `Error` with a useful message on a
 * non-OK response (including 401 when the caller isn't signed in) — the
 * caller is expected to treat this as best-effort and swallow the error
 * rather than surface it as a hard failure.
 */
export async function pushAccountSettings(
  data: SettingsSyncData,
  endpoint = DEFAULT_ENDPOINT,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new Error(detail || `Saving account settings failed (${res.status}).`);
  }
}
