export const APP_NAME = "Debate AI";
export const APP_EMAIL = "noreply@debate-ai.com";

/** Terms & Privacy Last Revised Date */
export const LAST_REVISED_DATE = "2026-08-26";

/** Canonical production origin — used as the SSR fallback for auth requests. */
export const APP_ORIGIN = "https://debate-ai.com";

// Only set when configured at build time. Empty means "derive it from the
// incoming request" — the previous `http://localhost:3000` default was baked
// into the production bundle, which pointed every browser auth call at the
// user's own machine.
export const NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";

// Build-time default for Google One Tap. Only `NEXT_PUBLIC_*` variables are
// inlined into the browser bundle — `GOOGLE_CLIENT_ID` is a Worker secret and
// resolves to `undefined` on the client, so reading it here produced an empty
// client id and One Tap never initialized. When this is unset at build time the
// client falls back to the id served at runtime by `/api/auth/providers`.
export const NEXT_PUBLIC_GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// Custom URL scheme the native-wrapper desktop/mobile shell registers with the
// OS (packages/native-wrapper/profiles/debate-ai.json's `deepLinkScheme`) so
// /auth/native-complete can hand a browser-established session back to the
// wrapper's webview. Keep these two values in sync.
export const NATIVE_DEEP_LINK_SCHEME = "debateai";

// Chrome Web Store extension id of apps/debate-web-ext. It is derived from the
// public `key` pinned in that extension's manifest (apps/debate-web-ext/wxt.config.ts),
// so it is stable across rebuilds and across the stores — which is what lets
// the origin be allowlisted here rather than trusting `chrome-extension://*`,
// i.e. every extension the visitor has installed. Keep the two in sync.
export const EXTENSION_ID = "noecbaibfhbmpapofcdkgchfifmoinfj";

/** The extension's own origin, as the browser sends it on its requests. */
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;

/**
 * Where /login sends the extension's sign-in tab once the provider returns —
 * see app/auth/extension-complete, and apps/debate-web-ext/src/auth/session.ts
 * for the other half of the handoff.
 */
export const EXTENSION_CALLBACK_PATH = "/auth/extension-complete";

/**
 * Fragment key `/auth/extension-complete` parks the one-time token under, and
 * which the extension watches its own sign-in tab's URL for.
 */
export const EXTENSION_TOKEN_HASH_KEY = "debate_ai_ext_token";
