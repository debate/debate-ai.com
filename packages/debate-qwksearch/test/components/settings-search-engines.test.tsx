/** @vitest-environment jsdom */
/**
 * @fileoverview Search Engines settings: engines load grouped by category,
 * tabs switch category, the filter searches every category, toggles save the
 * enabled list, and "Test All" reports which engines work and can drop the
 * broken ones.
 */
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));

import SearchEngines from "../../src/components/Settings/Sections/SearchEngines";
import { bodyText, button, byText, change, cleanup, click, clickAsync, flush, installDomShims, mount } from "../helpers/dom";

beforeAll(installDomShims);
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  error.mockRestore();
});

const engines = {
  web: [
    { name: "duck_duck_go", categories: ["web"], domain: "duckduckgo.com", description: "Private search" },
    { name: "brave", categories: ["web", "news"] },
  ],
  news: [{ name: "reuters", categories: ["news"], domain: "reuters.com" }],
};

function serve(opts: { saveFails?: boolean; testFails?: boolean } = {}) {
  grab.mockImplementation(async (path: string, init?: { method?: string; body?: string }) => {
    if (path === "search/engines") return { engines };
    if (path === "search/engines/status" && init?.method === "POST") {
      if (opts.saveFails) throw new Error("save");
      return {};
    }
    if (path === "search/engines/status") return { enabledEngines: ["duck_duck_go", "brave"] };
    if (path === "search/engines/test") {
      if (opts.testFails) throw new Error("test");
      return { results: { duck_duck_go: { name: "duck_duck_go", working: true }, brave: { name: "brave", working: false, error: "timeout" } } };
    }
    throw new Error(`unexpected ${path}`);
  });
}

const switches = () => [...document.querySelectorAll<HTMLButtonElement>("[role=switch]")];

describe("Search Engines settings", () => {
  it("loads engines into category tabs and switches between them", async () => {
    serve();
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    expect(bodyText()).toContain("Total: 3 engines across 2 categories");
    // "news" sorts first, so it's the opening tab.
    expect(bodyText()).toContain("reuters");
    click(byText("web", "button"));
    expect(bodyText()).toContain("duck duck go");
    expect(bodyText()).toContain("Test All (2)");
  });

  it("shows an engine's details when its row is picked", async () => {
    serve();
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    click(byText("web", "button"));
    click(byText("duck duck go", "button"));
    expect(bodyText()).toContain("Private search");
    expect(bodyText()).toContain("duckduckgo.com");
    click(byText("brave", "button"));
    expect(bodyText()).toContain("No description available.");
    // A favicon that fails to load falls back to the engine's initial.
    const before = document.querySelectorAll("img").length;
    act(() => {
      document.querySelector("img")!.dispatchEvent(new Event("error"));
    });
    expect(document.querySelectorAll("img").length).toBe(before - 1);
  });

  it("filters across every category", async () => {
    serve();
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    change(document.querySelector('input[placeholder="Filter engines…"]')!, "r");
    expect(bodyText()).toContain('2 results for "r"');
    change(document.querySelector('input[placeholder="Filter engines…"]')!, "brave");
    expect(bodyText()).toContain('1 result for "brave"');
    change(document.querySelector('input[placeholder="Filter engines…"]')!, "zzz");
    expect(bodyText()).toContain("No engines found");
  });

  it("saves a toggle and reverts it when the save fails", async () => {
    serve();
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    await clickAsync(switches()[0]); // reuters on
    expect(grab).toHaveBeenCalledWith(
      "search/engines/status",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ enabledEngines: ["duck_duck_go", "brave", "reuters"] }) }),
    );
    expect(bodyText()).toContain("Test All (3)");
    await clickAsync(switches()[0]); // and off again
    expect(bodyText()).toContain("Test All (2)");
  });

  it("reverts a toggle whose save fails", async () => {
    serve({ saveFails: true });
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    await clickAsync(switches()[0]);
    expect(toast.error).toHaveBeenCalledWith("Failed to save engine status");
    expect(bodyText()).toContain("Test All (2)");
  });

  it("tests every enabled engine and removes the broken ones", async () => {
    serve();
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    await clickAsync(button(/Test All/));
    expect(toast.success).toHaveBeenCalledWith("1/2 search engines working");
    expect(bodyText()).toContain("1/2 working");
    click(byText("web", "button"));
    expect(bodyText()).toContain("✓ Working");
    expect(bodyText()).toContain("timeout");
    await clickAsync(button("Remove Non-Working"));
    expect(toast.success).toHaveBeenCalledWith("Disabled 1 non-working engines");
    expect(bodyText()).toContain("Test All (1)");
  });

  it("reports failures loading and testing engines", async () => {
    serve({ testFails: true });
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    await clickAsync(button(/Test All/));
    expect(toast.error).toHaveBeenCalledWith("Failed to test search engines");

    cleanup();
    grab.mockRejectedValue(new Error("down"));
    mount(<SearchEngines fields={[]} values={{}} />);
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Failed to load search engines");
    expect(bodyText()).toContain("Total: 0 engines");
  });
});
