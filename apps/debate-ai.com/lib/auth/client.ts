"use client";

import { createAuthClient } from "better-auth/react";
import {
  oneTapClient,
  magicLinkClient,
  anonymousClient,
  oneTimeTokenClient,
} from "better-auth/client/plugins";
import {
  APP_ORIGIN,
  NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID,
} from "../config/site";
import { ONE_TAP_CLIENT_OPTIONS } from "./one-tap";

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

/** Create an auth client with the Google client id available at that moment. */
export function createAppAuthClient(
  googleClientId = NEXT_PUBLIC_GOOGLE_CLIENT_ID,
) {
  return createAuthClient({
    baseURL,
    plugins: [
      // The Google client id may arrive after page load from
      // /api/auth/providers, so callers that need One Tap should create an
      // auth client after that lookup resolves instead of relying on the
      // build-time fallback. GOOGLE_CLIENT_ID is a Worker secret and is never
      // inlined into the browser bundle. The rest of the One Tap settings live
      // in ./one-tap, which explains why FedCM leaves so little to configure.
      oneTapClient({
        ...ONE_TAP_CLIENT_OPTIONS,
        clientId: googleClientId,
      }),
      magicLinkClient(),
      anonymousClient(),
      oneTimeTokenClient(),
    ],
  });
}

export const authClient = createAppAuthClient();
