/**
 * Browser error monitoring with Sentry. vinext loads this file in the browser
 * before the app hydrates, the same as Next.js's `instrumentation-client.ts`.
 *
 * This app is built by vinext (Vite) and served by a Cloudflare Worker, not by
 * Next.js's own build or server, so @sentry/nextjs does not fit: its
 * `withSentryConfig` build hooks and `/monitoring` tunnel route never run here.
 * The browser uses @sentry/react; the Worker uses @sentry/cloudflare (see
 * worker/index.ts and instrumentation.ts).
 *
 * A Sentry DSN is public by design (it can only submit events), so
 * `NEXT_PUBLIC_SENTRY_DSN` is inlined at build time like the Amplitude key.
 * Without it nothing is loaded. The SDK is imported lazily so it stays out of
 * the first-load chunk.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (typeof window !== "undefined" && dsn) {
  import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? "development" : "production",
        integrations: [
          // Page loads and client-side navigations (history API).
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration(),
          Sentry.feedbackIntegration({ colorScheme: "system" }),
        ],
        // Performance traces for 10% of page loads and navigations.
        tracesSampleRate: 0.1,
        // Replays for 10% of all sessions, plus every session with an error.
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
      })
    })
    .catch((error: unknown) => console.error("[sentry] init failed", error))
}

export {}
