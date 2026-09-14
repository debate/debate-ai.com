/**
 * @fileoverview Minimal React mounting harness for the timer component tests.
 *
 * The repo has no @testing-library dependency, so this wraps `createRoot` and
 * React 19's `act` directly: enough to mount a component into jsdom, run its
 * effects, fire real DOM events, and read the result back.
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

/** Dispatches a bubbling event of `type` on `target` inside `act`. */
export async function fire(
  target: Element,
  type: string,
  init: EventInit = {},
): Promise<void> {
  await flush(() => {
    target.dispatchEvent(new Event(type, { bubbles: true, ...init }));
  });
}

/**
 * Waits for `count` animation frames inside `act`. Components that publish media
 * state on a rAF loop need two: the loop only invokes its callback once it has a
 * previous frame timestamp to diff against.
 */
export async function frames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await flush(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );
  }
}

/** Dispatches a `pointerdown` on `target`; Radix menus open on pointer, not click. */
export async function pointerDown(target: Element): Promise<void> {
  await flush(() => {
    target.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        button: 0,
        // jsdom has no PointerEvent, and Radix reads these off the event.
        detail: 1,
      }),
    );
  });
}

/** Dispatches a click on `target` inside `act`. */
export async function click(target: Element): Promise<void> {
  await flush(() => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

/** Dispatches a `keydown` for `key` on `target` inside `act`. */
export async function keyDown(target: Element, key: string): Promise<void> {
  await flush(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });
}

/**
 * Blurs `target`. React delegates `onBlur` to the bubbling `focusout` event, so
 * a plain non-bubbling `blur` event never reaches the handler.
 */
export async function blur(target: HTMLElement): Promise<void> {
  await flush(() => {
    target.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

/**
 * Types `value` into a controlled input the way React expects: the native value
 * setter has to be used so React's own value tracker sees the change.
 */
export async function type(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  await flush(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Replaces `Audio` with a no-op stub; jsdom throws on `play()`. Returns a restore fn. */
export function stubAudio(): () => void {
  const original = (globalThis as { Audio?: unknown }).Audio;
  class StubAudio {
    play() {
      return Promise.resolve();
    }
    pause() {}
  }
  (globalThis as { Audio?: unknown }).Audio = StubAudio;
  return () => {
    (globalThis as { Audio?: unknown }).Audio = original;
  };
}
