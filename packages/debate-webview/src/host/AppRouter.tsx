"use client"

/**
 * @fileoverview Renders the page the URL fragment names, for hosts without
 * Next. See `./history.ts` for why the fragment, and `../routes/index.ts` for
 * the table.
 */

import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react"

import type { AppRoute } from "../routes"
import { compareSpecificity, matchRoute, type RouteParams } from "./match"
import { currentHref, isExternalHref, navigate, splitHref, subscribe } from "./history"
import { NotFoundSignal, RedirectSignal, RouteParamsContext } from "./route-context"

const lazyPages = new Map<AppRoute["load"], LazyExoticComponent<ComponentType>>()
const lazyLayouts = new Map<NonNullable<AppRoute["layout"]>, LazyExoticComponent<ComponentType<{ children: ReactNode }>>>()

function pageFor(route: AppRoute) {
  let page = lazyPages.get(route.load)
  if (!page) lazyPages.set(route.load, (page = lazy(route.load)))
  return page
}

function layoutFor(load: NonNullable<AppRoute["layout"]>) {
  let layout = lazyLayouts.get(load)
  if (!layout) lazyLayouts.set(load, (layout = lazy(load)))
  return layout
}

/** The best route for `pathname` and the params it binds, or `null`. */
export function resolveRoute(routes: AppRoute[], pathname: string): { route: AppRoute; params: RouteParams } | null {
  const matches = routes
    .map((route) => ({ route, params: matchRoute(route.pattern, pathname) }))
    .filter((m): m is { route: AppRoute; params: RouteParams } => m.params !== null)
    .sort((a, b) => compareSpecificity(a.route.pattern, b.route.pattern))
  return matches[0] ?? null
}

function NotFoundView() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <a className="text-sm underline" href="#/videos">
        Back to videos
      </a>
    </main>
  )
}

interface BoundaryState {
  error: unknown
}

/** Turns `notFound()`/`redirect()` into what Next would render, and bounds page crashes. */
class RouteBoundary extends Component<{ children: ReactNode; resetKey: string }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (error instanceof RedirectSignal) return null
    if (error instanceof NotFoundSignal) return <NotFoundView />
    return (
      <main className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
        <button className="text-sm underline" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </main>
    )
  }
}

/**
 * Keeps plain `<a href="/cards">` links inside the app. `next/link` is
 * shimmed, but some markup writes anchors by hand; on an extension page such
 * a link would load `chrome-extension://<id>/cards`, a file that isn't there.
 */
function useInAppAnchors() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return
      const href = anchor.getAttribute("href") ?? ""
      if (!href.startsWith("/") || isExternalHref(href)) return
      event.preventDefault()
      navigate(href)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
}

export function AppRouter({ routes }: { routes: AppRoute[] }) {
  const href = useSyncExternalStore(subscribe, currentHref, () => "/")
  const { pathname } = splitHref(href)
  const match = useMemo(() => resolveRoute(routes, pathname), [routes, pathname])
  useInAppAnchors()

  if (!match) return <NotFoundView />
  const Page = pageFor(match.route)
  const Layout = match.route.layout ? layoutFor(match.route.layout) : null
  const page = <Page />

  return (
    <RouteParamsContext.Provider value={match.params}>
      <RouteBoundary resetKey={pathname}>
        <Suspense fallback={null}>{Layout ? <Layout>{page}</Layout> : page}</Suspense>
      </RouteBoundary>
    </RouteParamsContext.Provider>
  )
}
