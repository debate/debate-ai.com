// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ArgumentTreePanel`: generating an outline
 * from the selected flow, the outline/map view switch, tagging one argument
 * and several at once (written back into the round's flow), filter presets,
 * downloads and clearing.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowStore } from "@debate-ai/round/src/state/store";
import { ArgumentTreePanel } from "../src/panels/ArgumentTreePanel";
import { button, buttons, captureDownloads } from "./helpers/dom";
import { sampleFlow, selectFlow } from "./helpers/flow";
import { click, mount, type, type Mounted } from "./helpers/mount";

// Signed out: no account presets to merge, and saves go nowhere.
vi.mock("@debate-ai/round/src/round/user-settings-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchUserSettings: async () => null,
  saveOutlineFilterPresetOp: async () => {},
}));
vi.mock("@debate-ai/research-evidence/src/account-sync/bulk-storage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  setBulkItem: vi.fn(),
}));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const page = () => document.body.textContent ?? "";

async function open() {
  view = await mount(createElement(ArgumentTreePanel));
  await click(button(view.container, "Generate outline"));
}

beforeEach(() => {
  // jsdom has no layout; applying a preset scrolls its round into view.
  Element.prototype.scrollIntoView = () => {};
  localStorage.clear();
  localStorage.setItem("argumentTreeViewMode", "outline");
  selectFlow(sampleFlow());
});

afterEach(async () => {
  await view.unmount();
  selectFlow(null);
});

describe("ArgumentTreePanel", () => {
  it("outlines the selected flow under its headings", async () => {
    await open();
    expect(text()).toContain("Advantage 1: Warming");
    expect(text()).toContain("Warming causes extinction");
    expect(text()).toContain("Heading");
    expect(text()).toContain("Unanswered");
  });

  it("downloads the outline", async () => {
    await open();
    const downloads = captureDownloads();
    await click(button(view.container, "Download outline"));
    expect(downloads).toHaveLength(1);
  });

  it("switches between the outline and the map views, remembering the choice", async () => {
    await open();
    const tree = Array.from(view.container.querySelectorAll('[role="radio"]')).find(
      (el) => el.getAttribute("aria-checked") === "false",
    ) as HTMLElement;
    await click(tree);
    expect(localStorage.getItem("argumentTreeViewMode")).not.toBe("outline");
    expect(buttons(view.container, "Tag…")).toHaveLength(0);
  });

  it("tags one argument and writes it into the round's flow", async () => {
    await open();
    await click(buttons(view.container, "Tag…")[0]);
    expect(page()).toContain("Tag Argument");
    await type(document.querySelector("#tag-author-id") as HTMLInputElement, "dana");
    await click(button(document.body, "Save"));
    expect(text()).toContain("dana");
    const flow = useFlowStore.getState().flows[0];
    expect(JSON.stringify(flow)).toContain('"authorId":"dana"');
  });

  it("bulk-tags every selected argument", async () => {
    await open();
    const boxes = Array.from(view.container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    await click(boxes[0]);
    await click(boxes[1]);
    await click(button(view.container, "Tag selected…"));
    expect(page()).toContain("Tag 2 Arguments");
    await type(document.querySelector("#tag-author-id") as HTMLInputElement, "sam");
    await click(button(document.body, "Save"));
    expect(JSON.stringify(useFlowStore.getState().flows[0]).match(/"authorId":"sam"/g)).toHaveLength(2);
  });

  it("cancels a tag without changing the flow", async () => {
    await open();
    const before = JSON.stringify(useFlowStore.getState().flows[0]);
    await click(buttons(view.container, "Tag…")[0]);
    await click(button(document.body, "Cancel"));
    expect(JSON.stringify(useFlowStore.getState().flows[0])).toBe(before);
  });

  it("saves a filter preset and removes it", async () => {
    await open();
    await click(button(view.container, "Save preset"));
    await type(view.container.querySelector('input[placeholder="Preset name"]') as HTMLInputElement, "Drops");
    await click(button(view.container, "Save preset"));
    expect(text()).toContain("Drops");
    await click(button(view.container, "Drops"));
    await click(view.container.querySelector('[aria-label="Remove the Drops filter preset"]') as HTMLElement);
    expect(view.container.querySelector('[aria-label="Remove the Drops filter preset"]')).toBeNull();
  });

  it("clears one round", async () => {
    await open();
    await click(button(view.container, "Clear"));
    expect(text()).toContain("No argument outlines yet.");
  });

  it("deletes every saved outline only once confirmed", async () => {
    await open();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await click(button(view.container, "Delete all saved outlines"));
    expect(text()).toContain("Warming causes extinction");
    confirm.mockReturnValueOnce(true);
    await click(button(view.container, "Delete all saved outlines"));
    expect(text()).toContain("No argument outlines yet.");
    confirm.mockRestore();
  });
});
