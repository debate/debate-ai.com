/**
 * Shared jsdom render helpers for this package's component tests.
 *
 * No `@testing-library/*` here (and no new dependencies), so these wrap the
 * same `react-dom/client` + `act` pattern `UserSettingsPanel.test.tsx` and
 * `TeamSection.test.tsx` use, plus a few query/event shortcuts. Only usable
 * from a test file that opts into `// @vitest-environment jsdom`.
 */

import { act, createElement, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export type Mounted = {
  container: HTMLDivElement
  root: Root
  rerender: (element: ReactElement) => Promise<void>
  unmount: () => void
}

const mounted: Mounted[] = []

/** Renders `element` into a fresh container attached to `document.body`. */
export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  const handle: Mounted = {
    container,
    root,
    rerender: async (next) => {
      await act(async () => {
        root.render(next)
      })
    },
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
  mounted.push(handle)
  return handle
}

/** Unmounts everything `mount` rendered (call from `afterEach`). */
export function cleanup(): void {
  while (mounted.length) {
    const handle = mounted.pop()!
    try {
      handle.unmount()
    } catch {
      /* already unmounted */
    }
  }
  document.body.innerHTML = ""
}

/** Flushes pending promises/effects inside `act`. */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

/** Clicks an element inside `act` and lets any resulting promises settle. */
export async function click(el: Element | null | undefined): Promise<void> {
  if (!el) throw new Error("click(): element not found")
  await act(async () => {
    ;(el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
  await flush()
}

/** Sets a controlled input/textarea's value the way React's onChange expects. */
export async function typeInto(el: Element | null | undefined, value: string): Promise<void> {
  if (!el) throw new Error("typeInto(): element not found")
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

/** Dispatches a keydown on an element inside `act`. */
export async function keyDown(el: Element | Document | Window, key: string, init: KeyboardEventInit = {}): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }))
  })
}

/** All buttons in `scope` (default: the whole document). */
export function buttons(scope: ParentNode = document): HTMLButtonElement[] {
  return Array.from(scope.querySelectorAll("button"))
}

/** First button whose trimmed text content includes `text`. */
export function buttonByText(text: string, scope: ParentNode = document): HTMLButtonElement | undefined {
  return buttons(scope).find((b) => (b.textContent ?? "").includes(text))
}

/** First element matching `[title="…"]` exactly. */
export function byTitle(title: string, scope: ParentNode = document): HTMLElement | null {
  return scope.querySelector(`[title="${title.replace(/"/g, '\\"')}"]`)
}

/** All elements whose `title` attribute equals `title`. */
export function allByTitle(title: string, scope: ParentNode = document): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>("[title]")).filter((el) => el.getAttribute("title") === title)
}

export type HookHandle<P, R> = {
  result: { current: R }
  rerender: (props: P) => Promise<void>
  unmount: () => void
}

/**
 * Minimal `renderHook`: mounts a probe component that calls `hook(props)`
 * and exposes its latest return value on `result.current`.
 */
export async function renderHook<P, R>(hook: (props: P) => R, initialProps?: P): Promise<HookHandle<P, R>> {
  const result = { current: undefined as unknown as R }
  function Probe({ hookProps }: { hookProps: P }) {
    result.current = hook(hookProps)
    return null
  }
  const handle = await mount(createElement(Probe, { hookProps: initialProps as P }))
  return {
    result,
    rerender: (props: P) => handle.rerender(createElement(Probe, { hookProps: props })),
    unmount: handle.unmount,
  }
}

/** Runs `fn` inside `act` (sync or async) and flushes. */
export async function run(fn: () => unknown): Promise<void> {
  await act(async () => {
    await fn()
  })
}

/** The document's visible text. */
export function bodyText(): string {
  return document.body.textContent ?? ""
}

/** Picks `value` in a native `<select>` (see `select-mock.tsx`) and fires `change`. */
export async function choose(select: Element | null | undefined, value: string): Promise<void> {
  if (!select) throw new Error("choose(): select not found")
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!
  setter.call(select, value)
  if ((select as HTMLSelectElement).value !== value) {
    // The option sits inside a wrapper element (e.g. a `<div>` group), so it
    // isn't one of the native select's options; report the value the real
    // Radix Select would hand `onValueChange` for the duration of the event.
    const nested = Array.from(select.querySelectorAll("option")).some((o) => o.value === value)
    if (!nested) throw new Error(`choose(): no option with value "${value}"`)
    Object.defineProperty(select, "value", { configurable: true, get: () => value, set: () => {} })
    try {
      await act(async () => {
        select.dispatchEvent(new Event("change", { bubbles: true }))
      })
    } finally {
      delete (select as { value?: string }).value
    }
    return
  }
  await act(async () => {
    select.dispatchEvent(new Event("change", { bubbles: true }))
  })
}

/** Stubs `URL.createObjectURL`/`revokeObjectURL` and records anchor downloads. */
export function captureDownloads(): { names: string[]; blobs: Blob[] } {
  const captured = { names: [] as string[], blobs: [] as Blob[] }
  URL.createObjectURL = ((blob: Blob) => {
    captured.blobs.push(blob)
    return "blob:test"
  }) as typeof URL.createObjectURL
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    captured.names.push(this.download)
  }
  return captured
}
