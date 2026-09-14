/**
 * @fileoverview Pins the shared tool-record sync's catalog and merge rules —
 * the pure half of the account sync that the sidebar's localStorage-backed
 * tools (Practice Round Simulator, Judge Profiles, Prep Notes, Flow
 * Annotations, …) go through.
 *
 * Two things have to hold for that sync to be safe to switch on for thirteen
 * tools at once: the catalog has to describe each tool's store correctly (a
 * wrong `idField` would sync every record under `undefined`, i.e. one row per
 * collection), and the merge has to be a union — a first sign-in must not let
 * one device's copy of a store delete the other's.
 */

import { describe, it, expect } from "vitest";
import {
  TOOL_RECORD_COLLECTIONS,
  findToolRecordCollection,
  isSyncableToolRecord,
  isSyncedToolCollection,
  mergeToolRecords,
  toolRecordId,
  toolRecordsMissingRemotely,
  type ToolRecordCollection,
} from "../src/state/toolRecordCollections";

const flowAnnotations = findToolRecordCollection("flowAnnotations") as ToolRecordCollection;
const judgeProfiles = findToolRecordCollection("judgeProfiles") as ToolRecordCollection;

describe("TOOL_RECORD_COLLECTIONS", () => {
  it("gives every collection a unique key", () => {
    const keys = TOOL_RECORD_COLLECTIONS.map((collection) => collection.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("fills in every field each side of the sync reads", () => {
    for (const collection of TOOL_RECORD_COLLECTIONS) {
      expect(collection.key, JSON.stringify(collection)).toBeTruthy();
      expect(collection.storageKey, collection.key).toBeTruthy();
      expect(collection.idField, collection.key).toBeTruthy();
      expect(collection.label, collection.key).toBeTruthy();
      expect(collection.href.startsWith("/"), collection.key).toBe(true);
    }
  });

  it("covers each of the tools that had the localStorage-only gap", () => {
    const keys = TOOL_RECORD_COLLECTIONS.map((collection) => collection.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "practiceRounds",
        "preRoundBriefings",
        "opponentTeamProfiles",
        "opponentRoundRecords",
        "judgeProfiles",
        "judgeRoundRecords",
        "judgeParadigmSelections",
        "flowSummaries",
        "argumentTrees",
        "prepNotes",
        "flowAnnotations",
        "coachConversation",
        "coachingPrograms",
      ]),
    );
  });

  it("is an allowlist — an invented collection key syncs nothing", () => {
    expect(isSyncedToolCollection("flowAnnotations")).toBe(true);
    expect(isSyncedToolCollection("../../etc/passwd")).toBe(false);
    expect(isSyncedToolCollection("")).toBe(false);
    expect(findToolRecordCollection("not-a-tool")).toBeUndefined();
  });
});

describe("toolRecordId", () => {
  it("reads the collection's own id field, not a hardcoded one", () => {
    expect(toolRecordId(judgeProfiles, { judgeId: "kim" })).toBe("kim");
    // `id` is what most collections use, which is exactly why a collection
    // keyed by something else must not fall back to it.
    expect(toolRecordId(judgeProfiles, { id: "kim" })).toBeNull();
  });

  it("rejects anything that isn't a plain object with a usable id", () => {
    expect(toolRecordId(flowAnnotations, null)).toBeNull();
    expect(toolRecordId(flowAnnotations, "a-string")).toBeNull();
    expect(toolRecordId(flowAnnotations, [{ id: "a" }])).toBeNull();
    expect(toolRecordId(flowAnnotations, { id: "" })).toBeNull();
    expect(toolRecordId(flowAnnotations, { id: "   " })).toBeNull();
    expect(toolRecordId(flowAnnotations, { id: 7 })).toBeNull();
  });

  it("accepts a record's other fields without inspecting them", () => {
    // The tools own thirteen different record shapes; the sync's business is
    // the id and nothing else.
    expect(isSyncableToolRecord(flowAnnotations, { id: "a", anything: { nested: true } })).toBe(true);
  });
});

describe("mergeToolRecords", () => {
  it("adopts records the account has and this browser doesn't", () => {
    const merged = mergeToolRecords(flowAnnotations, [{ id: "local" }], [{ id: "remote" }]);

    expect(merged).toEqual([{ id: "local" }, { id: "remote" }]);
  });

  it("lets the account's copy win for a record both hold", () => {
    const merged = mergeToolRecords(
      flowAnnotations,
      [{ id: "a", text: "this browser" }],
      [{ id: "a", text: "the account" }],
    );

    expect(merged).toEqual([{ id: "a", text: "the account" }]);
  });

  it("keeps local order for the records that stay", () => {
    const merged = mergeToolRecords(
      flowAnnotations,
      [{ id: "b" }, { id: "a" }],
      [{ id: "a" }, { id: "c" }],
    );

    expect(merged.map((record) => (record as { id: string }).id)).toEqual(["b", "a", "c"]);
  });

  it("never drops a local-only record — a first sign-in is not a reset", () => {
    const merged = mergeToolRecords(flowAnnotations, [{ id: "only-here" }], []);

    expect(merged).toEqual([{ id: "only-here" }]);
  });

  it("keeps a local record with no usable id rather than discarding it", () => {
    const merged = mergeToolRecords(flowAnnotations, [{ note: "no id" }], [{ id: "a" }]);

    expect(merged).toEqual([{ note: "no id" }, { id: "a" }]);
  });

  it("collapses a local store that somehow holds one id twice", () => {
    const merged = mergeToolRecords(
      flowAnnotations,
      [{ id: "a", n: 1 }, { id: "a", n: 2 }],
      [],
    );

    expect(merged).toEqual([{ id: "a", n: 1 }]);
  });

  it("ignores a remote record with no usable id", () => {
    const merged = mergeToolRecords(flowAnnotations, [], [{ id: "" }, { id: "a" }]);

    expect(merged).toEqual([{ id: "a" }]);
  });
});

describe("toolRecordsMissingRemotely", () => {
  it("is the local-only records, which is what a first sign-in pushes up", () => {
    const missing = toolRecordsMissingRemotely(
      flowAnnotations,
      [{ id: "a" }, { id: "b" }],
      [{ id: "a" }],
    );

    expect(missing).toEqual([{ id: "b" }]);
  });

  it("skips records with no id — there is nothing to key them by", () => {
    const missing = toolRecordsMissingRemotely(flowAnnotations, [{ note: "no id" }], []);

    expect(missing).toEqual([]);
  });

  it("pushes one row per id, not one per duplicate", () => {
    const missing = toolRecordsMissingRemotely(flowAnnotations, [{ id: "a" }, { id: "a" }], []);

    expect(missing).toEqual([{ id: "a" }]);
  });

  it("is empty when the account already holds everything", () => {
    expect(toolRecordsMissingRemotely(flowAnnotations, [{ id: "a" }], [{ id: "a" }])).toEqual([]);
  });
});
