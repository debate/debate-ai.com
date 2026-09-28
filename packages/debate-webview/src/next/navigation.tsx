/**
 * @fileoverview `next/navigation` for hosts that aren't Next.
 *
 * The UI in this package — and the feature packages it mounts — import
 * `usePathname`, `useRouter` and friends from `next/navigation`. Under the web
 * app those are Next's own. A host without Next (the browser extension)
 * aliases `next/navigation` to this file, and the same code routes through
 * the URL fragment instead (`../host/history.ts`).
 *
 * Only the surface this repo uses is implemented; see the internals note for
 * the list.
 */

import { useContext, useMemo, useSyncExternalStore } from "react"

import { currentHref, navigate, splitHref, subscribe } from "../host/history"
import { NotFoundSignal, RedirectSignal, RouteParamsContext } from "../host/route-context"

function useHref(): string {
  return useSyncExternalStore(subscribe, currentHref, () => "/")
}

export function usePathname(): string {
  return splitHref(useHref()).pathname
}

export type ReadonlyURLSearchParams = URLSearchParams

export function useSearchParams(): ReadonlyURLSearchParams {
  const { search } = splitHref(useHref())
  return useMemo(() => new URLSearchParams(search), [search])
}

export function useParams<T extends Record<string, string | string[]> = Record<string, string | string[]>>(): T {
  return useContext(RouteParamsContext) as T
}

export interface AppRouterInstance {
  push(href: string, options?: { scroll?: boolean }): void
  replace(href: string, options?: { scroll?: boolean }): void
  back(): void
  forward(): void
  refresh(): void
  prefetch(href: string): void
}

const router: AppRouterInstance = {
  push: (href) => navigate(href),
  replace: (href) => navigate(href, { replace: true }),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  // Every screen here fetches on the client, so there is no server payload
  // to re-request; a refresh is already whatever the screen's state says.
  refresh: () => {},
  prefetch: () => {},
}

export function useRouter(): AppRouterInstance {
  return router
}

export function useSelectedLayoutSegments(): string[] {
  return usePathname().split("/").filter(Boolean)
}

export function useSelectedLayoutSegment(): string | null {
  return useSelectedLayoutSegments()[0] ?? null
}

export enum RedirectType {
  push = "push",
  replace = "replace",
}

export function redirect(href: string, type: RedirectType = RedirectType.replace): never {
  navigate(href, { replace: type === RedirectType.replace })
  throw new RedirectSignal(href)
}

export function permanentRedirect(href: string): never {
  return redirect(href, RedirectType.replace)
}

export function notFound(): never {
  throw new NotFoundSignal()
}
