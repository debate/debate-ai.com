/**
 * @fileoverview A `renderHook` for this package's hook tests, built on the
 * same `mount` harness the component tests use (the repo has no
 * @testing-library dependency). `result.current` always holds the hook's
 * latest return value.
 */

import { mount, type Mounted } from "./mount";

// Tells React this is a test environment, so `act` flushes without warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface RenderedHook<T> {
  result: { current: T };
  unmount: Mounted["unmount"];
}

/** Mounts a probe component that calls `useHook` and records its return value. */
export async function renderHook<T>(useHook: () => T): Promise<RenderedHook<T>> {
  const result = { current: undefined as unknown as T };
  function Probe() {
    result.current = useHook();
    return null;
  }
  const mounted = await mount(<Probe />);
  return { result, unmount: mounted.unmount };
}
