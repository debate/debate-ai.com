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
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";

const display = findToolRecordCollection("flowEditorDisplaySettings") as ToolRecordCollection;
const keymap = findToolRecordCollection("flowEditorKeymapSettings") as ToolRecordCollection;

describe("flow editor settings codec", () => {
  it("wraps a stored object as one id-keyed record", () => {
    const records = decodeFlowEditorSettings({ keymapOverrides: { undo: "Mod-z" } });

    expect(records).toEqual([{ id: FLOW_EDITOR_SETTINGS_RECORD_ID, keymapOverrides: { undo: "Mod-z" } }]);
    expect(isSyncableToolRecord(keymap, records[0])).toBe(true);
  });

  it.each([null, undefined, "x", 3, []])("syncs nothing for a malformed store (%j)", (raw) => {
    expect(decodeFlowEditorSettings(raw)).toEqual([]);
  });

  it("round-trips through encode, dropping the id", () => {
    const stored = { flowFont: "mono", tooltips: false };

    expect(encodeFlowEditorSettings(decodeFlowEditorSettings(stored))).toEqual(stored);
  });

  it("encodes no settings record to an empty object", () => {
    expect(encodeFlowEditorSettings([])).toEqual({});
    expect(encodeFlowEditorSettings([{ id: "other", a: 1 }, null, "x"])).toEqual({});
  });
});

describe("redactFlowDisplaySettings", () => {
  it("keeps only the allowlisted fields", () => {
    const out = redactFlowDisplaySettings({
      id: "settings",
      flowFont: "mono",
      theme: "dark",
      flowsDir: "/Users/me/flows",
      sidebarCollapsed: true,
      rfdOpen: true,
      collabEnabled: true,
      collabName: "Me",
      contacts: { abc: { name: "Peer" } },
      someFutureField: 1,
    }) as Record<string, unknown>;

    expect(out).toEqual({ id: "settings", flowFont: "mono", theme: "dark" });
  });

  it("leaves a non-object untouched", () => {
    expect(redactFlowDisplaySettings(null)).toBeNull();
    expect(redactFlowDisplaySettings([1])).toEqual([1]);
  });

  it("only allowlists fields that never name a path, peer or network switch", () => {
    for (const field of SYNCED_FLOW_DISPLAY_FIELDS) {
      expect(field).not.toMatch(/dir|collab|contacts|sidebar|rfdOpen/i);
    }
  });
});

describe("account merge of the display settings", () => {
  it("adopts the account's synced fields but keeps this device's own", () => {
    const local = decodeFlowEditorSettings({ flowFont: "serif", flowsDir: "/local", collabEnabled: true });
    const remote = [{ id: "settings", flowFont: "mono", theme: "dark" }];

    const [merged] = mergeToolRecords(display, local, remote) as Record<string, unknown>[];

    expect(merged).toMatchObject({ flowFont: "mono", theme: "dark", flowsDir: "/local", collabEnabled: true });
  });
});

describe("localStorage round trip", () => {
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
});
