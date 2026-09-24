"use client"

/**
 * @fileoverview The whole debate-ai.com app, for a host that isn't Next.
 *
 * This is the web app's root layout (`apps/debate-ai.com/app/layout.tsx`)
 * minus the parts only a document served by Next can have — `<html>`,
 * metadata, and the head scripts — with {@link AppRouter} in place of Next's
 * router. Everything between those two is the same component tree the site
 * renders: the theme provider, the loading overlay, and the `AppShell` with
 * its dock, sidebar, command palette, player and toasts.
 *
 * Hosts import the compiled stylesheet (`debate-ai-webui/dist/app.css`, from
 * `bun run build:css`), alias `next/link`, `next/navigation` and `next/image`
 * to `debate-ai-webui/next/*`, and call `configureHost` before rendering.
 */

import { useMemo } from "react"

import { ThemeProvider } from "../components/theme-provider"
import { AppShell } from "../components/layout/AppShell"
import { LoadingProvider } from "../components/layout/LoadingProvider"
import { APP_ROUTES, type AppRoute } from "../routes"
import { AppRouter } from "./AppRouter"

/**
 * What the root layout's pre-paint scripts do on the web: the stored colour
 * theme's `theme-<name>` class and the stored font on `<html>`.
 */
export function applyStoredAppearance(root: HTMLElement = document.documentElement): void {
  let theme = "modern-minimal"
  let font = ""
  try {
    const stored = localStorage.getItem("color-theme")
    if (stored && /^[a-z0-9-]+$/.test(stored)) theme = stored
    const storedFont = localStorage.getItem("fontFamily")
    if (storedFont && storedFont !== "system-default") font = storedFont
  } catch {
    // Storage blocked: the defaults above.
  }
  root.classList.add(`theme-${theme}`)
  root.style.fontFamily = font
  document.body?.classList.add("theme-root")
}

export interface DebateAppProps {
  /**
   * Pages of the host's own, matched before the app's — the extension adds
   * its settings this way.
   */
  extraRoutes?: AppRoute[]
}

export function DebateApp({ extraRoutes = [] }: DebateAppProps) {
  const routes = useMemo(() => [...extraRoutes, ...APP_ROUTES], [extraRoutes])
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <LoadingProvider />
      <AppShell>
        <AppRouter routes={routes} />
      </AppShell>
    </ThemeProvider>
  )
}
