/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { setStateInURL } from "../src/ui/lib/utils";

beforeEach(() => {
  window.history.replaceState({}, "", "/cards");
});

describe("setStateInURL", () => {
  it("reads the current query string when called with no arguments", () => {
    window.history.replaceState({}, "", "/cards?view=search&q=warming");
    expect(setStateInURL()).toEqual({ view: "search", q: "warming" });
  });

  it("writes values into the URL without reloading", () => {
    setStateInURL({ view: "results", q: "china" });
    expect(window.location.search).toBe("?view=results&q=china");
  });

  it("removes a parameter when the value is null or empty", () => {
    window.history.replaceState({}, "", "/cards?view=search&q=warming");
    setStateInURL({ q: null });
    expect(window.location.search).toBe("?view=search");

    setStateInURL({ view: "" });
    expect(window.location.search).toBe("");
  });

  it("keeps nullish values when removeNullish is disabled", () => {
    window.history.replaceState({}, "", "/cards?q=warming");
    setStateInURL({ q: null }, { removeNullish: false });
    expect(window.location.search).toBe("?q=warming");
  });

  it("replaces history by default and pushes when asked", () => {
    const before = window.history.length;
    setStateInURL({ view: "a" });
    expect(window.history.length).toBe(before);

    setStateInURL({ view: "b" }, { addToBrowserHistory: true });
    expect(window.history.length).toBeGreaterThan(before);
    expect(window.location.search).toBe("?view=b");
  });

  it("returns the merged state after a write", () => {
    expect(setStateInURL({ view: "search" })).toEqual({ view: "search" });
  });
});
