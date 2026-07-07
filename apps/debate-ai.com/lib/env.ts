/**
 * Access environment variables consistently across Next.js and CF Workers.
 * Falls back to process.env for local development.
 */
import { getCloudflareContext } from "./database/context";

export function getEnv(key: string): string | undefined {
  // Try Cloudflare Workers env binding first
  const context = getCloudflareContext();
  if (context?.env?.[key]) {
    return context.env[key];
  }

  // Fall back to process.env for local/Next.js
  return process.env[key];
}
