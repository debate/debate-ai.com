/**
 * @fileoverview Shared `debate-api-client` instance for this package's
 * network calls. Configured with a relative `baseUrl` (rather than the
 * SDK's absolute-origin default) since every caller of this package today
 * is the Next.js app itself, calling its own same-origin `/api/*` routes.
 *
 * @module lib/api-client
 */

import { createClient } from "debate-api-client";

export const apiClient = createClient({ baseUrl: "/api" });

/**
 * Extracts the HTTP status code from a `debate-api-client` error string
 * (e.g. `"HTTP error: 401 Unauthorized"`), so 401/404 responses can still be
 * told apart from other failures now that the client throws before the
 * response body is readable.
 */
export function httpStatus(error: string | undefined): number | undefined {
  const match = error?.match(/^HTTP error: (\d+)/);
  return match ? Number(match[1]) : undefined;
}
