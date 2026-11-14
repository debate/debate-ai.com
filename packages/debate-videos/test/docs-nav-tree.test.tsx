// @vitest-environment jsdom
/**
 * @fileoverview The sidebar's "Docs" section: open on arrival, expanded to
 * the second level (top-level folders open, deeper ones shut), every docs
 * page a full page load, a failed load retried on reopen, and nothing on
 * /docs, where the docs layout portals its own tree in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { flush, mount, type Mounted } from "./helpers/mount";

const nav = vi.hoisted(() => ({ pathname: "/practice" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) =>
    createElement("a", { href, className, "data-client-link": "" }, children),
}));

type DocsNavTreeModule = typeof import("../src/components/navigation/sidebar-nav/DocsNavTree");
const DOCS_TREE_URL = "/docs/api/docs-tree";
// Re-imported per test: the module keeps one tree request per page load.
let DocsNavTree: DocsNavTreeModule["DocsNavTree"];

const TREE = [
  { type: "page", name: "Introduction", url: "/docs" },
  {
    type: "folder",
    name: "Features",
    url: "/docs/features",
    children: [
      { type: "page", name: "Timers", url: "/docs/features/timers" },
      {
        type: "folder",
        name: "UI navigation",
        url: "/docs/features/ui-navigation",
        children: [{ type: "page", name: "App dock", url: "/docs/features/ui-navigation/app-nav-dock" }],
      },
    ],
  },
];

let view: Mounted | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  nav.pathname = "/practice";
  fetchMock = vi.fn(async () => new Response(JSON.stringify(TREE), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  ({ DocsNavTree } = await import("../src/components/navigation/sidebar-nav/DocsNavTree"));
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  vi.unstubAllGlobals();
});

function headingToggle(container: HTMLElement): HTMLElement {
  const row = container.querySelector<HTMLElement>('a[href="/docs"][aria-expanded]');
  if (!row) throw new Error("no Docs heading");
  return row;
}

describe("DocsNavTree", () => {
  async function loaded(): Promise<Mounted> {
    const mounted = await mount(<DocsNavTree />);
    for (let i = 0; i < 20 && !mounted.container.textContent?.includes("Introduction"); i++) {
      await flush(() => new Promise((r) => setTimeout(r, 5)));
    }
    return mounted;
  }

  it("starts open and fetches the tree", async () => {
    view = await loaded();
    expect(headingToggle(view.container).getAttribute("aria-expanded")).toBe("true");
    expect(fetchMock).toHaveBeenCalledWith(DOCS_TREE_URL);
    expect(view.container.textContent).toContain("Introduction");
    expect(view.container.textContent).not.toContain("Loading");
  });

  it("shows only the top-level labels, with every folder shut", async () => {
    view = await loaded();
    const text = view.container.textContent ?? "";
    expect(text).toContain("Features");
    expect(text).not.toContain("Timers");
    expect(text).not.toContain("UI navigation");
    const features = view.container.querySelector('a[href="/docs/features"]');
    expect(features?.hasAttribute("data-client-link")).toBe(false);

    const expandFeatures = view.container.querySelector<HTMLElement>('button[aria-label="Expand Features"]');
    await flush(() => expandFeatures!.click());
    expect(view.container.textContent).toContain("Timers");
    expect(view.container.textContent).not.toContain("App dock");
    expect(view.container.querySelector('a[href="/docs/features/timers"]')?.hasAttribute("data-client-link")).toBe(
      false,
    );

    const expandNested = view.container.querySelector<HTMLElement>('button[aria-label="Expand UI navigation"]');
    await flush(() => expandNested!.click());
    expect(view.container.querySelector('a[href="/docs/features/ui-navigation/app-nav-dock"]')).not.toBeNull();

    const collapseFeatures = view.container.querySelector<HTMLElement>('button[aria-label="Collapse Features"]');
    await flush(() => collapseFeatures!.click());
    expect(view.container.textContent).not.toContain("Timers");
  });

  it("retries a failed load when reopened", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("", { status: 404 }));
    view = await mount(<DocsNavTree />);
    for (let i = 0; i < 20 && !view.container.textContent?.includes("Couldn't"); i++) {
      await flush(() => new Promise((r) => setTimeout(r, 5)));
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain("Couldn't load the docs.");
    await flush(() => headingToggle(view!.container).click());
    await flush(() => headingToggle(view!.container).click());
    for (let i = 0; i < 20 && !view.container.textContent?.includes("Introduction"); i++) {
      await flush(() => new Promise((r) => setTimeout(r, 5)));
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).toContain("Introduction");
  });

  it("renders and fetches nothing on /docs", async () => {
    nav.pathname = "/docs/features";
    view = await mount(<DocsNavTree />);
    expect(view.container.innerHTML).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
