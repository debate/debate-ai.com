/**
 * @fileoverview `sentSpeechFallacySpeeches` — Speech Documents send-log
 * entries shaped for the fallacy-frequency summary.
 */
import { describe, expect, it } from "vitest";
import {
  SENT_SPEECH_LABEL_SNIPPET_MAX,
  sentSpeechFallacySpeeches,
} from "../../src/lib/speech-send-fallacy-speeches";

const sentAt = new Date(2026, 10, 16, 15, 4).getTime();
const day = new Date(sentAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

describe("sentSpeechFallacySpeeches", () => {
  it("labels each entry with its date and a snippet, keeping the order and full text", () => {
    const speeches = sentSpeechFallacySpeeches([
      { text: "Either we act now or we fail.", preview: "Either we act now or we fail.", sentAt },
      { text: "Second  card\ntext", sentAt },
    ]);
    expect(speeches).toEqual([
      { label: `${day} · Either we act now or we fail.`, text: "Either we act now or we fail." },
      { label: `${day} · Second card text`, text: "Second  card\ntext" },
    ]);
  });

  it("clips long snippets and drops the date when sentAt is unusable", () => {
    const long = "word ".repeat(30).trim();
    const [clipped, noDate, badDate] = sentSpeechFallacySpeeches([
      { text: long, preview: long, sentAt },
      { text: "Undated send", sentAt: undefined },
      { text: "Bad date", sentAt: Number.NaN },
    ]);
    const snippet = clipped.label.slice(`${day} · `.length);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet.length).toBeLessThanOrEqual(SENT_SPEECH_LABEL_SNIPPET_MAX);
    expect(clipped.text).toBe(long);
    expect(noDate.label).toBe("Undated send");
    expect(badDate.label).toBe("Bad date");
  });

  it("skips blank, non-string and missing entries", () => {
    expect(
      sentSpeechFallacySpeeches([
        null,
        undefined,
        { text: "   " },
        { text: 42 },
        { text: "Kept", preview: 7, sentAt: 0 },
      ]),
    ).toEqual([{ label: "Kept", text: "Kept" }]);
  });
});
