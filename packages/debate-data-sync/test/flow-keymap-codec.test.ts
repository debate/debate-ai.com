/**
 * @fileoverview Pins the adapter that lets the flow editor's
 * `ebb-keymap-settings` store join the account sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decodeFlowKeymap, encodeFlowKeymap } from "../src/state/flow-keymap-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const collection = findToolRecordCollection("flowKeymap") as ToolRecordCollection;
const stored = { keymapOverrides: { nextCell: "Ctrl+J", newRow: "Alt+N" } };

describe("flow keymap codec", () => {
  it("flattens each override into a record keyed by action id", () => {
    expect(decodeFlowKeymap(stored)).toEqual([
      { id: "nextCell", key: "Ctrl+J" },
      { id: "newRow", key: "Alt+N" },
    ]);
  });

  it("round-trips without changing the stored shape", () => {
    expect(encodeFlowKeymap(decodeFlowKeymap(stored))).toEqual(stored);
  });

  it.each([null, undefined, [], "x", 3, {}, { keymapOverrides: null }, { keymapOverrides: [] }])(
    "treats %j as no overrides",
    (raw) => {
      expect(decodeFlowKeymap(raw)).toEqual([]);
    },
  );

  it("drops malformed entries on decode and encode", () => {
    expect(decodeFlowKeymap({ keymapOverrides: { ok: "K", empty: "", num: 3, " ": "K" } })).toEqual([
      { id: "ok", key: "K" },
    ]);
    expect(encodeFlowKeymap([{ id: "a", key: "K" }, null, { id: 1, key: "K" }, { id: "b" }])).toEqual({
      keymapOverrides: { a: "K" },
    });
  });
});

describe("flowKeymap catalog entry", () => {
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

  it("produces syncable records", () => {
    for (const record of decodeFlowKeymap(stored)) {
      expect(isSyncableToolRecord(collection, record)).toBe(true);
    }
  });

  it("reads and writes the flow editor's own storage shape", () => {
    backing.set("ebb-keymap-settings", JSON.stringify(stored));
    expect(readLocalToolRecords(collection)).toHaveLength(2);
    writeLocalToolRecords(collection, [{ id: "nextCell", key: "Tab" }]);
    expect(JSON.parse(backing.get("ebb-keymap-settings") as string)).toEqual({
      keymapOverrides: { nextCell: "Tab" },
    });
  });
});
