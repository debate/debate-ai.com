/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flush, renderHook, type RenderedHook } from "../../helpers/render-hook";

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
  theme: { theme: "light" as string | undefined, resolvedTheme: "light" as string | undefined },
  fetchUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
  resetFontFamilyToTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ ...mocks.theme, setTheme: mocks.setTheme }),
}));

vi.mock("@debate-ai/round", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/round")>()),
  fetchUserSettings: mocks.fetchUserSettings,
  saveUserSettings: mocks.saveUserSettings,
  resetFontFamilyToTheme: mocks.resetFontFamilyToTheme,
}));

import { formatThemeName, themeColors, themeNames, useThemeState } from "../../../src/components/theme/ThemeDropdown";

let rendered: RenderedHook<ReturnType<typeof useThemeState>, undefined> | null = null;

async function mountHook() {
  rendered = await renderHook(() => useThemeState());
  await flush();
  return rendered;
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "color-theme=; path=/; max-age=0";
  document.documentElement.className = "";
  mocks.theme.theme = "light";
  mocks.theme.resolvedTheme = "light";
  mocks.fetchUserSettings.mockResolvedValue(null);
  mocks.saveUserSettings.mockResolvedValue(undefined);
  mocks.resetFontFamilyToTheme.mockReturnValue(false);
});

afterEach(async () => {
  await rendered?.unmount();
  rendered = null;
  vi.clearAllMocks();
});

describe("theme registry", () => {
  it("only previews themes the app actually offers, with hex swatches", () => {
    expect(themeNames.length).toBeGreaterThan(5);
    for (const name of Object.keys(themeColors)) {
      expect(themeNames).toContain(name);
      expect(themeColors[name]!.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(themeColors[name]!.secondary).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("formats a kebab-case theme name for display", () => {
    expect(formatThemeName("modern-minimal")).toBe("Modern Minimal");
    expect(formatThemeName("cyberpunk")).toBe("Cyberpunk");
    expect(formatThemeName("doom-64")).toBe("Doom 64");
  });
});

describe("useThemeState", () => {
  it("starts on the default theme class when nothing is saved", async () => {
    const { result } = await mountHook();
    expect(result.current.mounted).toBe(true);
    expect(result.current.colorTheme).toBe("modern-minimal");
    expect(document.documentElement.classList.contains("theme-modern-minimal")).toBe(true);
  });

  it("restores a saved theme and ignores an unknown one", async () => {
    localStorage.setItem("color-theme", "cyberpunk");
    const first = await mountHook();
    expect(first.result.current.colorTheme).toBe("cyberpunk");
    expect(document.documentElement.classList.contains("theme-cyberpunk")).toBe(true);
    await first.unmount();

    document.documentElement.className = "";
    localStorage.setItem("color-theme", "no-such-theme");
    const second = await mountHook();
    expect(second.result.current.colorTheme).toBe("modern-minimal");
  });

  it("adopts the account's theme and mode when they differ from this device", async () => {
    mocks.fetchUserSettings.mockResolvedValue({ colorTheme: "nature", themeMode: "dark" });
    const { result } = await mountHook();
    expect(result.current.colorTheme).toBe("nature");
    expect(localStorage.getItem("color-theme")).toBe("nature");
    expect(document.cookie).toContain("color-theme=nature");
    expect(document.documentElement.classList.contains("theme-nature")).toBe(true);
    expect(mocks.setTheme).toHaveBeenCalledWith("dark");
  });

  it("ignores invalid values from the account and survives a failed load", async () => {
    mocks.fetchUserSettings.mockResolvedValue({ colorTheme: "bogus", themeMode: "sepia" });
    const { result } = await mountHook();
    expect(result.current.colorTheme).toBe("modern-minimal");
    expect(mocks.setTheme).not.toHaveBeenCalled();
    await rendered!.unmount();

    mocks.fetchUserSettings.mockRejectedValue(new Error("offline"));
    const again = await mountHook();
    expect(again.result.current.colorTheme).toBe("modern-minimal");
  });

  it("picks a theme: saves locally, swaps the root class, and does not sync when signed out", async () => {
    const { result } = await mountHook();
    await flush(() => result.current.handleThemeChange("bubblegum"));
    expect(result.current.colorTheme).toBe("bubblegum");
    expect(localStorage.getItem("color-theme")).toBe("bubblegum");
    expect(document.documentElement.classList.contains("theme-bubblegum")).toBe(true);
    expect(document.documentElement.classList.contains("theme-modern-minimal")).toBe(false);
    expect(mocks.saveUserSettings).not.toHaveBeenCalled();
  });

  it("syncs a picked theme to the account when signed in, resetting the font if one was overridden", async () => {
    mocks.fetchUserSettings.mockResolvedValue({ colorTheme: "modern-minimal", themeMode: "light" });
    const { result } = await mountHook();
    await flush(() => result.current.handleThemeChange("nature"));
    expect(mocks.saveUserSettings).toHaveBeenLastCalledWith({ colorTheme: "nature" });

    mocks.resetFontFamilyToTheme.mockReturnValue(true);
    await flush(() => result.current.handleThemeChange("twitter"));
    expect(mocks.saveUserSettings).toHaveBeenLastCalledWith({ colorTheme: "twitter", fontFamily: "system-default" });
  });

  it("ignores a failed account sync", async () => {
    mocks.fetchUserSettings.mockResolvedValue({ colorTheme: "modern-minimal", themeMode: "light" });
    mocks.saveUserSettings.mockRejectedValue(new Error("500"));
    const { result } = await mountHook();
    await flush(() => result.current.handleThemeChange("nature"));
    expect(result.current.colorTheme).toBe("nature");
  });

  it("previews a theme and restores the chosen one when the preview ends", async () => {
    const { result } = await mountHook();
    await flush(() => result.current.handleThemePreview("cyberpunk"));
    expect(document.documentElement.classList.contains("theme-cyberpunk")).toBe(true);
    await flush(() => result.current.handlePreviewEnd());
    expect(document.documentElement.classList.contains("theme-cyberpunk")).toBe(false);
    expect(document.documentElement.classList.contains("theme-modern-minimal")).toBe(true);
  });

  it("keeps a committed theme when a stale handler ends the preview afterwards", async () => {
    const { result } = await mountHook();
    const { handleThemePreview, handleThemeChange, handlePreviewEnd } = result.current;
    await flush(() => handleThemePreview("cyberpunk"));
    await flush(() => {
      handleThemeChange("cyberpunk");
      handlePreviewEnd();
    });
    expect(document.documentElement.classList.contains("theme-cyberpunk")).toBe(true);
    expect(localStorage.getItem("color-theme")).toBe("cyberpunk");
  });

  it("does nothing when a preview ends without one started", async () => {
    const { result } = await mountHook();
    const before = document.documentElement.className;
    await flush(() => result.current.handlePreviewEnd());
    expect(document.documentElement.className).toBe(before);
  });

  it("flips light and dark from the resolved theme, falling back through theme to light", async () => {
    const { result } = await mountHook();
    await flush(() => result.current.toggleLightDark());
    expect(mocks.setTheme).toHaveBeenLastCalledWith("dark");

    mocks.theme.resolvedTheme = "dark";
    await rendered!.rerender(undefined);
    await flush(() => rendered!.result.current.toggleLightDark());
    expect(mocks.setTheme).toHaveBeenLastCalledWith("light");
    expect(rendered!.result.current.isDark).toBe(true);

    mocks.theme.resolvedTheme = undefined;
    mocks.theme.theme = undefined;
    await rendered!.rerender(undefined);
    await flush(() => rendered!.result.current.toggleLightDark());
    expect(mocks.setTheme).toHaveBeenLastCalledWith("dark");
    expect(rendered!.result.current.isDark).toBe(false);
  });

  it("sets the mode explicitly and syncs it when signed in", async () => {
    mocks.fetchUserSettings.mockResolvedValue({ colorTheme: "modern-minimal", themeMode: "light" });
    const { result } = await mountHook();
    await flush(() => result.current.setMode("system"));
    expect(mocks.setTheme).toHaveBeenLastCalledWith("system");
    expect(mocks.saveUserSettings).toHaveBeenLastCalledWith({ themeMode: "system" });
  });
});
