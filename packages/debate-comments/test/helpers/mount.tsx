/**
 * @fileoverview Minimal React mounting harness for the comment component tests.
 *
 * The repo has no @testing-library dependency, so this wraps `createRoot` and
 * React 19's `act` directly — the same approach `debate-timer` takes. Enough to
 * mount a component into jsdom, run its effects, fire real DOM events, and read
 * the result back.
 *
 * What `renderToStaticMarkup` cannot do is any of that: it renders the server
 * pass once and stops, so it cannot see a fetch resolve, a like settle, or a
 * reply appear under its parent. Those are the parts of this feature most worth
 * testing, so they get a real mount.
 */

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// React only trusts `act` to flush effects when it can see this flag, and warns
// on every call without it. It is a global rather than a per-test setting
// because it is a property of the environment, not of any one component.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  /** Re-render with a new element (a prop change), flushing effects. */
  rerender: (element: ReactElement) => Promise<void>;
  unmount: () => Promise<void>;
}

/** Mounts `element` into a fresh container and runs its effects. */
export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement("div");
  document.body.append(container);

  let root!: Root;
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

/** Runs `fn` inside `act`, so React flushes the state updates it triggers. */
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
 * Types `value` into a controlled textarea the way React expects: the native
 * value setter has to be used, or React's own value tracker never sees the
 * change and the controlled input snaps back to its old value.
 */
export async function type(
  textarea: HTMLTextAreaElement,
  value: string,
): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  await flush(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Focuses `target` inside `act`, the way a click into a composer does. */
export async function focus(target: HTMLElement): Promise<void> {
  await flush(() => {
    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  });
}

/**
 * A button belonging to the composer `textarea` is inside.
 *
 * The composer's own root is the textarea's parent — the flex column holding
 * the input and its button row — so scoping to it is what tells the reply
 * composer's "Reply" apart from the row action that opened it, and from every
 * other row's. Matching on the label alone cannot: they are all the same word.
 */
export function composerButton(
  textarea: HTMLTextAreaElement,
  text: string,
): HTMLButtonElement {
  const root = textarea.parentElement;
  if (!root) throw new Error("The composer has no container to search for its buttons.");
  return button(root, text);
}

/** The first element matching `selector`, or throws naming what was missing. */
export function find<T extends Element = HTMLElement>(
  container: HTMLElement,
  selector: string,
): T {
  const found = container.querySelector<T>(selector);
  if (!found) {
    throw new Error(
      `No element matched ${selector}. Rendered: ${container.innerHTML.slice(0, 600)}`,
    );
  }
  return found;
}

/** Every element matching `selector`. */
export function findAll<T extends Element = HTMLElement>(
  container: HTMLElement,
  selector: string,
): T[] {
  return Array.from(container.querySelectorAll<T>(selector));
}

/**
 * The first button in `container` whose visible label or aria-label contains
 * `text`.
 *
 * The first, not the only: a thread's rows all carry the same "Reply" and "Like"
 * labels. For a button that has to be told apart from its namesake, scope the
 * search — see {@link composerButton}.
 */
export function button(container: HTMLElement, text: string): HTMLButtonElement {
  const match = findAll<HTMLButtonElement>(container, "button").find((candidate) =>
    `${candidate.textContent ?? ""} ${candidate.getAttribute("aria-label") ?? ""}`.includes(
      text,
    ),
  );
  if (!match) {
    throw new Error(
      `No button matched "${text}". Buttons: ${findAll(container, "button")
        .map((candidate) => candidate.getAttribute("aria-label") ?? candidate.textContent)
        .join(" | ")}`,
    );
  }
  return match;
}
