/**
 * @fileoverview The `videoWatchPreferences` collection: the video watch page's
 * remembered choices (copy format, auto-scroll, skip breaks, live caption)
 * synced as one record, with a field-by-field merge.
 */

import { describe, expect, it } from "vitest";
import {
  WATCH_PREFERENCES_RECORD_ID,
  decodeWatchPreferences,
  encodeWatchPreferences,
  mergeWatchPreferences,
} from "../../src/account-sync/watch-preferences-codec";
import { findToolRecordCollection, mergeToolRecords } from "../../src/account-sync/toolRecordCollections";

describe("watch preferences codec", () => {
  it("wraps the stored choices as one record", () => {
    expect(decodeWatchPreferences({ copyFormat: "citation", autoScroll: false })).toEqual([
      { id: WATCH_PREFERENCES_RECORD_ID, copyFormat: "citation", autoScroll: false },
    ]);
  });

  it("is no records for a missing, empty or corrupt store", () => {
    expect(decodeWatchPreferences(null)).toEqual([]);
    expect(decodeWatchPreferences({})).toEqual([]);
    expect(decodeWatchPreferences("citation")).toEqual([]);
    expect(decodeWatchPreferences({ copyFormat: "bogus", skipBreaks: "off" })).toEqual([]);
  });

  it("drops unknown fields and values in both directions", () => {
    expect(decodeWatchPreferences({ liveCaption: true, extra: "x", copyFormat: 1 })).toEqual([
      { id: WATCH_PREFERENCES_RECORD_ID, liveCaption: true },
    ]);
    expect(
      encodeWatchPreferences([{ id: WATCH_PREFERENCES_RECORD_ID, skipBreaks: false, copyFormat: "pdf", extra: 1 }]),
    ).toEqual({ skipBreaks: false });
  });

  it("encodes the record back to the stored object, and nothing valid to null", () => {
    const records = decodeWatchPreferences({ copyFormat: "url-title", skipBreaks: false, liveCaption: true });
    expect(encodeWatchPreferences(records)).toEqual({ copyFormat: "url-title", skipBreaks: false, liveCaption: true });
    expect(encodeWatchPreferences([])).toBeNull();
    expect(encodeWatchPreferences([{ id: "other", autoScroll: true }, null, ["x"]])).toBeNull();
  });

  it("merges field by field, the account winning where both chose", () => {
    expect(
      mergeWatchPreferences(
        { id: WATCH_PREFERENCES_RECORD_ID, copyFormat: "citation", autoScroll: false },
        { id: WATCH_PREFERENCES_RECORD_ID, autoScroll: true, liveCaption: false },
      ),
    ).toEqual({ id: WATCH_PREFERENCES_RECORD_ID, copyFormat: "citation", autoScroll: true, liveCaption: false });
  });
});

describe("the videoWatchPreferences collection", () => {
  const collection = findToolRecordCollection("videoWatchPreferences")!;

  it("syncs the watch page's combined store under Videos", () => {
    expect(collection).toMatchObject({
      storageKey: "debate-videos:watch-preferences",
      idField: "id",
      href: "/videos",
      section: "Videos",
      label: "Video Watch Preferences",
    });
    expect(collection.codec?.decode).toBe(decodeWatchPreferences);
    expect(collection.merge).toBe(mergeWatchPreferences);
  });

  it("keeps a choice made on only one device when the account's copy arrives", () => {
    const local = decodeWatchPreferences({ copyFormat: "citation" });
    const remote = decodeWatchPreferences({ skipBreaks: false });
    const merged = mergeToolRecords(collection, local, remote);
    expect(encodeWatchPreferences(merged)).toEqual({ copyFormat: "citation", skipBreaks: false });
  });
});
