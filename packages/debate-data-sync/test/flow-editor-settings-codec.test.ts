/**
 * @fileoverview Pins the single-object-to-record adapters that let the flow
 * editor's display and keymap settings join the account sync.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFlowDisplaySettings,
  decodeFlowKeymapSettings,
  encodeFlowDisplaySettings,
  encodeFlowKeymapSettings,
} from "../src/state/flow-editor-settings-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const display = findToolRecordCollection("flowDisplaySettings") as ToolRecordCollection;
const keymap = findToolRecordCollection("flowKeymapSettings") as ToolRecordCollection;

describe("flow display settings codec", () => {
  it("syncs preference fields and leaves device-local ones out", () => {
    const [record] = decodeFlowDisplaySettings({
      flowFont: "inter",
      rfdVim: true,
      flowsDir: "/Users/me/flows",
      sidebarCollapsed: true,
      collabName: "Me",
      contacts: { a: 1 },
    });
    expect(record).toEqual({ id: "settings", flowFont: "inter", rfdVim: true });
  });

  it("produces nothing for an empty or malformed store", () => {
    expect(decodeFlowDisplaySettings(null)).toEqual([]);
    expect(decodeFlowDisplaySettings([1])).toEqual([]);
    expect(decodeFlowDisplaySettings({ flowsDir: "/x" })).toEqual([]);
  });

  it("keeps local-only fields when merging the account's record back", () => {
    const stored = { flowsDir: "/local", collabName: "Me", theme: "light" };
    expect(
      encodeFlowDisplaySettings([{ id: "settings", theme: "dark", flowsDir: "/evil" }], stored),
    ).toEqual({ flowsDir: "/local", collabName: "Me", theme: "dark" });
  });

  it("ignores records with another id", () => {
    expect(encodeFlowDisplaySettings([{ id: "other", theme: "dark" }], { theme: "light" })).toEqual({
      theme: "light",
    });
  });
});

describe("flow keymap codec", () => {
  it("round-trips overrides and drops malformed pairs", () => {
    const records = decodeFlowKeymapSettings({ keymapOverrides: { a: "Ctrl+A", b: 3, "": "x", c: " " } });
    expect(records).toEqual([{ id: "settings", keymapOverrides: { a: "Ctrl+A" } }]);
    expect(encodeFlowKeymapSettings(records)).toEqual({ keymapOverrides: { a: "Ctrl+A" } });
  });

  it("syncs nothing when no key was rebound", () => {
    expect(decodeFlowKeymapSettings({ keymapOverrides: {} })).toEqual([]);
    expect(decodeFlowKeymapSettings("nope")).toEqual([]);
  });

  it("clears overrides when the merged records carry none", () => {
    expect(encodeFlowKeymapSettings([])).toEqual({ keymapOverrides: {} });
  });
});

describe("the flow settings collections over localStorage", () => {
  const backing = new Map<string, string>();

  beforeEach(() => {
    backing.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("reads the stores as syncable records", () => {
    backing.set("ebb-display-settings", JSON.stringify({ theme: "dark", flowsDir: "/x" }));
    backing.set("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { a: "Ctrl+A" } }));
    for (const collection of [display, keymap]) {
      const records = readLocalToolRecords(collection);
      expect(records).toHaveLength(1);
      expect(isSyncableToolRecord(collection, records[0])).toBe(true);
    }
  });

  it("writes an account merge without losing this browser's flowsDir", () => {
    backing.set("ebb-display-settings", JSON.stringify({ theme: "light", flowsDir: "/local" }));
    writeLocalToolRecords(display, [{ id: "settings", theme: "dark" }]);
    expect(JSON.parse(backing.get("ebb-display-settings") as string)).toEqual({
      theme: "dark",
      flowsDir: "/local",
    });
  });
});
