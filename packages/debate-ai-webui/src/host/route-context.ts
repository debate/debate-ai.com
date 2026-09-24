/**
 * @fileoverview The matched route's params, and the throwables that stand in
 * for Next's `redirect()` and `notFound()` outside Next.
 */

import { createContext } from "react"

import type { RouteParams } from "./match"

export const RouteParamsContext = createContext<RouteParams>({})

/** Thrown by `notFound()`; the router renders its not-found view. */
export class NotFoundSignal extends Error {
  constructor() {
    super("NEXT_NOT_FOUND")
    this.name = "NotFoundSignal"
  }
}

/** Thrown by `redirect()` after the navigation is queued; renders nothing. */
export class RedirectSignal extends Error {
  constructor(public readonly href: string) {
    super(`NEXT_REDIRECT ${href}`)
    this.name = "RedirectSignal"
  }
}
