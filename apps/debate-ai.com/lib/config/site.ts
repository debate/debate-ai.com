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
