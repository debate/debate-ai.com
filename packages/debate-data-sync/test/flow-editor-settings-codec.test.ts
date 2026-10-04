/**
 * @fileoverview Pins the adapters that let the flow editor's display and
 * keymap settings stores join the account sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decodeFlowDisplaySettings,
  decodeFlowKeymapSettings,
  encodeFlowDisplaySettings,
  encodeFlowKeymapSettings,
} from "../src/state/flow-editor-settings-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import { findToolRecordCollection, isSyncableToolRecord } from "../src/state/toolRecordCollections";

const stored = {
  flowFont: "inter",
  defaultGridZoom: 1.2,
  tooltips: false,
  theme: "dark",
  affColor: "#112233",
  negColor: null,
  sidebarCollapsed: true,
  flowsDir: "/Users/me/flows",
  collabName: "Sam",
  collabEnabled: true,
  contacts: { a: 1 },
};

describe("flow display settings codec", () => {
  it("emits one record with only the syncable fields", () => {
    expect(decodeFlowDisplaySettings(stored)).toEqual([
      {
        id: "display",
        flowFont: "inter",
        defaultGridZoom: 1.2,
        tooltips: false,
        theme: "dark",
        affColor: "#112233",
        negColor: null,
      },
    ]);
  });

  it.each([null, undefined, [], "x", 3, {}, { flowsDir: "/x" }])("treats %j as nothing to sync", (raw) => {
    expect(decodeFlowDisplaySettings(raw)).toEqual([]);
  });

  it("drops fields of the wrong type", () => {
    expect(decodeFlowDisplaySettings({ tooltips: "yes", defaultGridZoom: Number.NaN, theme: "light" })).toEqual([
      { id: "display", theme: "light" },
    ]);
  });

  it("keeps device-local fields when writing the account's copy back", () => {
    const records = [{ id: "display", theme: "light", tooltips: true, flowsDir: "/injected", collabName: "evil" }];
    expect(encodeFlowDisplaySettings(records, stored)).toEqual({ ...stored, theme: "light", tooltips: true });
  });

  it("leaves the store alone when no display record is present", () => {
    expect(encodeFlowDisplaySettings([], stored)).toEqual(stored);
    expect(encodeFlowDisplaySettings([{ id: "other", theme: "light" }], undefined)).toEqual({});
  });
});

describe("flow keymap codec", () => {
  it("round-trips the override map", () => {
    const value = { keymapOverrides: { "flow.undo": "Mod-z" } };
    expect(encodeFlowKeymapSettings(decodeFlowKeymapSettings(value))).toEqual(value);
  });

  it("treats an empty or malformed store as nothing to sync", () => {
    expect(decodeFlowKeymapSettings({ keymapOverrides: {} })).toEqual([]);
    expect(decodeFlowKeymapSettings({ keymapOverrides: [1] })).toEqual([]);
    expect(decodeFlowKeymapSettings("nope")).toEqual([]);
  });

  it("drops non-string bindings", () => {
    expect(decodeFlowKeymapSettings({ keymapOverrides: { a: "Mod-a", b: 5 } })).toEqual([
      { id: "keymap", keymapOverrides: { a: "Mod-a" } },
    ]);
  });

  it("encodes to an empty override map when the record is missing", () => {
    expect(encodeFlowKeymapSettings([])).toEqual({ keymapOverrides: {} });
  });
});

describe("catalog entries", () => {
  const backing = new Map<string, string>();
  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("yield syncable records", () => {
    const display = findToolRecordCollection("flowDisplaySettings")!;
    const keymap = findToolRecordCollection("flowKeymapSettings")!;
    expect(isSyncableToolRecord(display, decodeFlowDisplaySettings(stored)[0])).toBe(true);
    expect(isSyncableToolRecord(keymap, decodeFlowKeymapSettings({ keymapOverrides: { a: "b" } })[0])).toBe(true);
  });

  it("writes account records over the stored settings without erasing local fields", () => {
    const display = findToolRecordCollection("flowDisplaySettings")!;
    backing.set("ebb-display-settings", JSON.stringify(stored));
    writeLocalToolRecords(display, [{ id: "display", theme: "light" }]);
    const after = JSON.parse(backing.get("ebb-display-settings") ?? "null");
    expect(after.theme).toBe("light");
    expect(after.flowsDir).toBe("/Users/me/flows");
    expect(readLocalToolRecords(display)).toEqual([expect.objectContaining({ id: "display", theme: "light" })]);
  });
});
