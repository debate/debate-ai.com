/**
 * @fileoverview "Do the full speech" on the watch page's Alternatives view:
 * which speech counts as the prior one, the prompt it sends, the reply
 * parse, the speech's length and which alternatives get the button.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRoundSpeeches, type RoundSpeech } from "../src/lib/round-speeches";
import type { VideoDocument } from "../src/lib/video-documents";
import {
  REDO_ALTERNATIVE_LIMIT,
  buildSpeechRedoPrompt,
  parseSpeechRedoResponse,
  priorSpeechIndex,
  redoSpeechMinutes,
  speechRedoMaxTokens,
  speechRedoRecordingName,
  speechRedoStorageKey,
  speechRedoToHtml,
  topRedoAlternatives,
} from "../src/lib/speech-redo";
import { requestSpeechRedo } from "../src/lib/speech-redo-client";

const speeches = buildRoundSpeeches([
  {
    videoId: "v",
    kind: "summary",
    author: "ai",
    body: "## 1AC\n\nPublic trust settlements.\n\n## 1NC\n\nSpec and a disease DA.\n\n## 1AR\n\nDrops the DA.\n\n## 2NR\n\nGoes for the DA.",
  },
  {
    videoId: "v",
    kind: "transcript",
    author: "editor",
    body: "## 1AC (0:00)\n\nThe new space race.\n\n## 1NC (6:00)\n\nFive off, the disease DA first.\n\n## 1AR (13:00)\n\nGroup the spec debate.\n\n## 2NR (18:00)\n\nExtend the DA, the 1AR dropped it.",
  },
] satisfies VideoDocument[]);

const at = (label: string) => speeches.findIndex((speech) => speech.label === label);

const alternative = {
  title: "Impact turn the DA",
  approach: "turn",
  outline: ["Disease spread is slowed by off-world research", "Weigh on timeframe"],
  tradeoff: "Less time on spec.",
};

function speech(label: string, side: RoundSpeech["side"]): RoundSpeech {
  return { key: label, label, heading: label, side, isSpeech: true, startSeconds: null, parts: {} };
}

describe("priorSpeechIndex", () => {
  it("is the speech right before for a rebuttal", () => {
    expect(priorSpeechIndex(speeches, at("1AR"))).toBe(at("1NC"));
  });

  it("skips a cross-ex, which a speech after it does not answer", () => {
    const round = [speech("1AC", "aff"), speech("CX", "cx"), speech("1NC", "neg")];
    expect(priorSpeechIndex(round, 2)).toBe(0);
  });

  it("is the constructive before a cross-ex being redone", () => {
    const round = [speech("1AC", "aff"), speech("CX", "cx")];
    expect(priorSpeechIndex(round, 1)).toBe(0);
  });

  it("is -1 for the first speech", () => {
    expect(priorSpeechIndex(speeches, at("1AC"))).toBe(-1);
  });
});

describe("buildSpeechRedoPrompt", () => {
  const prompt = buildSpeechRedoPrompt({
    videoTitle: "NDT Finals",
    round: { format: "Policy", aff: "Michigan", neg: "Kansas" },
    speeches,
    index: at("1AR"),
    alternative,
  });

  it("sends the prior speech and the speech as given", () => {
    expect(prompt).toContain("## The prior speech: 1NC");
    expect(prompt).toContain("Five off, the disease DA first.");
    expect(prompt).toContain("## The speech as given: 1AR");
    expect(prompt).toContain("Group the spec debate.");
  });

  it("leaves out what came after", () => {
    expect(prompt).not.toContain("Extend the DA");
  });

  it("names the direction, its outline and the speech's length", () => {
    expect(prompt).toContain("## The direction to take instead: Impact turn the DA");
    expect(prompt).toContain("1. Disease spread is slowed by off-world research");
    expect(prompt).toContain("What it gives up: Less time on spec.");
    expect(prompt).toContain("Write the full 1AR");
    expect(prompt).toContain("about 5 minutes");
  });

  it("says when there is no prior speech", () => {
    const first = buildSpeechRedoPrompt({ speeches, index: at("1AC"), alternative });
    expect(first).toContain("(This is the first speech of the round.)");
  });

  it("falls back to the round's captions when nothing is written", () => {
    const bare = [speech("1AC", "aff"), speech("1NC", "neg")];
    const withCaptions = buildSpeechRedoPrompt({ speeches: bare, index: 1, alternative, roundTranscript: "so first off" });
    expect(withCaptions).toContain("so first off");
  });

  it("throws for a missing speech", () => {
    expect(() => buildSpeechRedoPrompt({ speeches, index: 99, alternative })).toThrow();
  });
});

describe("parseSpeechRedoResponse", () => {
  it("unwraps a fenced reply and drops a preface", () => {
    expect(parseSpeechRedoResponse("```markdown\n## Case\n\nExtend.\n```")).toBe("## Case\n\nExtend.");
    expect(parseSpeechRedoResponse("Here is the full 1AR:\n\n## Case")).toBe("## Case");
  });

  it("is null for an empty reply", () => {
    expect(parseSpeechRedoResponse("   ")).toBeNull();
  });
});

describe("speech length", () => {
  it("uses the format's timer for a named speech", () => {
    expect(redoSpeechMinutes(speech("1AC", "aff"), "Policy")).toBe(8);
    expect(redoSpeechMinutes(speech("1AC", "aff"), "College")).toBe(9);
    expect(redoSpeechMinutes(speech("NC", "neg"), "LD")).toBe(7);
  });

  it("guesses from the label otherwise", () => {
    expect(redoSpeechMinutes(speech("Pro Summary", "aff"), "PF")).toBe(3);
    expect(redoSpeechMinutes(speech("Con Final Focus", "neg"), "PF")).toBe(2);
    expect(redoSpeechMinutes(speech("Crossfire 1", "cx"), "PF")).toBe(3);
  });

  it("budgets tokens for the length, within bounds", () => {
    expect(speechRedoMaxTokens(1)).toBe(1600);
    expect(speechRedoMaxTokens(8)).toBeGreaterThan(speechRedoMaxTokens(5));
    expect(speechRedoMaxTokens(30)).toBe(6000);
  });
});

describe("topRedoAlternatives", () => {
  it("keeps the three that help the speaker most", () => {
    expect([...topRedoAlternatives([-5, 12, 3, 8])].sort()).toEqual([1, 2, 3]);
    expect(REDO_ALTERNATIVE_LIMIT).toBe(3);
  });

  it("keeps Claude's order on ties and every option when there are three or fewer", () => {
    expect([...topRedoAlternatives([0, 0, 0, 0])].sort()).toEqual([0, 1, 2]);
    expect([...topRedoAlternatives([4, -2])].sort()).toEqual([0, 1]);
  });
});

describe("storage names", () => {
  it("keys a redo by video, speech and alternative", () => {
    expect(speechRedoStorageKey("v", "1AR", " Impact Turn ")).toBe("debate-videos:speech-redo:v::1AR::impact turn");
    expect(speechRedoRecordingName("v", "1AR", 0)).toBe("watch-redo:v:1AR:1");
  });
});

describe("speechRedoToHtml", () => {
  it("renders headings, bold tags and lists", () => {
    const html = speechRedoToHtml("## The DA\n\n1. **Turn** — it's good\n2. No link");
    expect(html).toContain("<h2>The DA</h2>");
    expect(html).toContain("<strong>Turn</strong>");
    expect(html).toContain("<ol>");
  });
});

describe("requestSpeechRedo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the prompt to the AI proxy and returns the speech", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "## Case\n\nExtend." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestSpeechRedo({ speeches, index: at("1AR"), alternative, round: { format: "Policy" } });
    expect(result).toBe("## Case\n\nExtend.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/reason-ai");
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toContain("Write the full 1AR");
    expect(body.maxTokens).toBe(speechRedoMaxTokens(5));
  });

  it("surfaces the proxy's error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to use AI features." }), { status: 401 })));
    await expect(requestSpeechRedo({ speeches, index: at("1AR"), alternative })).rejects.toThrow("Sign in to use AI features.");
  });
});
