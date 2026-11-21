/**
 * @fileoverview "Do the full speech" on the watch page's Alternatives view:
 * which speech counts as the prior one, the prompt it sends, the reply
 * parse, the speech's length and which alternatives get the button.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRoundSpeeches, type RoundSpeech } from "../src/lib/round-speeches";
import type { VideoDocument } from "../src/lib/video-documents";
import {
  MAX_STORED_SPEECH_REDOS,
  REDO_ALTERNATIVE_LIMIT,
  SPEECH_REDO_STORAGE_PREFIX,
  buildSpeechRedoPrompt,
  parseSpeechRedoResponse,
  priorSpeechIndex,
  redoSpeechMinutes,
  speechRedoMaxTokens,
  speechRedoAlternativeId,
  speechRedoRecordingName,
  speechRedoStorageKey,
  speechRedoToHtml,
  staleSpeechRedoKeys,
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

  it("lists the other directions so each redo is written apart from theirs", () => {
    const collapse = { title: "Collapse to spec", approach: "collapse", outline: ["Go all in on group spec"], tradeoff: "" };
    const withOthers = buildSpeechRedoPrompt({
      speeches,
      index: at("1AR"),
      alternative,
      otherAlternatives: [alternative, collapse],
    });
    expect(withOthers).toContain("## Other directions");
    expect(withOthers).toContain("- Collapse to spec (collapse): Go all in on group spec");
    // The direction being followed isn't listed as one to avoid.
    expect(withOthers.split("## Other directions")[1]).not.toContain(alternative.title);
    expect(buildSpeechRedoPrompt({ speeches, index: at("1AR"), alternative })).not.toContain("## Other directions");
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
    expect(redoSpeechMinutes(speech("CF7", "aff"), "PF")).toBe(3);
    expect(redoSpeechMinutes(speech("CF11", "neg"), "PF")).toBe(2);
    expect(redoSpeechMinutes(speech("Crossfire 3", "cx"), "PF")).toBe(3);
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
  const turn = { title: " Impact Turn ", approach: "turn", outline: ["Turn the DA"] };

  it("keys a redo by video, speech and alternative", () => {
    expect(speechRedoStorageKey("v", "1AR", turn)).toMatch(/^debate-videos:speech-redo:v::1AR::impact turn~[0-9a-z]+$/);
    expect(speechRedoRecordingName("v", "1AR", turn)).toMatch(/^watch-redo:v:1AR:[0-9a-z]+$/);
    expect(speechRedoStorageKey("v", "1AR", { ...turn, title: "impact turn" })).toBe(speechRedoStorageKey("v", "1AR", turn));
  });

  it("gives alternatives that share a title their own speech and recording", () => {
    const other = { ...turn, outline: ["Turn the CP instead"] };
    expect(speechRedoStorageKey("v", "1AR", other)).not.toBe(speechRedoStorageKey("v", "1AR", turn));
    expect(speechRedoRecordingName("v", "1AR", other)).not.toBe(speechRedoRecordingName("v", "1AR", turn));
    expect(speechRedoAlternativeId(other)).not.toBe(speechRedoAlternativeId(turn));
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

describe("staleSpeechRedoKeys", () => {
  /** A minimal in-memory `Storage` holding the given entries in insertion order. */
  const storageOf = (entries: Record<string, string>) => {
    const keys = Object.keys(entries);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => entries[k] ?? null };
  };
  const redo = (savedAt: number) => JSON.stringify({ html: "<p>x</p>", savedAt });
  const key = (n: number) => speechRedoStorageKey("vid", `1AR#${n}`, { title: "turn", approach: "turn", outline: [] });

  it("keeps everything while there is room", () => {
    const storage = storageOf({ [key(1)]: redo(1), [key(2)]: redo(2) });
    expect(staleSpeechRedoKeys(storage, key(3), 3)).toEqual([]);
    expect(staleSpeechRedoKeys(storage, key(1), 2)).toEqual([]);
  });

  it("drops the least recently saved past the cap, counting the redo being written", () => {
    const storage = storageOf({ [key(1)]: redo(30), [key(2)]: redo(10), [key(3)]: redo(20) });
    // A new redo takes one of the 2 slots, so only the newest other one stays.
    expect(staleSpeechRedoKeys(storage, key(4), 2)).toEqual([key(3), key(2)]);
  });

  it("never drops the redo being written, even when it is the oldest", () => {
    const storage = storageOf({ [key(1)]: redo(1), [key(2)]: redo(50), [key(3)]: redo(40) });
    expect(staleSpeechRedoKeys(storage, key(1), 2)).toEqual([key(3)]);
    expect(staleSpeechRedoKeys(storage, key(1), 1)).toEqual([key(2), key(3)]);
    expect(staleSpeechRedoKeys(storage, key(1), 0)).toEqual([key(2), key(3)]);
  });

  it("ignores other keys and drops unreadable redos first", () => {
    const storage = storageOf({
      "debate-videos:favorites": "[]",
      "debate-recording-1AC": "{}",
      [key(1)]: "not json",
      [key(2)]: redo(5),
      [key(3)]: JSON.stringify({ html: "<p>x</p>" }),
    });
    expect(staleSpeechRedoKeys(storage, key(4), 2)).toEqual([key(1), key(3)]);
  });

  it("uses the shared prefix and a cap above zero", () => {
    expect(key(1).startsWith(SPEECH_REDO_STORAGE_PREFIX)).toBe(true);
    expect(MAX_STORED_SPEECH_REDOS).toBeGreaterThan(1);
  });
});
