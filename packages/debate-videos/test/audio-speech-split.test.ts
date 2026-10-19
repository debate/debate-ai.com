import { describe, expect, it } from "vitest";
import {
  AUDIO_SPLIT_TEMPLATES,
  LoudnessMeter,
  alignSpeeches,
  audioSplitFormatForStyle,
  audioSplitTranscriptMarkdown,
  findVoicedRegions,
  silenceThreshold,
  splitSpeechesFromLoudness,
  type Loudness,
} from "../src/lib/audio-speech-split";
import { parseDocumentSections } from "../src/lib/video-documents";

const WINDOW = 0.05;

/**
 * A synthetic recording's loudness: `[seconds, level]` stretches in order.
 * Speech gets a breath (a quarter second of quiet) every eight seconds, as
 * real speech does, so the splitter has to join over them.
 */
function loudness(stretches: Array<[number, "speech" | "quiet"]>): Loudness {
  const values: number[] = [];
  for (const [seconds, kind] of stretches) {
    const windows = Math.round(seconds / WINDOW);
    for (let i = 0; i < windows; i++) {
      const breath = kind === "speech" && i % 160 >= 155;
      values.push(kind === "speech" && !breath ? 0.2 + 0.05 * Math.sin(i) : 0.002);
    }
  }
  const rms = Float32Array.from(values);
  return { rms, windowSeconds: WINDOW, sampleRate: 16000, durationSeconds: rms.length * WINDOW };
}

const min = (minutes: number) => minutes * 60;

/** A high-school policy round: each speech near its time, prep between some, CX right after its speech. */
function policyRound(): Array<[number, "speech" | "quiet"]> {
  return [
    [40, "speech"], // the judge and debaters chatting before the round
    [90, "quiet"],
    [min(7.9), "speech"], // 1AC
    [8, "quiet"],
    [min(3), "speech"], // 1AX
    [min(2), "quiet"], // neg prep
    [min(8), "speech"], // 1NC
    [10, "quiet"],
    [min(2.8), "speech"], // 1NX
    [min(1.5), "quiet"],
    [min(7.5), "speech"], // 2AC
    [7, "quiet"],
    [min(3), "speech"], // 2AX
    [min(2.5), "quiet"],
    [min(8), "speech"], // 2NC
    [9, "quiet"],
    [min(3), "speech"], // 2NX
    [20, "quiet"],
    [min(4.9), "speech"], // 1NR
    [min(1), "quiet"],
    [min(5), "speech"], // 1AR
    [min(2), "quiet"],
    [min(5), "speech"], // 2NR
    [min(2), "quiet"],
    [min(4.6), "speech"], // 2AR
    [min(4), "quiet"], // the judge decides
    [min(9), "speech"], // RFD
  ];
}

/** Where each stretch of a script starts. */
function starts(script: Array<[number, "speech" | "quiet"]>): number[] {
  const at: number[] = [];
  let t = 0;
  for (const [seconds, kind] of script) {
    if (kind === "speech") at.push(t);
    t += seconds;
  }
  return at;
}

describe("LoudnessMeter", () => {
  it("measures RMS per window across chunk boundaries, averaging channels", () => {
    const meter = new LoudnessMeter(0.01); // 10 samples at 1 kHz
    const left = new Float32Array(25).fill(0.5);
    const right = new Float32Array(25).fill(0.5);
    meter.push([left.subarray(0, 7), right.subarray(0, 7)], 1000);
    meter.push([left.subarray(7), right.subarray(7)], 1000);
    const result = meter.finish();
    expect(result.rms.length).toBe(3); // 10 + 10 + a partial 5
    expect(result.rms[0]).toBeCloseTo(0.5);
    expect(result.rms[2]).toBeCloseTo(0.5);
    expect(result.durationSeconds).toBeCloseTo(0.025);
  });
});

describe("silenceThreshold", () => {
  it("sits between the recording's own floor and its speech", () => {
    const threshold = silenceThreshold(loudness([[30, "speech"], [10, "quiet"], [30, "speech"]]).rms);
    expect(threshold).toBeGreaterThan(0.002);
    expect(threshold).toBeLessThan(0.15);
  });
});

describe("findVoicedRegions", () => {
  it("joins over breaths and splits on real pauses", () => {
    const regions = findVoicedRegions(loudness([[60, "speech"], [5, "quiet"], [60, "speech"]]));
    expect(regions).toHaveLength(2);
    expect(regions[0].start).toBeCloseTo(0, 1);
    expect(regions[1].start).toBeCloseTo(65, 0);
  });
});

describe("alignSpeeches", () => {
  it("names all twelve policy speeches, keeping a CX apart from its speech and leaving out the RFD", () => {
    const script = policyRound();
    const regions = findVoicedRegions(loudness(script));
    const placed = alignSpeeches(regions, AUDIO_SPLIT_TEMPLATES.policy.speeches);
    expect(placed.map((speech) => speech.name)).toEqual([
      "1AC", "1AX", "1NC", "1NX", "2AC", "2AX", "2NC", "2NX", "1NR", "1AR", "2NR", "2AR",
    ]);
    const expected = starts(script).slice(1, 13); // not the chatter, not the RFD
    placed.forEach((speech, i) => expect(speech.start).toBeCloseTo(expected[i], 0));
  });

  it("leaves out a speech the recording doesn't have", () => {
    // Starts at the 1NC: the 1AC and its CX were never recorded.
    const script = policyRound().slice(6);
    const placed = alignSpeeches(findVoicedRegions(loudness(script)), AUDIO_SPLIT_TEMPLATES.policy.speeches);
    expect(placed.map((speech) => speech.name)).toEqual([
      "1NC", "1NX", "2AC", "2AX", "2NC", "2NX", "1NR", "1AR", "2NR", "2AR",
    ]);
  });

  it("places every speech in nearly every randomised round of each format", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const between = (low: number, high: number) => low + (high - low) * random();
    const ROUNDS = 50;
    for (const format of ["policy", "college-policy", "ld", "pf"] as const) {
      const speeches = AUDIO_SPLIT_TEMPLATES[format].speeches;
      let correct = 0;
      for (let round = 0; round < ROUNDS; round++) {
        const script: Array<[number, "speech" | "quiet"]> = [[between(10, 60), "speech"], [between(20, 120), "quiet"]];
        speeches.forEach((speech, i) => {
          const questioning = /X$|crossfire/i.test(speech.name);
          // A CX starts right after the speech it questions; anything else may follow prep.
          if (i > 0) script.push([questioning ? between(4, 15) : between(20, 180), "quiet"]);
          // Speeches often end early (down to 60% of their time); a CX runs its full three minutes.
          script.push([speech.minutes * 60 * between(questioning ? 0.9 : 0.6, 1.02), "speech"]);
        });
        script.push([between(60, 300), "quiet"], [between(120, 900), "speech"]); // decision, then the RFD
        const placed = alignSpeeches(findVoicedRegions(loudness(script)), speeches);
        const expected = starts(script).slice(1, speeches.length + 1);
        const right =
          placed.length === speeches.length &&
          placed.every((speech, i) => speech.name === speeches[i].name && Math.abs(speech.start - expected[i]) < 1);
        if (right) correct++;
      }
      // Two equally plausible readings exist in a few of these (a short 2NC
      // with its CX six seconds later reads as one full 2NC); that is what
      // the editor's review is for.
      expect(correct / ROUNDS, format).toBeGreaterThanOrEqual(0.95);
    }
    // 200 simulated rounds take ~3.5s under coverage alone, so the default
    // 5s timeout fails when CI runs it alongside every other package.
  }, 30_000);

  it("returns nothing for a silent recording", () => {
    expect(alignSpeeches([], AUDIO_SPLIT_TEMPLATES.ld.speeches)).toEqual([]);
  });
});

describe("splitSpeechesFromLoudness", () => {
  it("produces a segmentation the transcript document parses back", () => {
    const split = splitSpeechesFromLoudness(loudness(policyRound()), AUDIO_SPLIT_TEMPLATES.policy);
    expect(split.segmentation.format).toBe("policy");
    expect(split.segmentation.speeches).toHaveLength(12);
    const first = split.segmentation.speeches[0];
    expect(first.endSeconds! - first.startSeconds).toBeGreaterThan(min(7.5));

    const markdown = audioSplitTranscriptMarkdown(split.segmentation, [
      { text: "Thank you judge, the plan is…", start: first.startSeconds + 5 },
    ]);
    const sections = parseDocumentSections(markdown);
    expect(sections).toHaveLength(12);
    expect(sections[0].heading).toBe("1AC");
    expect(sections[0].startSeconds).toBe(first.startSeconds);
    expect(sections[0].endSeconds).toBe(first.endSeconds);
    expect(sections[0].body).toContain("the plan is");
    expect(sections[1].heading).toBe("CX of the 1AC");
    expect(sections[1].body).toContain("No transcript");
  });
});

describe("audioSplitFormatForStyle", () => {
  it("maps the library's numeric styles", () => {
    expect(audioSplitFormatForStyle(1)).toBe("policy");
    expect(audioSplitFormatForStyle(2)).toBe("pf");
    expect(audioSplitFormatForStyle(3)).toBe("ld");
    expect(audioSplitFormatForStyle(4)).toBe("college-policy");
    expect(audioSplitFormatForStyle(null)).toBe("policy");
  });
});
