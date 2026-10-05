/**
 * @fileoverview Pins the single-record adapters that let the flow editor's
 * display and keymap settings join the account sync, including that
 * per-device fields never leave the browser or get reset by a merge.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EBB_SETTINGS_RECORD_ID,
  ebbDisplaySettingsCodec,
  ebbKeymapSettingsCodec,
} from "../src/state/ebb-settings-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  mergeToolRecords,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const display = findToolRecordCollection("ebbDisplaySettings") as ToolRecordCollection;
const keymap = findToolRecordCollection("ebbKeymapSettings") as ToolRecordCollection;

const storedDisplay = {
  flowFont: "mono",
  defaultGridZoom: 1.2,
  sidebarCollapsed: true,
  rfdOpen: true,
  rfdVim: true,
  insertPaste: false,
  appendEdit: true,
  scrollZoom: true,
  alignSpeeches: false,
  tooltips: true,
  cardmirrorEnabled: true,
  cardmirrorTextType: "analytic",
  theme: "dark",
  collabName: "Sam",
  contacts: { a: "b" },
  affColor: "#112233",
  negColor: null,
  flowsDir: "/Users/sam/flows",
};

describe("ebb display settings codec", () => {
  it("emits one record holding only the portable fields", () => {
    const [record, ...rest] = ebbDisplaySettingsCodec.decode(storedDisplay) as Record<string, unknown>[];

    expect(rest).toEqual([]);
    expect(record.id).toBe(EBB_SETTINGS_RECORD_ID);
    expect(record).toMatchObject({ flowFont: "mono", theme: "dark", affColor: "#112233", negColor: null });
    for (const deviceOnly of ["flowsDir", "sidebarCollapsed", "rfdOpen", "collabName", "contacts"]) {
      expect(record).not.toHaveProperty(deviceOnly);
    }
    expect(isSyncableToolRecord(display, record)).toBe(true);
  });

  it("emits nothing for a missing, empty or malformed store", () => {
    expect(ebbDisplaySettingsCodec.decode(null)).toEqual([]);
    expect(ebbDisplaySettingsCodec.decode([])).toEqual([]);
    expect(ebbDisplaySettingsCodec.decode({ flowsDir: "/x" })).toEqual([]);
  });

  it("drops fields whose values are malformed", () => {
    const [record] = ebbDisplaySettingsCodec.decode({
      theme: 4,
      rfdVim: "yes",
      affColor: "red",
      defaultGridZoom: Number.NaN,
      tooltips: false,
    }) as Record<string, unknown>[];

    expect(record).toEqual({ id: EBB_SETTINGS_RECORD_ID, tooltips: false });
  });
});

describe("ebb settings codecs against localStorage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps device-only fields when the account's copy is applied", () => {
    localStorage.setItem("ebb-display-settings", JSON.stringify(storedDisplay));
    const remote = [{ id: EBB_SETTINGS_RECORD_ID, theme: "light", flowFont: "serif", flowsDir: "/evil" }];

    writeLocalToolRecords(display, mergeToolRecords(display, readLocalToolRecords(display), remote));

    const after = JSON.parse(localStorage.getItem("ebb-display-settings") as string);
    expect(after).toMatchObject({ theme: "light", flowFont: "serif", sidebarCollapsed: true, flowsDir: "/Users/sam/flows" });
    expect(after.contacts).toEqual({ a: "b" });
  });

  it("adopts the account's settings on a browser with no store yet", () => {
    writeLocalToolRecords(display, [{ id: EBB_SETTINGS_RECORD_ID, theme: "dark", tooltips: false }]);

    expect(JSON.parse(localStorage.getItem("ebb-display-settings") as string)).toEqual({
      theme: "dark",
      tooltips: false,
    });
  });

  it("round-trips keymap overrides and rejects a non-string binding", () => {
    localStorage.setItem("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { "cell.next": "Ctrl+J" } }));
    expect(readLocalToolRecords(keymap)).toEqual([
      { id: EBB_SETTINGS_RECORD_ID, keymapOverrides: { "cell.next": "Ctrl+J" } },
    ]);

    expect(ebbKeymapSettingsCodec.decode({ keymapOverrides: { a: 1 } })).toEqual([]);
    expect(ebbKeymapSettingsCodec.decode({ keymapOverrides: [] })).toEqual([]);
  });

  it("does not clobber a store when the remote has no settings record", () => {
    localStorage.setItem("ebb-keymap-settings", JSON.stringify({ keymapOverrides: { a: "b" } }));

    expect(ebbKeymapSettingsCodec.encode([{ id: "other" }])).toEqual({ keymapOverrides: { a: "b" } });
  });
});
