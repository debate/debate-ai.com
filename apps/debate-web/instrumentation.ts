import * as Sentry from "@sentry/cloudflare";

/**
 * Server-side Sentry hook, loaded by vinext like Next.js's `instrumentation.ts`.
 *
 * Sentry itself is started per request by `Sentry.withSentry` around the
 * Worker in worker/index.ts (DSN from the `SENTRY_DSN` secret), which also
 * catches errors thrown by crons and by the Worker's own routing. Errors inside
 * a page render, server action or route handler never reach it, because
 * vinext turns them into an error page or a 500, so vinext reports them here
 * instead. With no DSN set, `captureException` is a no-op.
 */
export function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string }>,
  context: Readonly<{ routerKind: string; routePath: string; routeType: string; renderSource?: string }>,
): void {
  Sentry.captureException(error, {
    tags: {
      routeType: context.routeType,
      routePath: context.routePath,
      routerKind: context.routerKind,
      ...(context.renderSource ? { renderSource: context.renderSource } : {}),
    },
    extra: { method: request.method, path: request.path },
  });
}
