/**
 * @fileoverview Minimal React mounting harness for hook and component tests
 * in this package. The repo has no @testing-library dependency, so this wraps
 * `createRoot` and React 19's `act` directly. Mirrors
 * `@debate-ai/practice-rounds/test/helpers/mount.tsx`, plus a small `renderHook`.
 */

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// Tell React this is a test renderer so `act` flushes without warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  /** The container the component was rendered into. */
  container: HTMLElement;
  /** Re-render with a new element (prop change), flushing effects. */
  rerender: (element: ReactElement) => Promise<void>;
  /** Unmount and detach the container, flushing cleanup effects. */
  unmount: () => Promise<void>;
}

/** Mounts `element` into a fresh detached container and runs its effects. */
export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.append(container);

  let root: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    async rerender(next) {
      await act(async () => {
        root.render(next);
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Runs `fn` inside `act` so React flushes the state updates it triggers. */
export async function flush(fn: () => void | Promise<void> = () => {}): Promise<void> {
  await act(async () => {
    await fn();
  });
}

/** Dispatches a click on `target` inside `act`. */
export async function click(target: Element): Promise<void> {
  await flush(() => {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/**
 * Types `value` into a controlled input the way React expects: the native
 * value setter has to be used so React's own value tracker sees the change.
 */
export async function type(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  const prototype =
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  await flush(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Live view of a hook's latest return value, from {@link renderHook}. */
export interface RenderedHook<T> extends Mounted {
  /** The value the hook returned on its most recent render. */
  readonly result: { current: T };
}

/**
 * Renders `useHook` inside a throwaway component and exposes its latest
 * return value, so hook tests read state the way a component would.
 */
export async function renderHook<T>(useHook: () => T): Promise<RenderedHook<T>> {
  const result = { current: undefined as unknown as T };
  function Probe(): null {
    result.current = useHook();
    return null;
  }
  const mounted = await mount(<Probe />);
  return Object.assign(mounted, { result });
}
