import { beforeEach, describe, expect, it } from "vitest";
import {
  createWordCountSpeechMode,
  getSpeechWordCountStatus,
  getWordCountSpeechText,
  loadWordCountSpeechMode,
  persistWordCountSpeechMode,
  resolveSpeechWordLimit,
  setWordCountSpeechText,
} from "../src/round/word-count-speech-mode";
import { listWordCountRounds, saveWordCountRound } from "../src/state/wordCountRounds";

/** Minimal in-memory `localStorage` mock, mirroring `wordCountRounds.test.ts`. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("resolveSpeechWordLimit", () => {
  it("uses the authored word-count style limit when the speech name matches", () => {
    expect(resolveSpeechWordLimit({ speechName: "AC" })).toBe(600);
  });

  it("matches an authored speech name case-insensitively and ignores surrounding space", () => {
    expect(resolveSpeechWordLimit({ speechName: " ac " })).toBe(600);
  });

  it("estimates a limit from the timed speech length when no authored limit matches", () => {
    expect(resolveSpeechWordLimit({ speechName: "1AR", timedSpeechMinutes: 5 })).toBe(750);
  });

  it("honors a custom speaking pace for the estimate", () => {
    expect(
      resolveSpeechWordLimit({ speechName: "1AR", timedSpeechMinutes: 5, wordsPerMinute: 200 }),
    ).toBe(1000);
  });

  it("returns undefined when neither an authored limit nor a timed length is available", () => {
    expect(resolveSpeechWordLimit({ speechName: "1AR" })).toBeUndefined();
    expect(resolveSpeechWordLimit({ speechName: "1AR", timedSpeechMinutes: 0 })).toBeUndefined();
  });

  it("prefers a matching custom preset over the authored registry", () => {
    expect(
      resolveSpeechWordLimit({ speechName: "AC", presets: [{ name: "AC", wordLimit: 900 }] }),
    ).toBe(900);
  });

  it("prefers a matching custom preset over the timed-speech estimate", () => {
    expect(
      resolveSpeechWordLimit({
        speechName: "1AR",
        timedSpeechMinutes: 5,
        presets: [{ name: "1AR", wordLimit: 400 }],
      }),
    ).toBe(400);
  });

  it("matches a custom preset name case-insensitively and ignores surrounding space", () => {
    expect(
      resolveSpeechWordLimit({ speechName: " ac ", presets: [{ name: "AC", wordLimit: 900 }] }),
    ).toBe(900);
  });

  it("falls through to the authored registry when no preset matches the speech", () => {
    expect(
      resolveSpeechWordLimit({ speechName: "AC", presets: [{ name: "NC", wordLimit: 900 }] }),
    ).toBe(600);
  });
});

describe("word-limit mode state", () => {
  it("starts with no text for any speech", () => {
    const state = createWordCountSpeechMode("round-1");
    expect(getWordCountSpeechText(state, "AC")).toBe("");
  });

  it("replaces one speech's text without touching the others", () => {
    const state = setWordCountSpeechText(
      setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "one two"),
      "NC",
      "three",
    );
    expect(getWordCountSpeechText(state, "AC")).toBe("one two");
    expect(getWordCountSpeechText(state, "NC")).toBe("three");
  });

  it("does not mutate the state it was given", () => {
    const original = createWordCountSpeechMode("round-1");
    setWordCountSpeechText(original, "AC", "one two");
    expect(original.drafts).toEqual({});
  });
});

describe("getSpeechWordCountStatus", () => {
  it("reports the live count against an authored limit", () => {
    const state = setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "one two three");
    expect(getSpeechWordCountStatus(state, { speechName: "AC" })).toEqual({
      wordLimit: 600,
      count: 3,
      remaining: 597,
      percentUsed: 3 / 600,
      overLimit: false,
    });
  });

  it("flags an over-limit speech with a negative remaining count", () => {
    const text = Array.from({ length: 12 }, () => "word").join(" ");
    const state = setWordCountSpeechText(createWordCountSpeechMode("round-1"), "1AR", text);
    const status = getSpeechWordCountStatus(state, { speechName: "1AR", timedSpeechMinutes: 0.05 });
    expect(status).toMatchObject({ wordLimit: 8, count: 12, remaining: -4, overLimit: true });
    expect(status?.percentUsed).toBe(1);
  });

  it("returns undefined when the speech has no resolvable limit", () => {
    const state = createWordCountSpeechMode("round-1");
    expect(getSpeechWordCountStatus(state, { speechName: "1AR" })).toBeUndefined();
  });

  it("reports the live count against a custom preset instead of the authored limit", () => {
    const state = setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "one two three");
    const status = getSpeechWordCountStatus(state, {
      speechName: "AC",
      presets: [{ name: "AC", wordLimit: 10 }],
    });
    expect(status).toMatchObject({ wordLimit: 10, count: 3, remaining: 7, overLimit: false });
  });
});

describe("word-limit mode persistence", () => {
  it("round-trips typed speeches through the word-count round store", () => {
    const state = setWordCountSpeechText(
      setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "aff case"),
      "NC",
      "neg case",
    );
    persistWordCountSpeechMode(state, { AC: "A1" });

    const reloaded = loadWordCountSpeechMode("round-1");
    expect(reloaded.roundId).toBe("round-1");
    expect(reloaded.styleKey).toBe("practicePublicForum");
    expect(reloaded.drafts).toEqual({ AC: "aff case", NC: "neg case" });
  });

  it("records the speaker for a speech and leaves unknown speakers blank", () => {
    const state = setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "aff case");
    const record = persistWordCountSpeechMode(state, { NC: "N1" });
    expect(record.submittedSpeeches).toEqual([{ name: "AC", speaker: "", text: "aff case" }]);
  });

  it("drops speeches with only whitespace typed so far", () => {
    const state = setWordCountSpeechText(
      setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "aff case"),
      "NC",
      "   ",
    );
    persistWordCountSpeechMode(state);
    expect(listWordCountRounds()[0].submittedSpeeches.map((s) => s.name)).toEqual(["AC"]);
  });

  it("overwrites the same round rather than appending a duplicate", () => {
    persistWordCountSpeechMode(
      setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "first"),
    );
    persistWordCountSpeechMode(
      setWordCountSpeechText(createWordCountSpeechMode("round-1"), "AC", "second"),
    );
    const rounds = listWordCountRounds();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].submittedSpeeches[0].text).toBe("second");
  });

  it("reads back a round that was saved from the /word-count panel", () => {
    saveWordCountRound({
      roundId: "round-2",
      styleKey: "practicePublicForum",
      submittedSpeeches: [{ name: "NC", speaker: "N1", text: "typed on the panel" }],
    });
    expect(loadWordCountSpeechMode("round-2").drafts).toEqual({ NC: "typed on the panel" });
  });

  it("falls back to empty state for a round that was never saved", () => {
    expect(loadWordCountSpeechMode("missing-round")).toEqual({
      roundId: "missing-round",
      styleKey: "practicePublicForum",
      drafts: {},
    });
  });

  it("degrades to empty state when the stored round is corrupt", () => {
    localStorage.setItem("wordCountRounds", "{ not json");
    expect(loadWordCountSpeechMode("round-1").drafts).toEqual({});
  });
});
