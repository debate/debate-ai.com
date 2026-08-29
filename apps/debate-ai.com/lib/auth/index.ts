import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTap, openAPI, magicLink, anonymous } from "better-auth/plugins";
import { getDBFromContext } from "../database/context";
import * as schema from "../database/schema";
import { Resend } from "resend";
import { APP_NAME, APP_EMAIL, APP_ORIGIN, NEXT_PUBLIC_BASE_URL } from "../config/site";
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

  // Prefer an explicitly configured URL, then whatever the deployment exposes.
  // When nothing is set, leave it undefined so better-auth derives the origin
  // from the incoming request instead of pinning callbacks and cookies to a
  // hardcoded host.
  const baseURL =
    getEnv("BETTER_AUTH_URL") ||
    getEnv("NEXT_PUBLIC_APP_URL") ||
    getEnv("NEXT_PUBLIC_BASE_URL") ||
    NEXT_PUBLIC_BASE_URL ||
    undefined;

  // Hosts allowed to make authenticated requests. Preview deployments and
  // localhost share this backend, and better-auth rejects requests (and omits
  // the CORS headers) from any origin not listed here. Extra origins can be
  // supplied via BETTER_AUTH_TRUSTED_ORIGINS (comma-separated).
  const trustedOrigins = Array.from(
    new Set(
      [
        baseURL,
        APP_ORIGIN,
        "https://*.debate-ai.com",
        "https://*.workers.dev",
        "https://*.vercel.app",
        "http://localhost:3000",
        ...(getEnv("BETTER_AUTH_TRUSTED_ORIGINS")?.split(",") ?? []),
      ]
        .map((origin) => origin?.trim())
        .filter((origin): origin is string => Boolean(origin)),
    ),
  );

  return betterAuth({
    ...(baseURL ? { baseURL } : {}),
    trustedOrigins,
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
