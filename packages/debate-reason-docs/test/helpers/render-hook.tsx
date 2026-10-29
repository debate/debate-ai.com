/**
 * @fileoverview A `renderHook` for this package's hook tests (the repo has no
 * @testing-library dependency): mounts a probe component that calls the hook,
 * re-renders it with new props on demand, and keeps `result.current` pointed
 * at the hook's latest return value.
 */

import { act } from "react"
import { createRoot } from "react-dom/client"

// Tells React this is a test environment, so `act` flushes without warning.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface RenderedHook<T, P> {
  result: { current: T }
  rerender: (props: P) => Promise<void>
  unmount: () => Promise<void>
}

export async function renderHook<T, P = undefined>(
  useHook: (props: P) => T,
  initialProps?: P,
): Promise<RenderedHook<T, P>> {
  const result = { current: undefined as unknown as T }
  function Probe({ props }: { props: P }) {
    result.current = useHook(props)
    return null
  }
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<Probe props={initialProps as P} />))
  return {
    result,
    async rerender(props) {
      await act(async () => root.render(<Probe props={props} />))
    },
    async unmount() {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

/** Runs `fn` inside `act` so React flushes the state updates it triggers. */
export async function flush(fn: () => void | Promise<void> = () => {}): Promise<void> {
  await act(async () => {
    await fn()
  })
}
