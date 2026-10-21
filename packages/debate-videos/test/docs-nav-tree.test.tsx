// @vitest-environment jsdom
/**
 * @fileoverview The sidebar's "Docs" section: collapsed on arrival with no
 * request made, every docs page listed once opened (folders collapsed too, as
 * full page loads), and nothing on /docs, where the docs layout portals its
 * own tree in.
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

const { DocsNavTree, DOCS_TREE_URL } = await import("../src/components/sidebar-nav/DocsNavTree");

const TREE = [
  { type: "page", name: "Introduction", url: "/docs" },
  {
    type: "folder",
    name: "Features",
    url: "/docs/features",
    children: [{ type: "page", name: "Timers", url: "/docs/features/timers" }],
  },
];

let view: Mounted | null = null;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  nav.pathname = "/practice";
  fetchMock = vi.fn(async () => new Response(JSON.stringify(TREE), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
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
  it("starts collapsed and fetches nothing", async () => {
    view = await mount(<DocsNavTree />);
    expect(view.container.textContent).toContain("Docs");
    expect(headingToggle(view.container).getAttribute("aria-expanded")).toBe("false");
    expect(view.container.textContent).not.toContain("Introduction");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists every docs page once opened, folders collapsed, as page loads", async () => {
    view = await mount(<DocsNavTree />);
    await flush(() => headingToggle(view!.container).click());
    for (let i = 0; i < 20 && !view.container.textContent?.includes("Introduction"); i++) {
      await flush(() => new Promise((r) => setTimeout(r, 5)));
    }
    expect(fetchMock).toHaveBeenCalledWith(DOCS_TREE_URL);
    const text = view.container.textContent ?? "";
    expect(text).toContain("Introduction");
    expect(text).toContain("Features");
    expect(text).not.toContain("Timers");
    const features = view.container.querySelector('a[href="/docs/features"]');
    expect(features?.hasAttribute("data-client-link")).toBe(false);

    const expand = view.container.querySelector<HTMLElement>('button[aria-label="Expand Features"]');
    await flush(() => expand!.click());
    expect(view.container.querySelector('a[href="/docs/features/timers"]')).not.toBeNull();
  });

  it("renders nothing on /docs", async () => {
    nav.pathname = "/docs/features";
    view = await mount(<DocsNavTree />);
    expect(view.container.innerHTML).toBe("");
  });
});
