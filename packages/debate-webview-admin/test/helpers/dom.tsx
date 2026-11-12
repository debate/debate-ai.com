/**
 * Shared helpers for the jsdom component tests: mount a tree with
 * `react-dom/client`, drive it with real DOM events inside `act`, and answer
 * `fetch` from a small in-test route table. Only usable from a test file that
 * opts into jsdom with a `@vitest-environment jsdom` docblock.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Layout APIs jsdom lacks that Radix, cmdk and the admin queue reach for. */
export function installDomShims() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export interface Mounted {
  container: HTMLDivElement;
  root: Root;
  rerender(ui: ReactNode): void;
  unmount(): void;
}

const mounted: Mounted[] = [];

export function mount(ui: ReactNode): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  const handle: Mounted = {
    container,
    root,
    rerender(next) {
      act(() => root.render(next));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
  mounted.push(handle);
  return handle;
}

/** Unmounts everything `mount` created; call from `afterEach`. */
export function cleanup() {
  while (mounted.length) {
    const handle = mounted.pop()!;
    try {
      handle.unmount();
    } catch {
      // already unmounted by the test
    }
  }
  document.body.innerHTML = "";
}

/** Lets pending promises (fetch mocks, state updates) settle. */
export async function flush(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function norm(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Every element matching `selector` whose text contains (or matches) `text`. */
export function allByText(text: string | RegExp, selector = "*", scope: ParentNode = document): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(selector)].filter((el) => {
    const content = norm(el.textContent);
    return typeof text === "string" ? content.includes(text) : text.test(content);
  });
}

/** The innermost element matching `selector` whose text contains `text`. */
export function byText(text: string | RegExp, selector = "*", scope: ParentNode = document): HTMLElement {
  const matches = allByText(text, selector, scope);
  // Prefer the deepest match so `*` finds the element holding the text.
  const innermost = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)));
  const found = innermost[0] ?? matches[0];
  if (!found) throw new Error(`No <${selector}> containing ${String(text)}`);
  return found;
}

export function button(text: string | RegExp, scope: ParentNode = document): HTMLButtonElement {
  const buttons = allByText(text, "button", scope) as HTMLButtonElement[];
  const exact = buttons.find((b) => (typeof text === "string" ? norm(b.textContent) === text : true));
  const found = exact ?? buttons[0];
  if (!found) throw new Error(`No button ${String(text)}`);
  return found;
}

export function bodyText() {
  return norm(document.body.textContent);
}

export function click(el: Element) {
  act(() => {
    (el as HTMLElement).click();
  });
}

export async function clickAsync(el: Element) {
  click(el);
  await flush();
}

/** Sets an input/textarea/select value the way React's onChange sees it. */
export function change(el: Element, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function toggle(el: HTMLInputElement) {
  act(() => {
    el.click();
  });
}

export function submit(form: Element) {
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

export function keyDown(el: Element, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

/**
 * Picks `label` from a Radix Select: opens it from the trigger with the
 * keyboard, then chooses the option with Enter, which is what jsdom can drive
 * (it has no pointer-capture layout for the mouse path).
 */
export function selectOption(trigger: Element, label: string) {
  keyDown(trigger, "Enter");
  const option = [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (el) => norm(el.textContent) === label,
  );
  if (!option) throw new Error(`No option ${label}`);
  act(() => {
    option.focus();
  });
  keyDown(option, "Enter");
}

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

export interface FetchCall {
  url: string;
  method: string;
  body: unknown;
  init: RequestInit | undefined;
}

type Responder = (call: FetchCall) => unknown;

export interface Route {
  method?: string;
  /** Substring of the URL, or a regex tested against it. */
  match: string | RegExp;
  /** JSON body (or a function computing it) — or a full Response. */
  respond: unknown | Responder;
  status?: number;
  /** Answer only the first time; later calls fall through to the next route. */
  once?: boolean;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Replaces `globalThis.fetch` with a router over `routes`. Unmatched requests
 * answer 404 `{ error: "not found" }`. Returns the mock plus a `calls` log.
 */
export function mockFetch(routes: Route[]) {
  const calls: FetchCall[] = [];
  const used = new Set<Route>();
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let body: unknown = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        // leave non-JSON bodies as-is
      }
    }
    const call: FetchCall = { url, method, body, init };
    calls.push(call);
    const route = routes.find(
      (r) =>
        !(r.once && used.has(r)) &&
        (r.method ? r.method.toUpperCase() === method : true) &&
        (typeof r.match === "string" ? url.includes(r.match) : r.match.test(url)),
    );
    if (!route) return jsonResponse({ error: "not found" }, 404);
    used.add(route);
    const value = typeof route.respond === "function" ? (route.respond as Responder)(call) : route.respond;
    const resolved = await value;
    if (resolved instanceof Response) return resolved;
    return jsonResponse(resolved, route.status ?? 200);
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { fn, calls, routes };
}
