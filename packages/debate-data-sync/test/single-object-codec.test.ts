/**
 * @fileoverview Pins the object-to-record adapter that lets the flow editor's
 * `ebb-display-settings` / `ebb-keymap-settings` stores join the account sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SETTINGS_RECORD_ID,
  decodeSingleObject,
  encodeSingleObject,
  redactFlowDisplaySettings,
} from "../src/state/single-object-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  mergeToolRecords,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const display = findToolRecordCollection("flowDisplaySettings") as ToolRecordCollection;
const keymap = findToolRecordCollection("flowKeymapSettings") as ToolRecordCollection;

describe("single-object codec", () => {
  it("wraps a settings object as one record under the fixed id", () => {
    expect(decodeSingleObject({ flowFont: "mono", theme: "dark" })).toEqual([
      { flowFont: "mono", theme: "dark", id: SETTINGS_RECORD_ID },
    ]);
  });

  it("decodes empty, array and scalar stores as no records", () => {
    expect(decodeSingleObject({})).toEqual([]);
    expect(decodeSingleObject([1, 2])).toEqual([]);
    expect(decodeSingleObject("x")).toEqual([]);
    expect(decodeSingleObject(null)).toEqual([]);
  });

  it("round-trips without changing the stored shape", () => {
    const stored = { keymapOverrides: { "ctrl+k": "next" } };
    expect(encodeSingleObject(decodeSingleObject(stored))).toEqual(stored);
  });

  it("encodes to an empty object when no settings record is present", () => {
    expect(encodeSingleObject([])).toEqual({});
    expect(encodeSingleObject([{ id: "other", a: 1 }, null, "x"])).toEqual({});
  });

  it("strips flowsDir from display settings and leaves the rest", () => {
    expect(redactFlowDisplaySettings({ id: "settings", theme: "dark", flowsDir: "/home/me/flows" })).toEqual({
      id: "settings",
      theme: "dark",
    });
    expect(redactFlowDisplaySettings(null)).toBeNull();
  });
});

describe("flow settings catalog entries", () => {
  const backing = new Map<string, string>();

  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers both stores under the keys the flow store writes", () => {
    expect(display).toMatchObject({ storageKey: "ebb-display-settings", idField: "id", href: "/debate" });
    expect(keymap).toMatchObject({ storageKey: "ebb-keymap-settings", idField: "id", href: "/debate" });
  });

  it("reads the stored settings object as one syncable record", () => {
    backing.set("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { a: "b" } }));
    const records = readLocalToolRecords(keymap);
    expect(records).toHaveLength(1);
    expect(isSyncableToolRecord(keymap, records[0])).toBe(true);
  });

  it("writes merged records back in the object shape the flow store reads", () => {
    writeLocalToolRecords(display, [{ id: "settings", theme: "dark", flowFont: "mono" }]);
    expect(JSON.parse(backing.get("ebb-display-settings") ?? "null")).toEqual({ theme: "dark", flowFont: "mono" });
  });

  it("reads an empty or corrupt store as no records", () => {
    expect(readLocalToolRecords(display)).toEqual([]);
    backing.set("ebb-display-settings", "{not json");
    expect(readLocalToolRecords(display)).toEqual([]);
  });

  it("keeps this device's flowsDir when the account's copy replaces the settings", () => {
    const merged = mergeToolRecords(
      display,
      [{ id: "settings", theme: "light", flowsDir: "/home/me/flows" }],
      [{ id: "settings", theme: "dark" }],
    );
    expect(merged).toEqual([{ id: "settings", theme: "dark", flowsDir: "/home/me/flows" }]);
  });
});
