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

  return betterAuth({
    baseURL: NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
    secret: getEnv("BETTER_AUTH_SECRET") || "dev-secret-change-in-production",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    socialProviders: {
      google: {
        clientId: getEnv("GOOGLE_CLIENT_ID")!,
        clientSecret: getEnv("GOOGLE_CLIENT_SECRET")!,
      },
      discord: {
        clientId: getEnv("AUTH_DISCORD_ID") || "",
        clientSecret: getEnv("AUTH_DISCORD_SECRET"),
      },
      linkedin: {
        clientId: getEnv("AUTH_LINKEDIN_ID") || "",
        clientSecret: getEnv("AUTH_LINKEDIN_SECRET"),
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
