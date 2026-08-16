/**
 * @fileoverview Lists the OAuth providers this deployment actually has
 * credentials for, plus the public Google client id.
 *
 * The client uses this to decide which sign-in buttons to show and whether to
 * prompt Google One Tap. Credentials live in Worker secrets, so the browser
 * bundle has no way to know what is configured without asking the server.
 * Only the client id is returned — it is public by design (it ships in every
 * Google Identity Services request); secrets never leave the Worker.
 */
import { getEnv } from "@/lib/env";

/** Placeholder values from the setup docs — present but not usable. */
const PLACEHOLDERS = new Set([
  "your-google-client-id.apps.googleusercontent.com",
  "your-google-client-secret",
]);

function configured(...values: (string | undefined)[]) {
  return values.every((value) => Boolean(value) && !PLACEHOLDERS.has(value!));
}

export async function GET() {
  const providers: string[] = [];

  const googleClientId = getEnv("GOOGLE_CLIENT_ID");
  const googleConfigured = configured(googleClientId, getEnv("GOOGLE_CLIENT_SECRET"));
  if (googleConfigured) providers.push("google");

  if (configured(getEnv("AUTH_DISCORD_ID"), getEnv("AUTH_DISCORD_SECRET"))) {
    providers.push("discord");
  }

  if (configured(getEnv("AUTH_LINKEDIN_ID"), getEnv("AUTH_LINKEDIN_SECRET"))) {
    providers.push("linkedin");
  }

  return Response.json(
    {
      providers,
      googleClientId: googleConfigured ? googleClientId : "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
