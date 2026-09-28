"use client"

/**
 * @fileoverview A boundary around one piece of app chrome, so a crash inside
 * it stays inside it.
 *
 * The app shell renders the dock, the sidebar's docs panels and its tool tree
 * from the root layout — above every page. React unmounts up to the nearest
 * error boundary, and until this existed there was none anywhere in the app:
 * one throw in any of those components unmounted the entire document, and on
 * the server it failed the render outright, so the Worker answered 500 with no
 * shell, no sidebar and no page.
 *
 * That is not hypothetical. `ReferenceError: useMemo is not defined` in
 * `ReasonDocsSidebarPanels` (a bad conflict resolution in 7e33704, repaired in
 * #753) took down every route the panels mount on — all of `/cards/*` and
 * `/reason-editor` — while the rest of the app stayed up, because that is
 * exactly the set of routes whose sidebar rendered the broken component.
 *
 * Wrapping each region separately means the blast radius of the next such
 * mistake is the region, not the route: the sidebar keeps its other panels,
 * the page still renders, and the nav stays usable. `fallback` defaults to
 * nothing at all, which is the right answer for decorative chrome (a video
 * player, a keyboard-shortcut listener); pass a node for regions worth
 * acknowledging in place, like a navigation tree.
 *
 * The `<Suspense>` below is load-bearing, not decoration. A React error
 * boundary on its own does *not* save a server render: the streaming
 * renderer treats a throw in the shell — everything outside a Suspense
 * boundary — as fatal and rejects the whole stream, boundary or no boundary,
 * which is precisely the 500. Putting each region behind its own Suspense
 * boundary moves it out of the shell, so a throw there costs that boundary
 * only: React emits its fallback, the rest of the document streams as
 * normal, and the response stays a 200 page. The class boundary then takes
 * over on the client, where the same component is about to throw again, and
 * keeps the fallback instead of letting it bubble to the route.
 *
 * @module lib/ui/layout/chrome-error-boundary
 */

import { Component, Suspense, type ErrorInfo, type ReactNode } from "react"

export interface ChromeErrorBoundaryProps {
  /** The chrome region to isolate. */
  children: ReactNode
  /**
   * Rendered in place of `children` after a crash. Defaults to nothing —
   * chrome that failed is better absent than turned into an error message
   * the reader can do nothing about.
   */
  fallback?: ReactNode
  /**
   * Names the region in the console warning, so a crash points at the
   * component to fix rather than just "somewhere in the shell".
   */
  label: string
}

interface ChromeErrorBoundaryState {
  failed: boolean
}

class ChromeErrorCatch extends Component<ChromeErrorBoundaryProps, ChromeErrorBoundaryState> {
  state: ChromeErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ChromeErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Swallowing the error is the point; swallowing the *report* would make
    // the next one of these invisible instead of merely contained.
    console.error(`[chrome] ${this.props.label} failed to render:`, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}

/**
 * Isolates one region of app chrome from the rest of the document.
 *
 * @param children - The chrome region to isolate.
 * @param fallback - What to show once it has failed. Defaults to nothing.
 * @param label - Names the region in the console warning a crash logs.
 */
export function ChromeErrorBoundary({ children, fallback, label }: ChromeErrorBoundaryProps) {
  return (
    <Suspense fallback={fallback ?? null}>
      <ChromeErrorCatch label={label} fallback={fallback}>
        {children}
      </ChromeErrorCatch>
    </Suspense>
  )
}
