import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTap, openAPI, magicLink, anonymous } from "better-auth/plugins";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
import { getDBFromContext } from "../database/context";
import * as schema from "../database/schema";
import { Resend } from "resend";
import { APP_NAME, APP_EMAIL, APP_ORIGIN, NEXT_PUBLIC_BASE_URL } from "../config/site";
import { buildAllowedHosts, buildTrustedOrigins } from "./hosts";
import { getEnv } from "../env";

/**
 * Providers are only registered when both halves of their credential pair are
 * present. Registering google with `clientId: undefined` (the previous
 * behaviour when the secret was missing) leaves better-auth advertising a
 * provider that can only fail — including the One Tap callback, which verifies
 * the Google id token against the configured client id.
 */
function buildSocialProviders() {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

  const pairs: [string, string, string][] = [
    ["google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    ["discord", "AUTH_DISCORD_ID", "AUTH_DISCORD_SECRET"],
    ["linkedin", "AUTH_LINKEDIN_ID", "AUTH_LINKEDIN_SECRET"],
  ];

  for (const [provider, idKey, secretKey] of pairs) {
    const clientId = getEnv(idKey);
    const clientSecret = getEnv(secretKey);
    if (clientId && clientSecret) {
      socialProviders[provider] = { clientId, clientSecret };
    }
  }

  return socialProviders;
}

async function buildAuth() {
  const db = await getDBFromContext();

  // An explicitly configured URL, when there is one. It is no longer the only
  // origin this instance answers on — see `baseURL` below — but it still wins
  // as the fallback and is always allowed.
  const configuredBaseURL =
    getEnv("BETTER_AUTH_URL") ||
    getEnv("NEXT_PUBLIC_APP_URL") ||
    getEnv("NEXT_PUBLIC_BASE_URL") ||
    NEXT_PUBLIC_BASE_URL ||
    undefined;

  // Hosts this deployment answers on (lib/auth/hosts.ts), extendable via
  // BETTER_AUTH_ALLOWED_HOSTS.
  const allowedHosts = buildAllowedHosts({
    configuredBaseURL,
    extraHosts: getEnv("BETTER_AUTH_ALLOWED_HOSTS"),
  });

  // Extra origin patterns for the CSRF origin check, on top of the ones
  // better-auth derives from `allowedHosts`. Comma-separated additions can be
  // supplied via BETTER_AUTH_TRUSTED_ORIGINS.
  const trustedOrigins = buildTrustedOrigins({
    configuredBaseURL,
    extraOrigins: getEnv("BETTER_AUTH_TRUSTED_ORIGINS"),
  });

  return betterAuth({
    // Resolved per request against `allowedHosts` rather than pinned to one
    // origin. A single string here (or leaving it unset, which makes
    // better-auth latch onto whichever host happened to warm the Worker
    // isolate first) means every request arriving on any other domain this app
    // is served from is rejected by the CSRF origin check with a 403 "Invalid
    // origin" before it reaches the sign-in handler — which is what broke
    // Google sign-in, and so /admin, on ebate.app. Resolving per request also
    // keeps the OAuth callback, the session cookie and magic links on the
    // domain the visitor is actually using.
    baseURL: {
      allowedHosts,
      // Used when the host is missing (a direct `auth.api` call with no
      // headers) or not allowlisted; the origin check then rejects the
      // unknown host, which is the intended answer.
      fallback: configuredBaseURL || APP_ORIGIN,
    },
    trustedOrigins,
    advanced: {
      // Per-request base URLs are derived from the Host header, and better-auth
      // prefers `x-forwarded-host` over it whenever proxy headers are trusted —
      // which it does by default. Nothing sits in front of this Worker to set
      // that header, so an attacker could supply their own and have the magic
      // link we email built for their domain. Cloudflare routes on Host, so
      // taking the host from the request itself is both correct and forgeable
      // only by someone who already controls a routed hostname.
      trustedProxyHeaders: false,
    },
    secret: getEnv("BETTER_AUTH_SECRET") || "dev-secret-change-in-production",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    socialProviders: buildSocialProviders(),
    // A visitor can reach this app through several sign-in methods that share
    // one email (Google, Discord, LinkedIn, magic link), and the same person
    // is expected to end up as one account. By default better-auth refuses to
    // link a new provider onto an existing account unless that account's
    // local `emailVerified` flag is already true — and Discord's own profile
    // response doesn't always report a verified email, so an account created
    // there stays unverified and every later sign-in attempt for the same
    // person (Google One Tap included) fails closed with a 401 "account not
    // linked" error, even though the incoming identity is independently
    // verified. Every method this app offers already proves control of the
    // email out of band (an OAuth provider you're logged into, or a magic
    // link sent to the inbox), so relaxing this is safe here.
    account: {
      accountLinking: {
        enabled: true,
        requireLocalEmailVerified: false,
        trustedProviders: ["google", "discord", "linkedin"],
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
    },
    plugins: [
      oneTap(),
      openAPI(),
      anonymous(),
      // Lets the native-wrapper desktop/mobile shell (packages/native-wrapper)
      // hand off a session established in the system browser (required for
      // Google OAuth, which blocks embedded webviews) to the wrapper's own
      // webview: /auth/native-complete mints a short-lived, single-use token
      // from the browser session, the wrapper's deep link carries it back
      // in-app, and /auth/native-callback spends it to set the session
      // cookie there. See packages/native-wrapper/docs/OAUTH.md.
      oneTimeToken({
        expiresIn: 5,
        storeToken: "hashed",
      }),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          const resendKey = getEnv("RESEND_API_KEY") || getEnv("AUTH_RESEND_KEY");
          if (!resendKey) {
            console.log(`[dev] Magic link for ${email}: ${url}`);
            return;
          }
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: `${APP_NAME} <${APP_EMAIL}>`,
            to: email,
            subject: `Sign in to ${APP_NAME}`,
            html: `<p>Click the link below to sign in to ${APP_NAME}:</p><p><a href="${url}">Sign in</a></p><p>This link expires in 5 minutes.</p>`,
          });
        },
        expiresIn: 300,
        disableSignUp: false,
      }),
    ],
  });
}

// Lazy singleton
let authInstance: Awaited<ReturnType<typeof buildAuth>> | null = null;

export async function getAuth() {
  if (!authInstance) {
    authInstance = await buildAuth();
  }
  return authInstance;
}

// Keep initAuth for backwards compatibility
export async function initAuth() {
  return getAuth();
}
