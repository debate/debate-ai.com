/**
 * @fileoverview The flow editor's display and keymap stores joining the
 * account sync: only user preferences travel, device-local fields survive.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFlowDisplaySettings,
  decodeFlowKeymapSettings,
  encodeFlowDisplaySettings,
  encodeFlowKeymapSettings,
} from "../src/state/flow-settings-codec";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
} from "../src/state/toolRecordCollections";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";

const display = findToolRecordCollection("flowDisplaySettings")!;
const keymap = findToolRecordCollection("flowKeymapSettings")!;

describe("decodeFlowDisplaySettings", () => {
  it("keeps preferences and drops device-local fields", () => {
    const [record] = decodeFlowDisplaySettings({
      flowFont: "mono",
      defaultGridZoom: 1.2,
      theme: "dark",
      affColor: "#112233",
      negColor: null,
      tooltips: false,
      flowsDir: "/home/me/flows",
      collabName: "Me",
      contacts: { a: 1 },
      sidebarCollapsed: true,
    }) as Record<string, unknown>[];
    expect(record).toEqual({
      id: "settings",
      flowFont: "mono",
      defaultGridZoom: 1.2,
      theme: "dark",
      affColor: "#112233",
      negColor: null,
      tooltips: false,
    });
  });

  it("drops malformed values and yields no record when nothing is valid", () => {
    expect(
      decodeFlowDisplaySettings({ defaultGridZoom: 9, affColor: "red", tooltips: "yes", theme: "" }),
    ).toEqual([]);
    expect(decodeFlowDisplaySettings(null)).toEqual([]);
    expect(decodeFlowDisplaySettings([1])).toEqual([]);
  });
});

describe("encodeFlowDisplaySettings", () => {
  it("overlays the synced record on the local store without erasing local-only fields", () => {
    const out = encodeFlowDisplaySettings(
      [{ id: "settings", theme: "light", flowsDir: "/evil", defaultGridZoom: 99 }],
      { theme: "dark", flowsDir: "/home/me/flows", collabName: "Me" },
    );
    expect(out).toEqual({ theme: "light", flowsDir: "/home/me/flows", collabName: "Me" });
  });

  it("returns the current store when there is no settings record", () => {
    expect(encodeFlowDisplaySettings([], { theme: "dark" })).toEqual({ theme: "dark" });
    expect(encodeFlowDisplaySettings([{ id: "other", theme: "x" }])).toEqual({});
  });
});

describe("flow keymap codec", () => {
  it("round-trips overrides and ignores empty or non-string bindings", () => {
    const records = decodeFlowKeymapSettings({ keymapOverrides: { "sheet.new": "Mod-n", bad: 3, "": "x", blank: "" } });
    expect(records).toEqual([{ id: "settings", keymapOverrides: { "sheet.new": "Mod-n" } }]);
    expect(encodeFlowKeymapSettings(records, { other: 1 })).toEqual({
      other: 1,
      keymapOverrides: { "sheet.new": "Mod-n" },
    });
  });

  it("syncs nothing for the default keymap", () => {
    expect(decodeFlowKeymapSettings({ keymapOverrides: {} })).toEqual([]);
    expect(decodeFlowKeymapSettings("nope")).toEqual([]);
  });
});

describe("collections using the flow-settings codecs", () => {
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

  it("reads each store as one syncable record", () => {
    backing.set("ebb-display-settings", JSON.stringify({ theme: "dark" }));
    backing.set("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { a: "b" } }));
    for (const collection of [display, keymap]) {
      const records = readLocalToolRecords(collection);
      expect(records).toHaveLength(1);
      expect(isSyncableToolRecord(collection, records[0])).toBe(true);
    }
  });

  it("writes an adopted record while keeping the device-local flows folder", () => {
    backing.set("ebb-display-settings", JSON.stringify({ theme: "dark", flowsDir: "/home/me/flows" }));
    writeLocalToolRecords(display, [{ id: "settings", theme: "light" }]);
    expect(JSON.parse(backing.get("ebb-display-settings") ?? "null")).toEqual({
      theme: "light",
      flowsDir: "/home/me/flows",
    });
  });

  it("writes onto an empty or corrupt store", () => {
    backing.set("ebb-keymap-settings", "{broken");
    writeLocalToolRecords(keymap, [{ id: "settings", keymapOverrides: { a: "b" } }]);
    expect(JSON.parse(backing.get("ebb-keymap-settings") ?? "null")).toEqual({ keymapOverrides: { a: "b" } });
  });
});
