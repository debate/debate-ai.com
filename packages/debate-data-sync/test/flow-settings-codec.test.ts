/**
 * @fileoverview Pins the adapters that let the Flow editor's display and
 * keymap settings join the account sync without leaking device-local fields.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decodeDisplaySettings,
  encodeDisplaySettings,
  decodeKeymapSettings,
  encodeKeymapSettings,
} from "../src/state/flow-settings-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import { findToolRecordCollection, type ToolRecordCollection } from "../src/state/toolRecordCollections";

const display = findToolRecordCollection("flowDisplaySettings") as ToolRecordCollection;

describe("display settings codec", () => {
  it("carries only the synced preferences", () => {
    const [record] = decodeDisplaySettings({
      theme: "dark",
      flowFont: "mono",
      flowsDir: "/home/me/flows",
      collabName: "Me",
      collabEnabled: true,
      contacts: { a: "b" },
    });
    expect(record).toEqual({ id: "display", theme: "dark", flowFont: "mono" });
  });

  it("yields nothing for an absent or malformed store", () => {
    expect(decodeDisplaySettings(null)).toEqual([]);
    expect(decodeDisplaySettings([1])).toEqual([]);
    expect(decodeDisplaySettings("x")).toEqual([]);
  });

  it("keeps local-only fields when writing an account record back", () => {
    const next = encodeDisplaySettings([{ id: "display", theme: "light" }], {
      theme: "dark",
      flowsDir: "/home/me/flows",
      collabName: "Me",
    });
    expect(next).toEqual({ theme: "light", flowsDir: "/home/me/flows", collabName: "Me" });
  });

  it("never lets an account record set a local-only field", () => {
    const next = encodeDisplaySettings([{ id: "display", flowsDir: "/evil", theme: "dark" }], {});
    expect(next).toEqual({ theme: "dark" });
  });

  it("leaves the store untouched when there is no display record", () => {
    expect(encodeDisplaySettings([], { theme: "dark" })).toEqual({ theme: "dark" });
  });
});

describe("keymap settings codec", () => {
  it("round-trips overrides as one record per action", () => {
    const stored = { keymapOverrides: { "grid.up": "k", "grid.down": "j" } };
    const records = decodeKeymapSettings(stored);
    expect(records).toEqual([
      { id: "grid.up", key: "k" },
      { id: "grid.down", key: "j" },
    ]);
    expect(encodeKeymapSettings(records)).toEqual(stored);
  });

  it("skips malformed entries", () => {
    expect(decodeKeymapSettings({ keymapOverrides: { a: "", b: 3, "": "x", c: "y" } })).toEqual([
      { id: "c", key: "y" },
    ]);
    expect(decodeKeymapSettings({})).toEqual([]);
    expect(encodeKeymapSettings([null, { id: "a" }, { id: "b", key: "z" }])).toEqual({
      keymapOverrides: { b: "z" },
    });
  });
});

describe("store helpers with the display codec", () => {
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

  it("preserves local-only fields through an account merge", () => {
    backing.set("ebb-display-settings", JSON.stringify({ theme: "dark", collabName: "Me", flowsDir: "/x" }));
    expect(readLocalToolRecords(display)).toEqual([{ id: "display", theme: "dark" }]);
    writeLocalToolRecords(display, [{ id: "display", theme: "light" }]);
    expect(JSON.parse(backing.get("ebb-display-settings") as string)).toEqual({
      theme: "light",
      collabName: "Me",
      flowsDir: "/x",
    });
  });
});
