/** @vitest-environment jsdom */
/**
 * @fileoverview A research-agent settings tab: loading its config, the
 * retry state when that fails, rendering the section keyed by its `dataAdd`
 * slice, field commits (client fields to localStorage, server fields to the
 * config API), the colour-theme picker, the copy-link anchors and the hash
 * highlight.
 */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));
const themes = vi.hoisted(() => ({ theme: "light", setTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => themes }));
vi.mock("research-agent-ui", () => ({
  VoiceSettingsPanel: () => <div>Voice panel</div>,
  useChat: () => ({ setChatModelProvider: vi.fn() }),
}));
vi.mock("chat-agent-toolkit", () => ({ cropProviderAsDataURL: vi.fn() }));
vi.mock("chat-agent-toolkit/connectors/openconnector-providers-index.json", () => ({ default: [] }));
vi.mock("qwksearch-api-client", () => ({}));
vi.mock("../../src/components/connect-auth", () => ({
  useQwkSearchSession: () => ({ session: { connected: false }, isPending: false }),
  connectQwkSearch: vi.fn(),
  disconnectQwkSearch: vi.fn(),
  loadQwkSearchSession: vi.fn(),
}));

import ResearchSettingsSection from "../../src/components/Settings/ResearchSettingsSection";
import Preferences from "../../src/components/Settings/Sections/Preferences";
import { AnchorTitle, copyAnchorLink, highlightAnchor } from "../../src/components/Settings/anchors";
import { bodyText, button, change, cleanup, click, flush, installDomShims, keyDown, mount } from "../helpers/dom";

beforeAll(installDomShims);
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/settings?category=research-search");
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => {}) },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  error.mockRestore();
  vi.useRealTimers();
});

const searchFields = [
  { name: "Search region", key: "region", type: "string", required: false, description: "Where to search", scope: "server", placeholder: "us" },
  { name: "Safe search", key: "safe", type: "switch", required: false, description: "Filter results", scope: "client", default: false },
];

function blur(el: Element) {
  act(() => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

describe("ResearchSettingsSection", () => {
  it("loads the config and renders the section's slice", async () => {
    grab.mockResolvedValue({ fields: { search: searchFields }, values: { search: { region: "uk" } } });
    mount(<ResearchSettingsSection sectionKey="search" />);
    await flush();
    expect(grab).toHaveBeenCalledWith("config");
    expect(bodyText()).toContain("Search region");
    expect(document.querySelector<HTMLInputElement>('input[placeholder="us"]')!.value).toBe("uk");
  });

  it("saves a server field to the config API on blur", async () => {
    grab.mockResolvedValue({ fields: { search: searchFields }, values: { search: {} } });
    mount(<ResearchSettingsSection sectionKey="search" />);
    await flush();
    const input = document.querySelector<HTMLInputElement>('input[placeholder="us"]')!;
    change(input, "de");
    blur(input);
    await flush();
    expect(grab).toHaveBeenCalledWith("config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "search.region", value: "de" }),
    });
  });

  it("reports a failed server save", async () => {
    grab.mockImplementation(async (_path: string, init?: { method?: string }) => {
      if (init?.method === "POST") throw new Error("down");
      return { fields: { search: searchFields }, values: { search: {} } };
    });
    mount(<ResearchSettingsSection sectionKey="search" />);
    await flush();
    const input = document.querySelector<HTMLInputElement>('input[placeholder="us"]')!;
    change(input, "fr");
    blur(input);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to save configuration.");
  });

  it("stores a client field locally and announces the change", async () => {
    grab.mockResolvedValue({ fields: { search: searchFields }, values: { search: {} } });
    const changed = vi.fn();
    window.addEventListener("client-config-changed", changed);
    mount(<ResearchSettingsSection sectionKey="search" />);
    await flush();
    act(() => {
      document.querySelector<HTMLButtonElement>("[role=switch]")!.click();
    });
    await flush();
    expect(localStorage.getItem("safe")).toBe("true");
    expect(changed).toHaveBeenCalled();
    window.removeEventListener("client-config-changed", changed);
  });

  it("offers a retry when the config fails to load", async () => {
    grab.mockResolvedValueOnce({ message: "Unauthorized" });
    mount(<ResearchSettingsSection sectionKey="search" />);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to load configuration.");
    expect(bodyText()).toContain("Failed to load settings.");
    grab.mockResolvedValueOnce({ fields: { search: searchFields }, values: { search: {} } });
    click(button("Try again"));
    await flush();
    expect(bodyText()).toContain("Safe search");
  });

  it("renders nothing for an unknown section", async () => {
    grab.mockResolvedValue({ fields: {}, values: {} });
    mount(<ResearchSettingsSection sectionKey="nope" />);
    await flush();
    expect(bodyText()).toBe("");
  });

  it("renders sections that take no config slice", async () => {
    grab.mockResolvedValue({ fields: {}, values: {} });
    mount(<ResearchSettingsSection sectionKey="voice" />);
    await flush();
    expect(bodyText()).toContain("Voice panel");
  });

  it("highlights the field named by the URL hash", async () => {
    grab.mockResolvedValue({ fields: { search: searchFields }, values: { search: {} } });
    window.history.replaceState(null, "", "/settings#search-region");
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    mount(<ResearchSettingsSection sectionKey="search" />);
    await flush();
    expect(document.getElementById("search-region")!.classList.contains("settings-anchor-highlight")).toBe(true);
    act(() => {
      window.location.hash = "search-safe";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(document.getElementById("search-safe")!.classList.contains("settings-anchor-highlight")).toBe(true);
    raf.mockRestore();
  });
});

describe("Preferences and the theme picker", () => {
  const themeField = { name: "Theme", key: "theme", type: "theme", required: false, description: "Colours", scope: "client", options: [] };
  const langField = { name: "Language", key: "lang", type: "string", required: false, description: "", scope: "client", placeholder: "en" };

  it("reads client values from localStorage", () => {
    localStorage.setItem("lang", "fr");
    mount(<Preferences fields={[langField] as never} values={{}} />);
    expect(document.querySelector<HTMLInputElement>('input[placeholder="en"]')!.value).toBe("fr");
  });

  it("picks a colour theme and toggles light/dark", () => {
    localStorage.setItem("color-theme", "cyberpunk");
    mount(<Preferences fields={[themeField] as never} values={{}} />);
    expect(bodyText()).toContain("Cyberpunk");
    click(document.querySelector('button[title="Toggle light/dark"]')!);
    expect(themes.setTheme).toHaveBeenCalledWith("dark");

    const trigger = document.querySelector<HTMLElement>("[role=combobox]")!;
    keyDown(trigger, "Enter");
    const option = [...document.querySelectorAll<HTMLElement>("[role=option]")].find((el) => el.textContent?.includes("Nature"))!;
    act(() => option.focus());
    keyDown(option, "Enter");
    expect(localStorage.getItem("color-theme")).toBe("nature");
    expect(document.documentElement.classList.contains("theme-nature")).toBe(true);
    expect(document.documentElement.classList.contains("theme-cyberpunk")).toBe(false);
    expect(document.cookie).toContain("color-theme=nature");
  });

  it("writes a client 'theme' field through next-themes", async () => {
    const field = { name: "Mode", key: "theme", type: "string", required: false, description: "", scope: "client", placeholder: "system" };
    mount(<Preferences fields={[field] as never} values={{}} />);
    const input = document.querySelector<HTMLInputElement>('input[placeholder="system"]')!;
    change(input, "dark");
    blur(input);
    await flush();
    expect(themes.setTheme).toHaveBeenCalledWith("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("copies a field's link from its title button", async () => {
    mount(<Preferences fields={[langField] as never} values={{}} />);
    click(document.querySelector('button[title="Copy link to this section"]')!);
    await flush();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/settings?category=research-search#preferences-lang`);
    expect(toast.success).toHaveBeenCalledWith("Link copied to clipboard");
  });
});

describe("settings anchors", () => {
  it("returns false for a missing anchor", () => {
    expect(highlightAnchor("missing")).toBe(false);
  });

  it("highlights then clears an anchor", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    el.id = "a1";
    document.body.appendChild(el);
    expect(highlightAnchor("a1")).toBe(true);
    expect(el.classList.contains("settings-anchor-highlight")).toBe(true);
    vi.advanceTimersByTime(2400);
    expect(el.classList.contains("settings-anchor-highlight")).toBe(false);
  });

  it("reports a failed copy and drops other query params", async () => {
    window.history.replaceState(null, "", "/settings?foo=1");
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("denied"));
    copyAnchorLink();
    await flush();
    expect(window.location.search).toBe("");
    expect(toast.error).toHaveBeenCalledWith("Failed to copy link");
  });

  it("AnchorTitle copies its anchor's link", async () => {
    mount(<AnchorTitle anchorId="x1">Heading</AnchorTitle>);
    click(button("Heading"));
    await flush();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("#x1"));
  });
});
