export const APP_NAME = "Debate AI";
export const APP_EMAIL = "noreply@debate-ai.com";

export const NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Only NEXT_PUBLIC_* vars are inlined into the client bundle, so the public
// name has to come first — GOOGLE_CLIENT_ID is a server-only secret and is
// always undefined in browser code. It stays as a server-side fallback.
export const NEXT_PUBLIC_GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
