"use client";

import { createAuthClient } from "better-auth/react";
import { oneTapClient, magicLinkClient, anonymousClient } from "better-auth/client/plugins";
import { APP_ORIGIN, NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID } from "../config/site";

// Always talk to the origin the page was served from. The app ships its own
// /api/auth routes on every deployment (debate-ai.com, preview builds,
// localhost), so a hardcoded baseURL sent auth requests to a different host —
// in production it resolved to the build-time default, http://localhost:3000,
// which meant every sign-in, session lookup and One Tap callback failed.
// NEXT_PUBLIC_BASE_URL is only the SSR fallback, where `window` is undefined.
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : NEXT_PUBLIC_BASE_URL || APP_ORIGIN;

// The one-tap plugin reads `clientId` off this object when the prompt is
// triggered, not when the client is created, so the id can be filled in at
// runtime from /api/auth/providers. That is how the browser gets it at all:
// GOOGLE_CLIENT_ID is a Worker secret and is never inlined into the bundle.
const oneTapOptions = {
  clientId: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  additionalOptions: {
    use_fedcm_for_prompt: false,
  },
};

/** Supply the Google client id resolved at runtime. No-op for a blank id. */
export function setGoogleClientId(clientId: string) {
  if (clientId) oneTapOptions.clientId = clientId;
}

/** Whether One Tap has a client id to prompt with. */
export function hasGoogleClientId() {
  return Boolean(oneTapOptions.clientId);
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [oneTapClient(oneTapOptions), magicLinkClient(), anonymousClient()],
});
