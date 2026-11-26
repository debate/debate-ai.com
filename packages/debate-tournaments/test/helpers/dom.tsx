/**
 * jsdom rendering helpers for the component tests: mount a tree under the
 * tournaments context, let its effects settle, and drive it the way a user would.
 * Import only from files that start with `// @vitest-environment jsdom`.
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { tournamentHrefs } from "../../src/routes";
import { createTournamentsClient, type TournamentsClient } from "../../src/ui/client";
import { TournamentsContext, defaultLink, type TournamentsContextValue } from "../../src/ui/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let mounted: Root | null = null;

export function unmountAll() {
  act(() => mounted?.unmount());
  mounted = null;
  container?.remove();
  container = null;
}

/** Waits for pending promises and timers to flush inside `act`. */
export async function settle(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

export function contextValue(extra: Partial<TournamentsContextValue> = {}): TournamentsContextValue {
  const client = createTournamentsClient("/api/tabroom", () => Promise.resolve(new Response("{}")));
  return { client, hrefs: tournamentHrefs("/tournament", client.slugOf), Link: defaultLink, ...extra };
}

/** A client whose requests are answered by `handler(pathname+search, init)`. */
export function clientWith(handler: (path: string, init?: RequestInit) => unknown, options: { liveApiBase?: string } = {}): TournamentsClient {
  return createTournamentsClient(
    "/api/tabroom",
    async (url, init) => {
      const body = handler(String(url), init);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    },
    options,
  );
}

export async function render(node: ReactNode, value: TournamentsContextValue | null = contextValue()): Promise<HTMLElement> {
  unmountAll();
  container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted = root;
  await act(async () => {
    root.render(value ? <TournamentsContext.Provider value={value}>{node}</TournamentsContext.Provider> : node);
  });
  await settle();
  return container;
}

export async function click(el: Element | null) {
  if (!el) throw new Error("click target missing");
  await act(async () => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Sets an input/textarea/select value the way React's onChange expects. */
export async function type(el: Element | null, value: string) {
  if (!el) throw new Error("type target missing");
  const proto =
    el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

export async function submit(form: Element | null) {
  if (!form) throw new Error("form missing");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

export const text = (el: Element | null) => el?.textContent ?? "";
export const byText = (root: ParentNode, selector: string, match: string | RegExp) =>
  [...root.querySelectorAll(selector)].find((n) => (typeof match === "string" ? n.textContent === match : match.test(n.textContent ?? ""))) ?? null;
