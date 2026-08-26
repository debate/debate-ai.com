import { describe, expect, it } from "vitest";
import {
  appendDictatedSegment,
  describeMicrophoneTranscriptionError,
  getSpeechRecognitionConstructor,
  isMicrophoneTranscriptionSupported,
} from "../src/round/microphone-transcription";

describe("getSpeechRecognitionConstructor", () => {
  it("prefers the unprefixed SpeechRecognition constructor when both exist", () => {
    const unprefixed = function Unprefixed() {};
    const prefixed = function Prefixed() {};
    expect(
      getSpeechRecognitionConstructor({
        SpeechRecognition: unprefixed,
        webkitSpeechRecognition: prefixed,
      }),
    ).toBe(unprefixed);
  });

  it("falls back to the webkit-prefixed constructor", () => {
    const prefixed = function Prefixed() {};
    expect(getSpeechRecognitionConstructor({ webkitSpeechRecognition: prefixed })).toBe(prefixed);
  });

  it("returns undefined when neither constructor exists", () => {
    expect(getSpeechRecognitionConstructor({})).toBeUndefined();
  });

  it("returns undefined for an undefined host (SSR)", () => {
    expect(getSpeechRecognitionConstructor(undefined)).toBeUndefined();
  });
});

describe("isMicrophoneTranscriptionSupported", () => {
  it("is true when a SpeechRecognition constructor function exists", () => {
    expect(isMicrophoneTranscriptionSupported({ SpeechRecognition: function () {} })).toBe(true);
  });

  it("is true when only the webkit-prefixed constructor exists", () => {
    expect(isMicrophoneTranscriptionSupported({ webkitSpeechRecognition: function () {} })).toBe(true);
  });

  it("is false when the host has no speech recognition constructor", () => {
    expect(isMicrophoneTranscriptionSupported({})).toBe(false);
  });

  it("is false when the 'constructor' isn't actually a function", () => {
    expect(isMicrophoneTranscriptionSupported({ SpeechRecognition: "not-a-function" })).toBe(false);
  });

  it("is false for an undefined host (SSR)", () => {
    expect(isMicrophoneTranscriptionSupported(undefined)).toBe(false);
  });
});

describe("appendDictatedSegment", () => {
  it("returns the trimmed segment when the existing text is empty", () => {
    expect(appendDictatedSegment("", "  hello there  ")).toBe("hello there");
  });

  it("joins existing text and a new segment with a single space", () => {
    expect(appendDictatedSegment("The plan solves warming.", "It cuts emissions.")).toBe(
      "The plan solves warming. It cuts emissions.",
    );
  });

  it("never produces doubled whitespace when the existing text already ends with a space", () => {
    expect(appendDictatedSegment("The plan solves warming.   ", "It cuts emissions.")).toBe(
      "The plan solves warming. It cuts emissions.",
    );
  });

  it("is a no-op when the new segment is empty or whitespace-only", () => {
    expect(appendDictatedSegment("The plan solves warming.", "   ")).toBe("The plan solves warming.");
    expect(appendDictatedSegment("The plan solves warming.", "")).toBe("The plan solves warming.");
  });

  it("returns an empty string when both existing text and the segment are empty", () => {
    expect(appendDictatedSegment("", "")).toBe("");
  });
});

describe("describeMicrophoneTranscriptionError", () => {
  it("maps every known error code to a distinct, non-empty message", () => {
    const codes = [
      "not-allowed",
      "no-speech",
      "audio-capture",
      "network",
      "aborted",
      "language-not-supported",
      "service-not-allowed",
    ] as const;
    const messages = codes.map(describeMicrophoneTranscriptionError);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(codes.length);
  });

  it("falls back to a generic message that includes the raw code for an unknown error", () => {
    expect(describeMicrophoneTranscriptionError("some-unknown-code")).toContain("some-unknown-code");
  });
});
