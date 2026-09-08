// @vitest-environment jsdom
/**
 * @fileoverview Pins `setStateInURL`, the helper behind every shareable timer
 * link. Its whole job is that a reload lands on the same view, so the two
 * things worth pinning are that a written parameter comes back on read and
 * that a cleared one does not linger in the URL a debater copies.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cn, setStateInURL } from "../src/ui/lib/utils";

const at = (search = "") => {
  window.history.replaceState({}, "", `/timer${search}`);
};

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy entries", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("lets a later tailwind class win over an earlier one it conflicts with", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("keeps classes that do not conflict", () => {
    expect(cn("p-2", "text-sm")).toBe("p-2 text-sm");
  });

  it("accepts the conditional forms clsx takes", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("is empty for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("setStateInURL reading", () => {
  beforeEach(() => at());

  it("returns the current parameters as an object", () => {
    at("?view=search&q=warming");
    expect(setStateInURL()).toEqual({ view: "search", q: "warming" });
  });

  it("returns an empty object when the URL carries no parameters", () => {
    expect(setStateInURL()).toEqual({});
  });

  it("reads without writing, so a bare call leaves the URL alone", () => {
    at("?view=search");
    setStateInURL();
    expect(window.location.search).toBe("?view=search");
  });

  it("treats an empty state object as a read", () => {
    at("?view=search");
    expect(setStateInURL({})).toEqual({ view: "search" });
    expect(window.location.search).toBe("?view=search");
  });
});

describe("setStateInURL writing", () => {
  beforeEach(() => at());

  it("writes a parameter into the URL and hands the new state back", () => {
    expect(setStateInURL({ view: "results" })).toEqual({ view: "results" });
    expect(window.location.search).toBe("?view=results");
  });

  it("keeps the parameters it was not asked about", () => {
    at("?q=warming");
    setStateInURL({ view: "results" });
    expect(setStateInURL()).toEqual({ q: "warming", view: "results" });
  });

  it("replaces a parameter already in the URL", () => {
    at("?view=search");
    setStateInURL({ view: "results" });
    expect(window.location.search).toBe("?view=results");
  });

  it("removes a parameter set to null, so a cleared filter is not shared", () => {
    at("?view=search&q=warming");
    setStateInURL({ q: null });
    expect(setStateInURL()).toEqual({ view: "search" });
  });

  it("removes a parameter set to an empty string", () => {
    at("?q=warming");
    setStateInURL({ q: "" });
    expect(window.location.search).toBe("");
  });

  it("removes a parameter set to undefined", () => {
    at("?q=warming");
    setStateInURL({ q: undefined });
    expect(window.location.search).toBe("");
  });

  it("serializes an empty value instead when asked to keep nullish ones", () => {
    at("?q=warming");
    setStateInURL({ q: "" }, { removeNullish: false });
    expect(window.location.search).toBe("?q=");
  });

  it("still drops a null under removeNullish: false, having no value to write", () => {
    at("?q=warming");
    setStateInURL({ q: null }, { removeNullish: false });
    expect(window.location.search).toBe("?q=warming");
  });

  it("encodes a value that needs it", () => {
    setStateInURL({ q: "a & b" });
    expect(window.location.search).toContain("a+%26+b");
    expect(setStateInURL().q).toBe("a & b");
  });

  it("replaces the history entry by default, so the back button leaves the page", () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    setStateInURL({ view: "results" });
    expect(replace).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    replace.mockRestore();
    push.mockRestore();
  });

  it("pushes a history entry when asked, so the back button undoes the change", () => {
    const push = vi.spyOn(window.history, "pushState");
    setStateInURL({ view: "results" }, { addToBrowserHistory: true });
    expect(push).toHaveBeenCalled();
    push.mockRestore();
  });

  it("round-trips several parameters at once", () => {
    setStateInURL({ view: "results", q: "warming", page: "2" });
    expect(setStateInURL()).toEqual({ view: "results", q: "warming", page: "2" });
  });
});
