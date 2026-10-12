/**
 * @fileoverview Minimal React mounting harness for component tests in this
 * package. The repo has no @testing-library dependency, so this wraps
 * `createRoot` and React 19's `act` directly: enough to mount a component
 * into jsdom, run its effects, fire real DOM events, and read the result
 * back. Mirrors `@debate/team-collaboration/test/helpers/mount.tsx`,
 * `@debate/timer/test/helpers/mount.tsx` and
 * `debate-search-evidence/test/helpers/mount.tsx` exactly.
 */

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

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
export async function flush(fn: () => void | Promise<void>): Promise<void> {
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
 * Mirrors `@debate/team-collaboration/test/helpers/mount.tsx`'s `type`.
 */
export async function type(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): Promise<void> {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : input instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  await flush(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

/** Every `<button>` in `root` whose trimmed text content is exactly `text`. */
export function buttonsByText(root: ParentNode, text: string): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll("button")).filter(
    (button) => button.textContent?.trim() === text,
  );
}

/** The first `<button>` in `root` whose trimmed text is exactly `text`; throws when missing. */
export function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const [button] = buttonsByText(root, text);
  if (!button) throw new Error(`No button with text "${text}"`);
  return button;
}

/** The element in `root` matching `selector`; throws when missing. */
export function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`No element matches "${selector}"`);
  return element as unknown as T;
}
