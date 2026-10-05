/**
 * @fileoverview Pins the adapters that let the flow editor's display and
 * keymap settings stores join the account sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decodeFlowEditorDisplay,
  decodeFlowEditorKeymap,
  encodeFlowEditorDisplay,
  encodeFlowEditorKeymap,
  redactFlowEditorDisplay,
} from "../src/state/flow-editor-settings-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  mergeToolRecords,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const display = { flowFont: "mono", defaultGridZoom: 1.2, theme: "dark", flowsDir: "/Users/a/flows" };

describe("display settings codec", () => {
  it("wraps the stored object in one record with a fixed id", () => {
    expect(decodeFlowEditorDisplay(display)).toEqual([{ ...display, id: "display" }]);
  });

  it("round-trips without changing the stored shape", () => {
    expect(encodeFlowEditorDisplay(decodeFlowEditorDisplay(display))).toEqual(display);
  });

  it("ignores missing or malformed stores", () => {
    for (const bad of [null, undefined, "x", 3, [1]]) expect(decodeFlowEditorDisplay(bad)).toEqual([]);
    expect(encodeFlowEditorDisplay([])).toEqual({});
    expect(encodeFlowEditorDisplay([{ id: "other", a: 1 }, "junk"])).toEqual({});
  });

  it("redacts the per-device flows folder only", () => {
    expect(redactFlowEditorDisplay({ id: "display", theme: "dark", flowsDir: "/x" })).toEqual({
      id: "display",
      theme: "dark",
    });
    expect(redactFlowEditorDisplay("x")).toBe("x");
  });
});

describe("keymap codec", () => {
  it("wraps string overrides in one record", () => {
    expect(decodeFlowEditorKeymap({ keymapOverrides: { undo: "Mod+Z", bad: 3 } })).toEqual([
      { id: "keymap", keymapOverrides: { undo: "Mod+Z" } },
    ]);
  });

  it("yields no record when nothing is rebound or the store is malformed", () => {
    expect(decodeFlowEditorKeymap({ keymapOverrides: {} })).toEqual([]);
    expect(decodeFlowEditorKeymap({ keymapOverrides: [] })).toEqual([]);
    expect(decodeFlowEditorKeymap(null)).toEqual([]);
  });

  it("round-trips and falls back to no overrides", () => {
    const stored = { keymapOverrides: { undo: "Mod+Z" } };
    expect(encodeFlowEditorKeymap(decodeFlowEditorKeymap(stored))).toEqual(stored);
    expect(encodeFlowEditorKeymap([])).toEqual({ keymapOverrides: {} });
  });
});

describe("catalog entries", () => {
  const displayCollection = findToolRecordCollection("flowEditorDisplay") as ToolRecordCollection;
  const keymapCollection = findToolRecordCollection("flowEditorKeymap") as ToolRecordCollection;

  const backing = new Map<string, string>();
  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("registers both stores under their legacy localStorage keys", () => {
    expect(displayCollection.storageKey).toBe("ebb-display-settings");
    expect(keymapCollection.storageKey).toBe("ebb-keymap-settings");
  });

  it("keeps this device's flowsDir when the account's copy lacks it", () => {
    backing.set("ebb-display-settings", JSON.stringify(display));
    const local = readLocalToolRecords(displayCollection);
    const remote = [{ id: "display", theme: "light", flowFont: "serif" }];
    writeLocalToolRecords(displayCollection, mergeToolRecords(displayCollection, local, remote));

    expect(JSON.parse(backing.get("ebb-display-settings") ?? "null")).toEqual({
      theme: "light",
      flowFont: "serif",
      defaultGridZoom: 1.2,
      flowsDir: "/Users/a/flows",
    });
  });

  it("writes the account's keymap back in the editor's own shape", () => {
    writeLocalToolRecords(keymapCollection, [{ id: "keymap", keymapOverrides: { undo: "Mod+Y" } }]);
    expect(JSON.parse(backing.get("ebb-keymap-settings") ?? "null")).toEqual({
      keymapOverrides: { undo: "Mod+Y" },
    });
  });
});
