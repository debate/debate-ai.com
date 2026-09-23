/**
 * The pure parts of the sign-in handoff: the names the two halves agree on,
 * and reading the one-time token back out of the sign-in tab's URL.
 *
 * Split out of ./session so it can be tested without a `browser` global, and
 * because this is the seam where the extension trusts something: it is reading
 * a credential out of a URL. See ./session for the whole round trip.
 */

/**
 * Fragment key `/auth/extension-complete` parks the one-time token under.
 *
 * Must match `EXTENSION_TOKEN_HASH_KEY` in
 * apps/debate-ai.com/lib/config/site.ts.
 */
export const TOKEN_HASH_KEY = 'debate_ai_ext_token';

/**
 * Path `/login` is told to send the sign-in tab to once the provider returns.
 *
 * Must match `EXTENSION_CALLBACK_PATH` in the same file.
 */
export const EXTENSION_CALLBACK_PATH = '/auth/extension-complete';

/**
 * The one-time token carried in a sign-in tab's URL, or `null` if it has not
 * arrived yet.
 *
 * Only a fragment is read, never the query string: a fragment is not sent to
 * any server, so the token never appears in a request log on the way past.
 */
export function readTokenFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const token = new URLSearchParams(url.slice(hashIndex + 1)).get(TOKEN_HASH_KEY);
  return token?.trim() ? token : null;
}
