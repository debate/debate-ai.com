import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Enables Tracing.
  // Capture 100% in development, reduce in production based on traffic volume.
  tracesSampleRate: 1.0,

  integrations: [
    // enables Session Replay
    Sentry.replayIntegration(),
    // enables User Feedback
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
  ],

  // Capture replays for 10% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Instruments client-side navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
