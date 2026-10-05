/**
 * @fileoverview Pins the adapters that let the ebb flow editor's display and
 * keymap settings join the account sync, including that device-local fields
 * stay put when account records are written back.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decodeFlowDisplaySettings,
  decodeFlowKeymap,
  encodeFlowDisplaySettings,
  encodeFlowKeymap,
} from "../src/state/flow-editor-settings-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
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

  it("keeps device-local fields when account records are written", () => {
    backing.set(
      "ebb-display-settings",
      JSON.stringify({ flowFont: "old", flowsDir: "/home/me/flows", sidebarCollapsed: true }),
    );
    writeLocalToolRecords(display, [
      { id: "flowFont", value: "inter" },
      { id: "flowsDir", value: "/evil" },
      { id: "tooltips", value: "nope" },
      { id: "bogus", value: 1 },
    ]);
    expect(JSON.parse(backing.get("ebb-display-settings") as string)).toEqual({
      flowFont: "inter",
      flowsDir: "/home/me/flows",
      sidebarCollapsed: true,
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
