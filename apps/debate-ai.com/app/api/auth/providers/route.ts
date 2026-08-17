/**
 * @fileoverview Returns the list of OAuth providers the auth backend actually
 * has credentials for. The client uses this to decide which sign-in buttons to
 * render and whether Google One Tap can be prompted at all — prompting for a
 * provider the server can't complete the callback for only ever fails.
 */
import { getEnv } from "@/lib/env";

/** Placeholder values shipped in example env files, which are not real creds. */
const PLACEHOLDERS = new Set([
  "your-google-client-id.apps.googleusercontent.com",
  "your-google-client-secret",
]);

function isConfigured(...values: (string | undefined)[]): boolean {
  return values.every((value) => Boolean(value) && !PLACEHOLDERS.has(value!));
}

export async function GET() {
  const providers: string[] = [];

  if (isConfigured(getEnv("GOOGLE_CLIENT_ID"), getEnv("GOOGLE_CLIENT_SECRET"))) {
    providers.push("google");
  }

  if (isConfigured(getEnv("AUTH_DISCORD_ID"), getEnv("AUTH_DISCORD_SECRET"))) {
    providers.push("discord");
  }

  if (isConfigured(getEnv("AUTH_LINKEDIN_ID"), getEnv("AUTH_LINKEDIN_SECRET"))) {
    providers.push("linkedin");
  }

  return Response.json({ providers });
}
