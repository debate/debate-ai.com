/**
 * @fileoverview Pins the adapter that lets the Ebb flow editor's two
 * single-object settings stores join the account sync, and what it keeps
 * on-device.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FLOW_EDITOR_SETTINGS_RECORD_ID,
  SYNCED_FLOW_DISPLAY_FIELDS,
  decodeFlowEditorSettings,
  encodeFlowEditorSettings,
  redactFlowDisplaySettings,
} from "../src/state/flow-editor-settings-codec";
import {
  mergeToolRecords,
  findToolRecordCollection,
  isSyncableToolRecord,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const display = findToolRecordCollection("flowEditorDisplay") as ToolRecordCollection;
const keymap = findToolRecordCollection("flowEditorKeymap") as ToolRecordCollection;

describe("flow editor display codec", () => {
  it("emits one record per synced field and skips device-local ones", () => {
    const records = decodeFlowDisplaySettings({
      flowFont: "inter",
      tooltips: false,
      flowsDir: "/home/me/flows",
      sidebarCollapsed: true,
      rfdOpen: true,
    });
    expect(records).toEqual([
      { id: "flowFont", value: "inter" },
      { id: "tooltips", value: false },
    ]);
  });

  it("drops values that fail validation and non-object input", () => {
    expect(decodeFlowDisplaySettings({ defaultGridZoom: 99, affColor: "red", rfdVim: "yes" })).toEqual([]);
    expect(decodeFlowDisplaySettings(null)).toEqual([]);
    expect(decodeFlowDisplaySettings([1])).toEqual([]);
    expect(decodeFlowDisplaySettings("x")).toEqual([]);
  });

  it("accepts a null team colour (unset) and a valid hex", () => {
    expect(decodeFlowDisplaySettings({ affColor: null, negColor: "#aabbcc" })).toEqual([
      { id: "affColor", value: null },
      { id: "negColor", value: "#aabbcc" },
    ]);
  });
});

describe("flow editor stores through the shared read/write helpers", () => {
  const backing = new Map<string, string>();
  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the plain object debate-flow wrote", () => {
    backing.set("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { a: "b" } }));

    expect(readLocalToolRecords(keymap)).toEqual([{ id: "settings", keymapOverrides: { a: "b" } }]);
  });

  it("writes a merged record back as the plain object debate-flow reads", () => {
    writeLocalToolRecords(keymap, [{ id: "settings", keymapOverrides: { a: "b" } }]);

    expect(JSON.parse(backing.get("ebb-keymap-settings") as string)).toEqual({
      keymapOverrides: { a: "b" },
    });
  });

  it("writes into an empty store and round-trips", () => {
    writeLocalToolRecords(display, [{ id: "scrollZoom", value: false }]);
    expect(readLocalToolRecords(display)).toEqual([{ id: "scrollZoom", value: false }]);
    expect(isSyncableToolRecord(display, { id: "scrollZoom", value: false })).toBe(true);
  });

  it("returns no records for a corrupted store", () => {
    backing.set("ebb-display-settings", "{not json");
    expect(readLocalToolRecords(display)).toEqual([]);
  });
});

describe("flow editor keymap codec", () => {
  it("flattens overrides to records and back", () => {
    const stored = { keymapOverrides: { newSheet: "Mod+T", undo: "Mod+Z" } };
    const records = decodeFlowKeymap(stored);
    expect(records).toEqual([
      { id: "newSheet", value: "Mod+T" },
      { id: "undo", value: "Mod+Z" },
    ]);
    expect(encodeFlowKeymap(records)).toEqual(stored);
  });

  it("ignores malformed overrides and records", () => {
    expect(decodeFlowKeymap({ keymapOverrides: { a: 3, "": "x", ok: "K" } })).toEqual([{ id: "ok", value: "K" }]);
    expect(decodeFlowKeymap({})).toEqual([]);
    expect(decodeFlowKeymap(undefined)).toEqual([]);
    expect(encodeFlowKeymap([{ id: "a", value: 3 }, "junk", null, { id: "b", value: "B" }])).toEqual({
      keymapOverrides: { b: "B" },
    });
  });

  it("works through the shared helpers", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    writeLocalToolRecords(keymap, [{ id: "undo", value: "Mod+Z" }]);
    expect(readLocalToolRecords(keymap)).toEqual([{ id: "undo", value: "Mod+Z" }]);
    vi.unstubAllGlobals();
  });
});
