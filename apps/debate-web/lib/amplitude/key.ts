/**
 * Which Amplitude key the browser starts with.
 *
 * `NEXT_PUBLIC_AMPLITUDE_API_KEY` is inlined at build time, and only the
 * GitHub deploy workflow sets it. A production build made anywhere else
 * (Cloudflare Workers Builds, a manual `bun run deploy`) shipped without it,
 * so the live site logged "not set" and sent nothing. The project key is
 * public and ingestion-scoped (the deploy workflow commits the same value), so
 * production hosts fall back to it; local dev and preview hosts stay quiet
 * rather than polluting the production project.
 */
export const PRODUCTION_AMPLITUDE_API_KEY = "b23bf3283bf5a81e2802bf01c1c0b8bb"

/** Hostnames that count as production for the fallback. */
export const PRODUCTION_HOSTS = new Set(["debate-ai.com", "www.debate-ai.com", "d.ebate.app"])

export function resolveAmplitudeKey(buildKey: string | undefined, hostname: string): string | null {
  if (buildKey) return buildKey
  return PRODUCTION_HOSTS.has(hostname) ? PRODUCTION_AMPLITUDE_API_KEY : null
}
