import { afterEach, describe, expect, it, vi } from "vitest";

import { isFontAvailable } from "../src/editor/font-detect";

describe("isFontAvailable", () => {
  afterEach(() => vi.restoreAllMocks());

  it("treats generic keywords and bundled fonts as available", () => {
    expect(isFontAvailable("serif")).toBe(true);
    expect(isFontAvailable("system-ui")).toBe(true);
    expect(isFontAvailable("Calibri")).toBe(true);
    expect(isFontAvailable("OpenDyslexic")).toBe(true);
  });

  it("reports a font whose metrics match every fallback as missing", () => {
    // jsdom lays nothing out, so every probe measures 0×0.
    expect(isFontAvailable("Definitely Not Installed")).toBe(false);
    // The probe span is cleaned up.
    expect(document.body.querySelector("span")).toBeNull();
  });

  it("detects a font whose metrics differ from a fallback, and caches it", () => {
    let width = 0;
    const spy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.style.fontFamily.includes("Fancy Font") ? 99 : width;
      });
    expect(isFontAvailable("Fancy Font")).toBe(true);
    const calls = spy.mock.calls.length;
    width = 5;
    expect(isFontAvailable("Fancy Font")).toBe(true);
    expect(spy.mock.calls.length).toBe(calls);
  });
});
