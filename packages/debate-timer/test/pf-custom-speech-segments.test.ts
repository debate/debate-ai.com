// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { debateStyles } from "../src/formats/debate-format-times";
import { speechSegmentKeys, type SpeechSegment } from "../src/recorder/youtube-speech-segments";
import { customPFSpeechSegments, pfSpeechTimestamps } from "./pf-custom-speech-segments";

describe("custom PF speech segments", () => {
  const pfSpeeches = debateStyles.publicForum.timerSpeeches;
  const keys = speechSegmentKeys(pfSpeeches);

  it("has the correct number of speeches for PF format", () => {
    expect(customPFSpeechSegments).toHaveLength(pfSpeeches.length);
  });

  it("maps each speech to the correct timestamp", () => {
    expect(customPFSpeechSegments[0]).toMatchObject({ key: keys[0], name: "AC", start: 0 });
    expect(customPFSpeechSegments[1]).toMatchObject({ key: keys[1], name: "CX", start: 246 });
    expect(customPFSpeechSegments[2]).toMatchObject({ key: keys[2], name: "NC", start: 494 });
    expect(customPFSpeechSegments[3]).toMatchObject({ key: keys[3], name: "CX", start: 676 });
    expect(customPFSpeechSegments[4]).toMatchObject({ key: keys[4], name: "AR", start: 921 });
    expect(customPFSpeechSegments[5]).toMatchObject({ key: keys[5], name: "NR", start: 1165 });
    expect(customPFSpeechSegments[6]).toMatchObject({ key: keys[6], name: "CX", start: 1359 });
    expect(customPFSpeechSegments[7]).toMatchObject({ key: keys[7], name: "AS", start: 1545 });
    expect(customPFSpeechSegments[8]).toMatchObject({ key: keys[8], name: "NS", start: 1738 });
    expect(customPFSpeechSegments[9]).toMatchObject({ key: keys[9], name: "GCX", start: 1915 });
    expect(customPFSpeechSegments[10]).toMatchObject({ key: keys[10], name: "AFF", start: 2045 });
    expect(customPFSpeechSegments[11]).toMatchObject({ key: keys[11], name: "NFF", start: 2165 });
  });

  it("has expected durations matching PF rule times", () => {
    const expectedSeconds = pfSpeeches.map((s) => s.time * 60);
    customPFSpeechSegments.forEach((segment, i) => {
      expect(segment.expectedSeconds).toBe(expectedSeconds[i]);
    });
  });

  it("timestamps object matches segment starts", () => {
    expect(pfSpeechTimestamps.AC).toBe(customPFSpeechSegments[0].start);
    expect(pfSpeechTimestamps["CX (1st)"]).toBe(customPFSpeechSegments[1].start);
    expect(pfSpeechTimestamps.NC).toBe(customPFSpeechSegments[2].start);
    expect(pfSpeechTimestamps["CX (2nd)"]).toBe(customPFSpeechSegments[3].start);
    expect(pfSpeechTimestamps.AR).toBe(customPFSpeechSegments[4].start);
    expect(pfSpeechTimestamps.NR).toBe(customPFSpeechSegments[5].start);
    expect(pfSpeechTimestamps["CX (3rd)"]).toBe(customPFSpeechSegments[6].start);
    expect(pfSpeechTimestamps.AS).toBe(customPFSpeechSegments[7].start);
    expect(pfSpeechTimestamps.NS).toBe(customPFSpeechSegments[8].start);
    expect(pfSpeechTimestamps.GCX).toBe(customPFSpeechSegments[9].start);
    expect(pfSpeechTimestamps.AFF).toBe(customPFSpeechSegments[10].start);
    expect(pfSpeechTimestamps.NFF).toBe(customPFSpeechSegments[11].start);
  });
});