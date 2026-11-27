/** @vitest-environment jsdom */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  fetchUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
  resetFontFamilyToTheme: vi.fn(),
}));

vi.mock("@debate-ai/round", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/round")>()),
  fetchUserSettings: mocks.fetchUserSettings,
  saveUserSettings: mocks.saveUserSettings,
  resetFontFamilyToTheme: mocks.resetFontFamilyToTheme,
}));

import { THEME_NAMES } from "@debate-ai/round";
import { themeNames } from "@debate-ai/webview/components/theme/ThemeDropdown";
import { ThemesMenu, readActiveColorTheme, THEME_MODE_OPTIONS } from "../components/fumadocs/layout/themes-menu";
import { TooltipProvider } from "../components/ui/tooltip";

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  // jsdom lacks what Radix's popper and next-themes lean on.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(() => {
  localStorage.clear();
  document.cookie = "color-theme=; path=/; max-age=0";
  document.documentElement.className = "";
  mocks.fetchUserSettings.mockResolvedValue(null);
  mocks.saveUserSettings.mockResolvedValue(undefined);
  mocks.resetFontFamilyToTheme.mockReturnValue(false);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

async function mount(ui: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider>{ui}</TooltipProvider>
      </ThemeProvider>,
    ),
  );
}

const trigger = () => document.querySelector<HTMLButtonElement>("[data-themes-trigger]")!;
const menu = () => document.querySelector<HTMLElement>("[data-themes-menu]");

async function openWithKeyboard() {
  await act(async () => {
    trigger().focus();
    trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

describe("ThemesMenu trigger", () => {
  it("is a labelled button with the swatch-book icon, in both looks", async () => {
    await mount(
      <>
        <ThemesMenu variant="toolbar" />
        <ThemesMenu variant="icon" />
      </>,
    );
    const triggers = [...document.querySelectorAll<HTMLButtonElement>("[data-themes-trigger]")];
    expect(triggers).toHaveLength(2);
    for (const button of triggers) {
      expect(button.getAttribute("aria-label")).toBe("Themes");
      expect(button.getAttribute("aria-haspopup")).toBe("menu");
      expect(button.querySelector("svg")?.classList.contains("lucide-swatch-book")).toBe(true);
    }
    expect(triggers[0]!.textContent).toBe("Themes");
    expect(triggers[1]!.getAttribute("title")).toBe("Themes");
  });
});

describe("ThemesMenu items", () => {
  it("offers Light, Dark and System, then every colour theme the app registers", async () => {
    await mount(<ThemesMenu />);
    await openWithKeyboard();
    expect(menu()).not.toBeNull();

    const modes = [...document.querySelectorAll("[data-theme-mode]")].map((el) => el.getAttribute("data-theme-mode"));
    expect(modes).toEqual(["light", "dark", "system"]);
    expect(THEME_MODE_OPTIONS.map((option) => option.value)).toEqual(modes);

    const colors = [...document.querySelectorAll("[data-color-theme]")].map((el) => el.getAttribute("data-color-theme"));
    expect(colors).toEqual([...THEME_NAMES]);
    expect(colors).toEqual([...themeNames]);
    expect(colors.length).toBeGreaterThan(20);
  });

  it("marks the current mode and colour theme", async () => {
    localStorage.setItem("color-theme", "cyberpunk");
    document.documentElement.classList.add("theme-cyberpunk");
    await mount(<ThemesMenu />);
    await openWithKeyboard();

    const checked = [...document.querySelectorAll('[role="menuitemradio"][aria-checked="true"]')];
    expect(checked.map((el) => el.getAttribute("data-theme-mode") ?? el.getAttribute("data-color-theme"))).toEqual([
      "light",
      "cyberpunk",
    ]);
  });

  it("is reachable and operable from the keyboard", async () => {
    await mount(<ThemesMenu />);
    await openWithKeyboard();
    const content = menu()!;
    expect(content.getAttribute("role")).toBe("menu");
    expect(content.getAttribute("aria-label")).toBe("Themes");
    await act(async () => {
      content.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(menu()).toBeNull();
  });
});

describe("ThemesMenu persistence", () => {
  it("stores a colour theme where the app does: localStorage, cookie, <html> class", async () => {
    await mount(<ThemesMenu />);
    await openWithKeyboard();
    await act(async () => {
      document.querySelector<HTMLElement>('[data-color-theme="kodama-grove"]')!.click();
    });
    expect(localStorage.getItem("color-theme")).toBe("kodama-grove");
    expect(document.cookie).toContain("color-theme=kodama-grove");
    expect(document.documentElement.classList.contains("theme-kodama-grove")).toBe(true);
    expect(readActiveColorTheme(document.documentElement)).toBe("kodama-grove");
    expect(menu()).toBeNull();

    await openWithKeyboard();
    const checked = document.querySelector('[data-color-theme][aria-checked="true"]');
    expect(checked?.getAttribute("data-color-theme")).toBe("kodama-grove");
  });

  it("switches colour themes without leaving the previous theme class behind", async () => {
    await mount(<ThemesMenu />);
    await openWithKeyboard();
    await act(async () => {
      document.querySelector<HTMLElement>('[data-color-theme="twitter"]')!.click();
    });
    await openWithKeyboard();
    await act(async () => {
      document.querySelector<HTMLElement>('[data-color-theme="graphite"]')!.click();
    });
    const themeClasses = [...document.documentElement.classList].filter((name) => name.startsWith("theme-"));
    expect(themeClasses).toEqual(["theme-graphite"]);
  });

  it("stores the mode under next-themes' key and applies the dark class, keeping the menu open", async () => {
    await mount(<ThemesMenu />);
    await openWithKeyboard();
    await act(async () => {
      document.querySelector<HTMLElement>('[data-theme-mode="dark"]')!.click();
    });
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(menu()).not.toBeNull();
    expect(document.querySelector('[data-theme-mode][aria-checked="true"]')?.getAttribute("data-theme-mode")).toBe("dark");

    await act(async () => {
      document.querySelector<HTMLElement>('[data-theme-mode="system"]')!.click();
    });
    expect(localStorage.getItem("theme")).toBe("system");
  });

  it("syncs a signed-in account's choice, like the app's own menu", async () => {
    mocks.fetchUserSettings.mockResolvedValue({ colorTheme: "modern-minimal", themeMode: "light" });
    await mount(<ThemesMenu />);
    await openWithKeyboard();
    await act(async () => {
      document.querySelector<HTMLElement>('[data-color-theme="supabase"]')!.click();
    });
    expect(mocks.saveUserSettings).toHaveBeenCalledWith({ colorTheme: "supabase" });
  });
});

describe("readActiveColorTheme", () => {
  it("reads the theme-<name> class and falls back to the default", () => {
    const root = document.createElement("html");
    expect(readActiveColorTheme(root)).toBe("modern-minimal");
    root.className = "dark theme-doom-64";
    expect(readActiveColorTheme(root)).toBe("doom-64");
    root.className = "theme-not-a-theme";
    expect(readActiveColorTheme(root)).toBe("modern-minimal");
  });
});
