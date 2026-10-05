/**
 * @fileoverview Pins the adapter that lets the flow editor's single-object
 * settings stores join the account sync, including the device-only fields
 * that must never be pushed and must survive adopting the account's copy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSingletonSettingsCodec,
  SETTINGS_RECORD_ID,
} from "../src/state/singleton-settings-codec";
import { findToolRecordCollection, isSyncableToolRecord } from "../src/state/toolRecordCollections";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";

const KEY = "test-settings";
const codec = createSingletonSettingsCodec({ storageKey: KEY, localOnlyKeys: ["flowsDir"] });

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("singleton settings codec", () => {
  it("turns the object into one record with the fixed id", () => {
    expect(codec.decode({ theme: "dark", zoom: 1.2 })).toEqual([
      { id: SETTINGS_RECORD_ID, theme: "dark", zoom: 1.2 },
    ]);
  });

  it("drops device-only keys on decode so they are never pushed", () => {
    expect(codec.decode({ theme: "dark", flowsDir: "/home/me/flows" })).toEqual([
      { id: SETTINGS_RECORD_ID, theme: "dark" },
    ]);
  });

  it("yields no record for missing, non-object or empty stores", () => {
    expect(codec.decode(null)).toEqual([]);
    expect(codec.decode([1, 2])).toEqual([]);
    expect(codec.decode("x")).toEqual([]);
    expect(codec.decode({})).toEqual([]);
    expect(codec.decode({ flowsDir: "/only/local" })).toEqual([]);
  });

  it("encodes the record back to the stored object shape", () => {
    expect(codec.encode([{ id: SETTINGS_RECORD_ID, theme: "light" }])).toEqual({ theme: "light" });
  });

  it("keeps this device's local-only keys when adopting the account copy", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "dark", flowsDir: "/home/me/flows" }));
    expect(codec.encode([{ id: SETTINGS_RECORD_ID, theme: "light", flowsDir: "/evil" }])).toEqual({
      theme: "light",
      flowsDir: "/home/me/flows",
    });
  });

  it("leaves the store untouched when there is no settings record", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "dark" }));
    expect(codec.encode([])).toEqual({ theme: "dark" });
    expect(codec.encode([{ id: "other", theme: "light" }])).toEqual({ theme: "dark" });
  });

  it("tolerates a corrupt store", () => {
    localStorage.setItem(KEY, "{not json");
    expect(codec.encode([{ id: SETTINGS_RECORD_ID, a: 1 }])).toEqual({ a: 1 });
  });
});

describe("flow editor catalog entries", () => {
  it("syncs display settings but keeps flowsDir and contacts on the device", () => {
    const collection = findToolRecordCollection("flowEditorDisplaySettings")!;
    localStorage.setItem(
      collection.storageKey,
      JSON.stringify({ theme: "dark", flowsDir: "/x", contacts: { a: 1 }, flowFont: "mono" }),
    );
    const records = readLocalToolRecords(collection);
    expect(records).toEqual([{ id: "settings", theme: "dark", flowFont: "mono" }]);
    expect(records.every((r) => isSyncableToolRecord(collection, r))).toBe(true);

    writeLocalToolRecords(collection, [{ id: "settings", theme: "light", flowFont: "serif" }]);
    expect(JSON.parse(localStorage.getItem(collection.storageKey)!)).toEqual({
      theme: "light",
      flowFont: "serif",
      flowsDir: "/x",
      contacts: { a: 1 },
    });
  });

  it("syncs the keymap overrides", () => {
    const collection = findToolRecordCollection("flowEditorKeymap")!;
    localStorage.setItem(collection.storageKey, JSON.stringify({ keymapOverrides: { save: "Mod-s" } }));
    expect(readLocalToolRecords(collection)).toEqual([
      { id: "settings", keymapOverrides: { save: "Mod-s" } },
    ]);
  });
});
