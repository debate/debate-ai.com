import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTap, openAPI, magicLink, anonymous } from "better-auth/plugins";
import { getDBFromContext } from "../database/context";
import * as schema from "../database/schema";
import { Resend } from "resend";
import { APP_NAME, APP_EMAIL, NEXT_PUBLIC_BASE_URL } from "../config/site";
import { getEnv } from "../env";

async function buildAuth() {
  const db = await getDBFromContext();

  // Only register a provider once both halves of its credential pair are
  // present. Passing an undefined clientId/clientSecret through made
  // better-auth throw during init, which took down every /api/auth/* route —
  // including the One Tap callback — rather than just that one provider.
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

  const googleClientId = getEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  if (googleClientId && googleClientSecret) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  }

  const discordClientId = getEnv("AUTH_DISCORD_ID");
  const discordClientSecret = getEnv("AUTH_DISCORD_SECRET");
  if (discordClientId && discordClientSecret) {
    socialProviders.discord = {
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    };
  }

  const linkedinClientId = getEnv("AUTH_LINKEDIN_ID");
  const linkedinClientSecret = getEnv("AUTH_LINKEDIN_SECRET");
  if (linkedinClientId && linkedinClientSecret) {
    socialProviders.linkedin = {
      clientId: linkedinClientId,
      clientSecret: linkedinClientSecret,
    };
  }

  // Origins allowed to make authenticated requests. The app is served from
  // several hosts that share this auth backend (the apex domain, Cloudflare
  // preview deployments, and localhost during development). Without listing
  // them, better-auth rejects the request and omits the CORS headers, which
  // surfaces as a blocked preflight when signing in from anywhere other than
  // the canonical origin. Extra origins can be supplied via the
  // BETTER_AUTH_TRUSTED_ORIGINS env var (comma-separated).
  const trustedOrigins = Array.from(
    new Set(
      [
        NEXT_PUBLIC_BASE_URL,
        "https://debate-ai.com",
        "https://*.debate-ai.com",
        "https://*.debate-ai.workers.dev",
        "http://localhost:3000",
        ...(getEnv("BETTER_AUTH_TRUSTED_ORIGINS")?.split(",") ?? []),
      ]
        .map((origin) => origin?.trim())
        .filter((origin): origin is string => Boolean(origin)),
    ),
  );

  return betterAuth({
    baseURL: NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    trustedOrigins,
    secret: getEnv("BETTER_AUTH_SECRET") || "dev-secret-change-in-production",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    socialProviders,
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
