/**
 * @fileoverview Pins the adapter that lets the speech recorder's playback
 * speed — one number under `debate-playback-speed` — join the account sync as
 * a single record, and that it never pushes or writes a speed the player can't
 * use.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PLAYBACK_SPEED,
  MIN_PLAYBACK_SPEED,
  PLAYBACK_SPEED_RECORD_ID,
  decodePlaybackSpeed,
  encodePlaybackSpeed,
  isPlaybackSpeedChosenAt,
  isSyncablePlaybackSpeed,
  preferPlaybackSpeed,
} from "../../src/account-sync/playback-speed-codec";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  mergeToolRecords,
  toolRecordsMissingRemotely,
  type ToolRecordCollection,
} from "../../src/account-sync/toolRecordCollections";
import { readLocalToolRecords, writeLocalToolRecords } from "../../src/account-sync/tool-record-mirror";

const collection = findToolRecordCollection("recorderPlaybackSpeed") as ToolRecordCollection;

describe("recorder playback speed codec", () => {
  it("is in the catalog under the player's storage key", () => {
    expect(collection).toMatchObject({
      storageKey: "debate-playback-speed",
      idField: "id",
      href: "/debate",
      section: "Practice",
    });
  });

  it.each([0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4])("wraps the stored speed %j as one id-keyed record", (speed) => {
    const records = decodePlaybackSpeed(speed);

    expect(records).toEqual([{ id: PLAYBACK_SPEED_RECORD_ID, speed }]);
    expect(isSyncableToolRecord(collection, records[0])).toBe(true);
  });

  it.each([null, undefined, "1.5", 0, -1, 0.1, 5, Number.NaN, Number.POSITIVE_INFINITY, [1], { speed: 9 }, { chosenAt: 5 }])(
    "syncs nothing for a missing, malformed or out-of-range store (%j)",
    (raw) => {
      expect(decodePlaybackSpeed(raw)).toEqual([]);
    },
  );

  it("keeps when the player's stored speed was chosen", () => {
    expect(decodePlaybackSpeed({ speed: 1.5, chosenAt: 1_700_000_000_000 })).toEqual([
      { id: PLAYBACK_SPEED_RECORD_ID, speed: 1.5, chosenAt: 1_700_000_000_000 },
    ]);
  });

  it.each([0, -5, 1.5, "1700000000000", Number.NaN, null])(
    "keeps the speed but drops a malformed chosen-at time (%j)",
    (chosenAt) => {
      expect(decodePlaybackSpeed({ speed: 1.25, chosenAt })).toEqual([{ id: PLAYBACK_SPEED_RECORD_ID, speed: 1.25 }]);
      expect(isPlaybackSpeedChosenAt(chosenAt)).toBe(false);
    },
  );

  it("round-trips a timed speed through encode as the object the player stores", () => {
    const stored = { speed: 0.75, chosenAt: 1_700_000_000_000 };
    expect(encodePlaybackSpeed(decodePlaybackSpeed(stored))).toEqual(stored);
  });

  it("accepts exactly the bounds", () => {
    expect(isSyncablePlaybackSpeed(MIN_PLAYBACK_SPEED)).toBe(true);
    expect(isSyncablePlaybackSpeed(MAX_PLAYBACK_SPEED)).toBe(true);
    expect(isSyncablePlaybackSpeed(MIN_PLAYBACK_SPEED - 0.01)).toBe(false);
    expect(isSyncablePlaybackSpeed(MAX_PLAYBACK_SPEED + 0.01)).toBe(false);
  });

  it("round-trips through encode", () => {
    expect(encodePlaybackSpeed(decodePlaybackSpeed(1.75))).toBe(1.75);
  });

  it("encodes no valid record to null (the player's 'never chosen')", () => {
    expect(encodePlaybackSpeed([])).toBeNull();
    expect(
      encodePlaybackSpeed([null, 1.5, [], { id: "other", speed: 1.5 }, { id: "speed", speed: 9 }, { id: "speed" }]),
    ).toBeNull();
  });

  it("skips a malformed record and uses the next valid one", () => {
    expect(encodePlaybackSpeed([{ id: "speed", speed: "fast" }, { id: "speed", speed: 0.5 }])).toBe(0.5);
  });
});

describe("account merge of the recorder playback speed", () => {
  const timed = (speed: number, chosenAt: number) => ({ id: PLAYBACK_SPEED_RECORD_ID, speed, chosenAt });

  it("uses preferPlaybackSpeed to settle a conflict", () => {
    expect(collection.prefer).toBe(preferPlaybackSpeed);
  });

  it("keeps this browser's speed when it was chosen after the account's", () => {
    const local = [timed(2, 2_000)];
    const remote = [timed(1.5, 1_000)];

    expect(encodePlaybackSpeed(mergeToolRecords(collection, local, remote))).toEqual({ speed: 2, chosenAt: 2_000 });
    // …and pushes it so the account catches up.
    expect(toolRecordsMissingRemotely(collection, local, remote)).toEqual([timed(2, 2_000)]);
  });

  it("adopts the account's speed when it was chosen after this browser's", () => {
    const local = [timed(2, 1_000)];
    const remote = [timed(1.5, 2_000)];

    expect(encodePlaybackSpeed(mergeToolRecords(collection, local, remote))).toEqual({ speed: 1.5, chosenAt: 2_000 });
    expect(toolRecordsMissingRemotely(collection, local, remote)).toEqual([]);
  });

  it("keeps the account's speed on a tie", () => {
    expect(preferPlaybackSpeed(timed(2, 1_000), timed(1.5, 1_000))).toBe("remote");
  });

  it("prefers a timed local pick over an account copy stored before times existed", () => {
    expect(preferPlaybackSpeed(timed(2, 1_000), { id: PLAYBACK_SPEED_RECORD_ID, speed: 1.5 })).toBe("local");
  });

  it("keeps the account's speed when this browser's has no time", () => {
    expect(preferPlaybackSpeed({ id: PLAYBACK_SPEED_RECORD_ID, speed: 2 }, timed(1.5, 1_000))).toBe("remote");
  });

  it("keeps this browser's timed speed over an unusable account copy", () => {
    expect(preferPlaybackSpeed(timed(2, 1_000), { id: PLAYBACK_SPEED_RECORD_ID, speed: 99, chosenAt: 5_000 })).toBe(
      "local",
    );
  });

  it("adopts the account's speed over this browser's when neither has a time", () => {
    const merged = mergeToolRecords(collection, decodePlaybackSpeed(1), [{ id: PLAYBACK_SPEED_RECORD_ID, speed: 1.5 }]);

    expect(encodePlaybackSpeed(merged)).toBe(1.5);
  });

  it("keeps this browser's speed when the account has none", () => {
    const merged = mergeToolRecords(collection, decodePlaybackSpeed(0.75), []);

    expect(encodePlaybackSpeed(merged)).toBe(0.75);
  });

  it("pushes this browser's speed on first sign-in when the account has none", () => {
    expect(toolRecordsMissingRemotely(collection, decodePlaybackSpeed(1.25), [])).toEqual([
      { id: PLAYBACK_SPEED_RECORD_ID, speed: 1.25 },
    ]);
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

  it("reads the bare number string the player writes (String(rate))", () => {
    backing.set("debate-playback-speed", String(1.5));

    expect(readLocalToolRecords(collection)).toEqual([{ id: "speed", speed: 1.5 }]);
  });

  it("reads the timed object the player now writes", () => {
    backing.set("debate-playback-speed", JSON.stringify({ speed: 1.5, chosenAt: 1_700_000_000_000 }));

    expect(readLocalToolRecords(collection)).toEqual([{ id: "speed", speed: 1.5, chosenAt: 1_700_000_000_000 }]);
  });

  it("writes a merged timed record back as the object the player stores", () => {
    writeLocalToolRecords(collection, [{ id: "speed", speed: 2, chosenAt: 1_700_000_000_000 }]);

    expect(JSON.parse(backing.get("debate-playback-speed") as string)).toEqual({
      speed: 2,
      chosenAt: 1_700_000_000_000,
    });
  });

  it("reads nothing from a corrupt value", () => {
    backing.set("debate-playback-speed", "fast");

    expect(readLocalToolRecords(collection)).toEqual([]);
  });

  it("writes a merged record back in a form the player's parseFloat reads", () => {
    writeLocalToolRecords(collection, [{ id: "speed", speed: 0.75 }]);

    const stored = backing.get("debate-playback-speed") as string;
    expect(stored).toBe("0.75");
    expect(parseFloat(stored)).toBe(0.75);
  });

  it("writes an empty merge as null, which the player reads as never chosen", () => {
    writeLocalToolRecords(collection, []);

    const stored = backing.get("debate-playback-speed") as string;
    expect(stored).toBe("null");
    expect(Number.isFinite(parseFloat(stored))).toBe(false);
  });
});
