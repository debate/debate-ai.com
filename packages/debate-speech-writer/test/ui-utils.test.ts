// @vitest-environment jsdom
/**
 * @fileoverview Tests for `ui/lib/utils.ts` — `cn` (clsx + tailwind-merge)
 * and `setStateInURL`, which reads and writes query parameters through the
 * History API without a page reload.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cn, setStateInURL } from "../src/ui/lib/utils";

describe("cn", () => {
  it("joins conditional classes and lets later Tailwind utilities win", () => {
    expect(cn("px-2", false && "hidden", { "font-bold": true, italic: false }, ["py-1"])).toBe(
      "px-2 font-bold py-1",
    );
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});

describe("setStateInURL", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/coach?view=list&q=old");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("reads the current query parameters without touching history", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    expect(setStateInURL()).toEqual({ view: "list", q: "old" });
    expect(setStateInURL({})).toEqual({ view: "list", q: "old" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("sets and removes parameters, replacing the history entry by default", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");

    expect(setStateInURL({ view: "detail", q: null, extra: "" })).toEqual({ view: "detail" });
    expect(window.location.search).toBe("?view=detail");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();

    setStateInURL({ q: undefined, page: "2" });
    expect(window.location.search).toBe("?view=detail&page=2");
  });

  it("pushes a new history entry when asked", () => {
    const push = vi.spyOn(window.history, "pushState");
    setStateInURL({ view: "results" }, { addToBrowserHistory: true });
    expect(push).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("?view=results&q=old");
  });

  it("keeps empty-string values when removeNullish is off, but still skips null/undefined", () => {
    expect(setStateInURL({ q: "", view: null, other: undefined }, { removeNullish: false })).toEqual({
      view: "list",
      q: "",
    });
    expect(window.location.search).toBe("?view=list&q=");
  });
});

describe("setStateInURL outside a browser", () => {
  it("returns undefined when there is no window", () => {
    const original = globalThis.window;
    // @ts-expect-error -- simulate SSR
    delete globalThis.window;
    try {
      expect(setStateInURL({ a: "b" })).toBeUndefined();
    } finally {
      globalThis.window = original;
    }
  });
});
