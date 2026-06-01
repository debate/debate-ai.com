/**
 * Access environment variables consistently across Next.js and CF Workers.
 * Falls back to process.env for local development.
 */
export function getEnv(key: string): string | undefined {
  // process.env is available in Next.js (both server and edge)
  return process.env[key];
}
