import { describe, expect, it } from "vitest";
import {
  appendSpeechSendLogEntry,
  buildSpeechSendLogEntry,
  buildSpeechSendPreview,
  isValidSpeechSendLogEntry,
  MAX_SPEECH_SEND_LOG_ENTRIES,
  removeSpeechSendLogEntry,
  sanitizeSpeechSendLog,
} from "../src/editor/speech-send-log";
import type { SpeechSendLogEntry } from "../src/editor/speech-send-log";

function entry(id: string, sentAt = 0): SpeechSendLogEntry {
  return { id, text: `text ${id}`, preview: `text ${id}`, atEnd: false, sentAt };
}

describe("buildSpeechSendPreview", () => {
  it("collapses internal whitespace/newlines to single spaces and trims", () => {
    expect(buildSpeechSendPreview("  Line one\n\n  Line   two  ")).toBe("Line one Line two");
  });

  it("passes short text through unchanged", () => {
    expect(buildSpeechSendPreview("A short card.")).toBe("A short card.");
  });

  it("clips text past 160 chars with an ellipsis, never exceeding the cap", () => {
    const long = "x".repeat(200);
    const preview = buildSpeechSendPreview(long);
    expect(preview.length).toBe(160);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.startsWith("x".repeat(159))).toBe(true);
  });

  it("does not clip text exactly at the cap", () => {
    const exact = "y".repeat(160);
    expect(buildSpeechSendPreview(exact)).toBe(exact);
  });
});

describe("buildSpeechSendLogEntry", () => {
  it("builds an entry from non-blank text, trimming it and stamping the given id/atEnd/sentAt", () => {
    const result = buildSpeechSendLogEntry("  Some evidence text.  ", true, "id-1", 1000);
    expect(result).toEqual({
      id: "id-1",
      text: "Some evidence text.",
      preview: "Some evidence text.",
      atEnd: true,
      sentAt: 1000,
    });
  });

  it("returns null for blank/whitespace-only text", () => {
    expect(buildSpeechSendLogEntry("   \n  ", false, "id-2", 1000)).toBeNull();
    expect(buildSpeechSendLogEntry("", false, "id-3", 1000)).toBeNull();
  });
});

describe("appendSpeechSendLogEntry", () => {
  it("appends to the end of an empty log", () => {
    expect(appendSpeechSendLogEntry([], entry("a"))).toEqual([entry("a")]);
  });

  it("appends to an existing log, preserving order", () => {
    const log = [entry("a"), entry("b")];
    expect(appendSpeechSendLogEntry(log, entry("c"))).toEqual([entry("a"), entry("b"), entry("c")]);
  });

  it("evicts the oldest entries once past a custom max, keeping the newest", () => {
    const log = [entry("a"), entry("b"), entry("c")];
    expect(appendSpeechSendLogEntry(log, entry("d"), 3)).toEqual([entry("b"), entry("c"), entry("d")]);
  });

  it("defaults to MAX_SPEECH_SEND_LOG_ENTRIES when no max is given", () => {
    const log = Array.from({ length: MAX_SPEECH_SEND_LOG_ENTRIES }, (_, i) => entry(`e${i}`));
    const next = appendSpeechSendLogEntry(log, entry("overflow"));
    expect(next.length).toBe(MAX_SPEECH_SEND_LOG_ENTRIES);
    expect(next[next.length - 1]).toEqual(entry("overflow"));
    expect(next[0]).toEqual(entry("e1")); // e0 evicted
  });

  it("does not mutate the input array", () => {
    const log = [entry("a")];
    appendSpeechSendLogEntry(log, entry("b"));
    expect(log).toEqual([entry("a")]);
  });
});

describe("removeSpeechSendLogEntry", () => {
  it("removes the matching entry", () => {
    const log = [entry("a"), entry("b"), entry("c")];
    expect(removeSpeechSendLogEntry(log, "b")).toEqual([entry("a"), entry("c")]);
  });

  it("is a no-op (same contents) when the id isn't found", () => {
    const log = [entry("a"), entry("b")];
    expect(removeSpeechSendLogEntry(log, "z")).toEqual(log);
  });
});

describe("sanitizeSpeechSendLog", () => {
  it("passes through well-shaped entries", () => {
    const log = [entry("a"), entry("b")];
    expect(sanitizeSpeechSendLog(log)).toEqual(log);
  });

  it("returns [] for non-array input", () => {
    expect(sanitizeSpeechSendLog(null)).toEqual([]);
    expect(sanitizeSpeechSendLog(undefined)).toEqual([]);
    expect(sanitizeSpeechSendLog({ id: "a" })).toEqual([]);
  });

  it("drops malformed entries while keeping well-shaped ones", () => {
    const good = entry("a");
    const raw = [
      good,
      { id: "b" }, // missing fields
      { id: "c", text: "t", preview: "t", atEnd: "yes", sentAt: 1 }, // wrong type
      null,
      "not an object",
      42,
    ];
    expect(sanitizeSpeechSendLog(raw)).toEqual([good]);
  });
});

describe("isValidSpeechSendLogEntry", () => {
  it("accepts a well-shaped entry", () => {
    expect(isValidSpeechSendLogEntry(entry("a"))).toBe(true);
  });

  it("rejects a blank id", () => {
    expect(isValidSpeechSendLogEntry({ ...entry("a"), id: "  " })).toBe(false);
  });

  it("rejects missing/wrong-typed fields", () => {
    expect(isValidSpeechSendLogEntry({ id: "a" })).toBe(false);
    expect(isValidSpeechSendLogEntry({ ...entry("a"), atEnd: "yes" })).toBe(false);
    expect(isValidSpeechSendLogEntry({ ...entry("a"), sentAt: "1" })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isValidSpeechSendLogEntry(null)).toBe(false);
    expect(isValidSpeechSendLogEntry(undefined)).toBe(false);
    expect(isValidSpeechSendLogEntry("entry")).toBe(false);
  });
});
