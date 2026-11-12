/** @vitest-environment jsdom */
/**
 * @fileoverview AI Rewrite Modes settings: lists the saved modes, adds,
 * edits, deletes and resets them, persisting through write-language's store.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const store = vi.hoisted(() => {
  const defaults = [
    { id: "concise", name: "Concise", prompt: "Make it shorter", color: "green" },
    { id: "formal", name: "Formal", prompt: "Make it formal", color: "nope" },
  ];
  const state = { modes: [] as Array<{ id: string; name: string; prompt: string; color?: string }> };
  return {
    defaults,
    state,
    getRewriteModes: vi.fn(() => state.modes.map((m) => ({ ...m }))),
    saveRewriteModes: vi.fn((modes: typeof state.modes) => {
      state.modes = modes;
    }),
    resetRewriteModes: vi.fn(() => {
      state.modes = defaults.map((m) => ({ ...m }));
    }),
  };
});
vi.mock("write-language/rewrite-modes", () => store);

import AIRewriteModes from "../../src/components/Settings/Sections/AIRewriteModes";
import { bodyText, button, change, cleanup, click, installDomShims, mount } from "../helpers/dom";

beforeAll(installDomShims);
beforeEach(() => {
  store.state.modes = store.defaults.map((m) => ({ ...m }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** The row's edit and delete icon buttons, in mode order. */
const rowButtons = () =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.textContent?.trim());

describe("AI Rewrite Modes settings", () => {
  it("lists the saved modes", () => {
    mount(<AIRewriteModes />);
    expect(bodyText()).toContain("Concise");
    expect(bodyText()).toContain("Make it formal");
    // An unknown colour falls back to the blue badge.
    expect(document.querySelectorAll(".bg-blue-100")).toHaveLength(1);
  });

  it("adds a mode, with defaults for blank fields", () => {
    mount(<AIRewriteModes />);
    click(button("Add New Mode"));
    click(button("Add Mode"));
    expect(toast.success).toHaveBeenCalledWith("Mode added");
    const added = store.state.modes.at(-1)!;
    expect(added).toMatchObject({ name: "New Mode", prompt: "Rewrite this text:", color: "blue" });
    expect(added.id).toMatch(/^custom-/);
  });

  it("adds a named mode with a chosen colour", () => {
    mount(<AIRewriteModes />);
    click(button("Add New Mode"));
    change(document.querySelector('input[placeholder="Mode name"]')!, "Punchy");
    change(document.querySelector('textarea[placeholder="Rewrite prompt..."]')!, "Make it punchy");
    change(document.querySelector("select")!, "pink");
    click(button("Add Mode"));
    expect(store.state.modes.at(-1)).toMatchObject({ name: "Punchy", prompt: "Make it punchy", color: "pink" });
    expect(bodyText()).toContain("Punchy");
  });

  it("edits, cancels, deletes and resets", () => {
    mount(<AIRewriteModes />);
    click(rowButtons()[0]);
    change(document.querySelector('input[placeholder="Mode name"]')!, "Short");
    click(button("Save"));
    expect(toast.success).toHaveBeenCalledWith("Mode updated");
    expect(store.state.modes[0].name).toBe("Short");

    click(rowButtons()[0]);
    click(button("Cancel"));
    expect(bodyText()).toContain("Add New Mode");

    click(rowButtons()[1]);
    expect(toast.success).toHaveBeenCalledWith("Mode deleted");
    expect(store.state.modes.map((m) => m.id)).toEqual(["formal"]);

    click(button("Reset to Defaults"));
    expect(store.resetRewriteModes).toHaveBeenCalled();
    expect(bodyText()).toContain("Concise");
  });
});
