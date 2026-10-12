/**
 * @fileoverview `renderHook` on top of this folder's `mount` harness: renders
 * a hook inside a throwaway component and exposes its latest return value,
 * so hook tests read state the way a component would.
 */

import { flush, mount, type Mounted } from "./mount";

// Tell React this is a test renderer so `act` flushes without warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Live view of a hook's latest return value. */
export interface RenderedHook<T> extends Mounted {
  /** The value the hook returned on its most recent render. */
  readonly result: { current: T };
}

/** Mounts `useHook` and runs its effects. */
export async function renderHook<T>(useHook: () => T): Promise<RenderedHook<T>> {
  const result = { current: undefined as unknown as T };
  function Probe(): null {
    result.current = useHook();
    return null;
  }
  const mounted = await mount(<Probe />);
  return Object.assign(mounted, { result });
}

/** Lets pending promises and the state updates they trigger settle. */
export async function settle(): Promise<void> {
  await flush(() => {});
}
