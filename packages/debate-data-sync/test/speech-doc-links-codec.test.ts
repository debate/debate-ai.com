/**
 * @fileoverview Pins the map-to-records adapter that lets the Flow
 * workspace's `speech-doc-links` store join the account sync, and its use by
 * the shared store read/write helpers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { decodeSpeechDocLinks, encodeSpeechDocLinks } from "../src/state/speech-doc-links-codec";
import { readLocalToolRecords, writeLocalToolRecords } from "../src/state/tool-record-mirror";
import {
  findToolRecordCollection,
  isSyncableToolRecord,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

// The live `speechDocLinks` catalog entry stores id-keyed record arrays and needs
// no codec; this fixture keeps the legacy map codec covered for any collection
// that still stores a map.
const speechDocLinks: ToolRecordCollection = {
  ...(findToolRecordCollection("speechDocLinks") as ToolRecordCollection),
  key: "legacySpeechDocLinks",
  storageKey: "speech-doc-links",
  codec: { decode: decodeSpeechDocLinks, encode: encodeSpeechDocLinks },
};

const stored = {
  "round-1:1AC": { docId: 7, title: "Aff case", linkedAt: 100 },
  "flow-9:2NC": { docId: 8, title: "Neg block", linkedAt: 200 },
};

describe("speech doc link codec", () => {
  it("flattens each link into a record keyed by its map key", () => {
    expect(decodeSpeechDocLinks(stored)).toEqual([
      { id: "round-1:1AC", docId: 7, title: "Aff case", linkedAt: 100 },
      { id: "flow-9:2NC", docId: 8, title: "Neg block", linkedAt: 200 },
    ]);
  });

  it("round-trips through encode without changing the stored shape", () => {
    expect(encodeSpeechDocLinks(decodeSpeechDocLinks(stored))).toEqual(stored);
  });

  it.each([null, undefined, [], "x", 3])("treats %j as no links", (raw) => {
    expect(decodeSpeechDocLinks(raw)).toEqual([]);
  });

  it("drops entries that are not well-formed links", () => {
    const decoded = decodeSpeechDocLinks({
      ok: { docId: 1, title: "t", linkedAt: 5 },
      noDoc: { title: "t" },
      nanDoc: { docId: Number.NaN },
      notObject: "nope",
      nullValue: null,
    });

    expect(decoded.map((record) => record.id)).toEqual(["ok"]);
  });

  it("defaults a missing title and timestamp rather than dropping the link", () => {
    expect(decodeSpeechDocLinks({ a: { docId: 3 } })).toEqual([
      { id: "a", docId: 3, title: "", linkedAt: 0 },
    ]);
  });

  it("ignores records without a string id or a numeric docId when encoding", () => {
    expect(
      encodeSpeechDocLinks([
        { id: "ok", docId: 1, title: "t", linkedAt: 1 },
        { docId: 2 },
        { id: 5, docId: 3 },
        { id: "bad" },
        null,
      ]),
    ).toEqual({ ok: { docId: 1, title: "t", linkedAt: 1 } });
  });
});

describe("a collection using the speech-doc-links codec", () => {
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

  it("reads the map store as syncable records", () => {
    backing.set("speech-doc-links", JSON.stringify(stored));

    const records = readLocalToolRecords(speechDocLinks);

    expect(records).toHaveLength(2);
    expect(records.every((record) => isSyncableToolRecord(speechDocLinks, record))).toBe(true);
  });

  it("writes merged records back in the map shape the tool reads", () => {
    writeLocalToolRecords(speechDocLinks, [{ id: "round-1:1AC", docId: 7, title: "Aff case", linkedAt: 100 }]);

    expect(JSON.parse(backing.get("speech-doc-links") ?? "null")).toEqual({
      "round-1:1AC": { docId: 7, title: "Aff case", linkedAt: 100 },
    });
  });

  it("reads an empty or corrupt store as no records", () => {
    expect(readLocalToolRecords(speechDocLinks)).toEqual([]);
    backing.set("speech-doc-links", "{not json");
    expect(readLocalToolRecords(speechDocLinks)).toEqual([]);
  });
});
