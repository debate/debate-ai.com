/**
 * @fileoverview Pins the adapter that lets the UI sound-effect level — one
 * JSON string under `sound-effect-level` — join the account sync as a single
 * record, and that it never pushes or writes a value the timer can't read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SOUND_EFFECT_LEVEL_RECORD_ID,
  decodeSoundEffectLevel,
  encodeSoundEffectLevel,
} from "../../src/account-sync/sound-effect-level-codec";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  mergeToolRecords,
  type ToolRecordCollection,
} from "../../src/account-sync/toolRecordCollections";
import { readLocalToolRecords, writeLocalToolRecords } from "../../src/account-sync/tool-record-mirror";

const collection = findToolRecordCollection("soundEffectLevel") as ToolRecordCollection;

describe("sound-effect level codec", () => {
  it("is in the catalog under the timer's storage key", () => {
    expect(collection).toMatchObject({ storageKey: "sound-effect-level", idField: "id", href: "/settings" });
  });

  it.each(["all", "minimal", "off"])("wraps the stored level %j as one id-keyed record", (level) => {
    const records = decodeSoundEffectLevel(level);

    expect(records).toEqual([{ id: SOUND_EFFECT_LEVEL_RECORD_ID, level }]);
    expect(isSyncableToolRecord(collection, records[0])).toBe(true);
  });

  it.each([null, undefined, "loud", "", 3, ["off"], { level: "off" }])(
    "syncs nothing for a missing or malformed store (%j)",
    (raw) => {
      expect(decodeSoundEffectLevel(raw)).toEqual([]);
    },
  );

  it("round-trips through encode", () => {
    expect(encodeSoundEffectLevel(decodeSoundEffectLevel("minimal"))).toBe("minimal");
  });

  it("encodes no valid record to null (the timer's 'never chosen')", () => {
    expect(encodeSoundEffectLevel([])).toBeNull();
    expect(
      encodeSoundEffectLevel([null, "off", { id: "other", level: "off" }, { id: "level", level: "loud" }]),
    ).toBeNull();
  });
});

describe("account merge of the sound-effect level", () => {
  it("adopts the account's level over this browser's", () => {
    const merged = mergeToolRecords(collection, decodeSoundEffectLevel("all"), [
      { id: SOUND_EFFECT_LEVEL_RECORD_ID, level: "off" },
    ]);

    expect(encodeSoundEffectLevel(merged)).toBe("off");
  });

  it("keeps this browser's level when the account has none", () => {
    const merged = mergeToolRecords(collection, decodeSoundEffectLevel("minimal"), []);

    expect(encodeSoundEffectLevel(merged)).toBe("minimal");
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

  it("reads the JSON string the timer wrote", () => {
    backing.set("sound-effect-level", JSON.stringify("off"));

    expect(readLocalToolRecords(collection)).toEqual([{ id: "level", level: "off" }]);
  });

  it("reads nothing from a bare pre-sync value (the timer upgrades it to JSON)", () => {
    backing.set("sound-effect-level", "off");

    expect(readLocalToolRecords(collection)).toEqual([]);
  });

  it("writes a merged record back as the JSON string the timer reads", () => {
    writeLocalToolRecords(collection, [{ id: "level", level: "minimal" }]);

    expect(backing.get("sound-effect-level")).toBe(JSON.stringify("minimal"));
  });

  it("writes an empty merge as null, which the timer reads as the default", () => {
    writeLocalToolRecords(collection, []);

    expect(backing.get("sound-effect-level")).toBe("null");
  });
});
