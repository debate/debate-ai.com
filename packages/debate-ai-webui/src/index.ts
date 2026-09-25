/**
 * @fileoverview Public entry point for `debate-ai-webui`.
 *
 * This package is the debate-ai.com frontend: the app shell, every page, and
 * the components and client libraries behind them. `apps/debate-ai.com` keeps
 * only what needs its server — the Worker, `/api`, auth, D1, and each route's
 * Next metadata — and mounts these pages from its `app/` directory.
 *
 * Hosts that aren't Next mount {@link DebateApp}, which routes through the URL
 * fragment. Deep imports (`debate-ai-webui/components/…`,
 * `debate-ai-webui/lib/…`, `debate-ai-webui/routes/…`) are how the web app
 * reaches individual modules.
 *
 * @module debate-ai-webui
 */

export { DebateApp, applyStoredAppearance, type DebateAppProps } from "./host/DebateApp"
export { AppRouter, resolveRoute } from "./host/AppRouter"
export { configureHost, getHostConfig, type HostConfig } from "./host/config"
export { currentHref, navigate } from "./host/history"
export { matchRoute } from "./host/match"
export { APP_ROUTES, CLIENT_ROUTES, PAGE_ROUTES, type AppRoute } from "./routes"
