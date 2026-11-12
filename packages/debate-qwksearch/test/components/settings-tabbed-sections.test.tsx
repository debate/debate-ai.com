/** @vitest-environment jsdom */
/**
 * @fileoverview The two tabbed config sections (Rewrite Prompts, Storage):
 * the empty state, their own fields, and the Editor tab that fetches the
 * editor's config the first time it opens.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));

import RewritePrompts from "../../src/components/Settings/Sections/RewritePrompts";
import Storage from "../../src/components/Settings/Sections/Storage";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mount } from "../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const field = (key: string, name: string) => ({ name, key, type: "string", required: false, description: "", scope: "server" });

describe.each([
  ["RewritePrompts", RewritePrompts, "Prompts", "No rewrite prompt settings available."],
  ["Storage", Storage, "Storage", "No storage settings available."],
] as const)("%s", (_name, Section, ownTab, emptyText) => {
  it("shows an empty state without config", () => {
    mount(<Section fields={null} values={null} />);
    expect(bodyText()).toContain(emptyText);
  });

  it("renders its own fields, then loads the editor's on the Editor tab", async () => {
    let resolve: (v: unknown) => void = () => {};
    grab.mockReturnValue(new Promise((r) => (resolve = r)));
    mount(<Section fields={{ a: field("a", "Own field") }} values={{ a: "x" }} />);
    expect(bodyText()).toContain("Own field");

    await clickAsync(button("Editor"));
    expect(grab).toHaveBeenCalledWith("config");
    expect(bodyText()).toContain("Loading editor settings...");
    resolve({ fields: { editor: { f: field("f", "Font size") } }, values: { editor: { f: "12" } } });
    await flush();
    expect(bodyText()).toContain("Font size");

    await clickAsync(button(ownTab));
    expect(bodyText()).toContain("Own field");
    await clickAsync(button("Editor"));
    expect(grab).toHaveBeenCalledTimes(1);
  });

  it("stays on the loading message when the editor config fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    grab.mockRejectedValue(new Error("down"));
    mount(<Section fields={{}} values={{}} />);
    await clickAsync(button("Editor"));
    expect(bodyText()).toContain("Loading editor settings...");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
