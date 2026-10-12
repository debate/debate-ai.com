/**
 * Minimal React mounting harness: `createRoot` plus React 19's `act`, the same
 * approach the other packages take since the repo has no testing-library.
 */

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
    container: HTMLElement;
    rerender: (element: ReactElement) => Promise<void>;
    unmount: () => Promise<void>;
}

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

/** Runs `fn` inside `act`, so React flushes the updates it triggers. */
export async function flush(fn: () => unknown = () => {}): Promise<void> {
    await act(async () => {
        await fn();
    });
}

export async function click(target: Element): Promise<void> {
    await flush(() => {
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
}

/** Sets a controlled input's value the way React's value tracker notices. */
export async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    await flush(() => {
        setter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}

export async function key(target: EventTarget, init: KeyboardEventInit): Promise<void> {
    await flush(() => {
        target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    });
}

/** The first button whose text or aria-label contains `text`. */
export function button(container: ParentNode, text: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll("button")).find((b) =>
        `${b.textContent ?? ""} ${b.getAttribute("aria-label") ?? ""}`.includes(text),
    );
    if (!match) {
        const labels = Array.from(container.querySelectorAll("button"))
            .map((b) => b.getAttribute("aria-label") ?? b.textContent)
            .join(" | ");
        throw new Error(`No button matched "${text}". Buttons: ${labels}`);
    }
    return match;
}
