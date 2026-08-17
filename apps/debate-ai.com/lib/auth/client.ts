"use client";

import { createAuthClient } from "better-auth/react";
import { oneTapClient, magicLinkClient, anonymousClient } from "better-auth/client/plugins";
import { NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID } from "../config/site";

// Use the current browser origin so auth requests are always same-origin.
// The app ships its own /api/auth routes on every deployment (debate-ai.com,
// preview builds, localhost), so pinning a single baseURL sent requests from
// any other host cross-origin, where they fail the CORS preflight. Worse, when
// NEXT_PUBLIC_APP_URL is unset at build time NEXT_PUBLIC_BASE_URL falls back to
// http://localhost:3000, which made the deployed client post One Tap
// credentials at localhost. Fall back to the configured base URL during SSR,
// where `window` is undefined.
const baseURL =
  typeof window !== "undefined" ? window.location.origin : NEXT_PUBLIC_BASE_URL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    oneTapClient({
      clientId: NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      additionalOptions: {
        use_fedcm_for_prompt: false,
      },
    }),
    magicLinkClient(),
    anonymousClient(),
  ],
});
