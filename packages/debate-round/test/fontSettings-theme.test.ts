// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { applyFontFamily, readLocalFontFamily, resetFontFamilyToTheme, setLocalFontFamily } from "../src/state/fontSettings";

describe("font override vs. the colour theme's font", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("sets the override as --app-font and clears it for Theme Default", () => {
    applyFontFamily("Lato");
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe("Lato");
    expect(document.documentElement.style.fontFamily).toBe("");
    applyFontFamily("system-default");
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe("");
  });

  it("clears a legacy inline font-family so it cannot pin the shell", () => {
    document.documentElement.style.fontFamily = "Georgia";
    document.body.style.fontFamily = "Georgia";
    applyFontFamily("system-default");
    expect(document.documentElement.style.fontFamily).toBe("");
    expect(document.body.style.fontFamily).toBe("");
  });

  it("picking a theme drops the explicit font so the theme's font shows", () => {
    setLocalFontFamily("Lato");
    expect(resetFontFamilyToTheme()).toBe(true);
    expect(readLocalFontFamily()).toBe("system-default");
    expect(document.documentElement.style.getPropertyValue("--app-font")).toBe("");
    expect(resetFontFamilyToTheme()).toBe(false);
  });
});
