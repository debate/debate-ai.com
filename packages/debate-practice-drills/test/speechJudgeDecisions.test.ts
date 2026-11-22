/**
 * @fileoverview The saved pasted-speech verdicts store
 * (`state/speechJudgeDecisions.ts`): saving with the judged speeches, the
 * cap, deletes, malformed data, the account mirror, and the preview line.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mirror = vi.hoisted(() => ({ save: vi.fn(), delete: vi.fn() }));
vi.mock("@debate-ai/research-evidence/src/account-sync/tool-record-mirror", () => ({
  mirrorToolRecordSave: mirror.save,
  mirrorToolRecordDelete: mirror.delete,
}));

import { MAX_TOOL_RECORD_BYTES, findToolRecordCollection } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections";
import {
  MAX_SPEECH_JUDGE_DECISIONS,
  SPEECH_JUDGE_DECISIONS_STORAGE_KEY,
  SPEECH_JUDGE_DECISION_PREVIEW_CHARS,
  countJudgedSpeeches,
  deleteSpeechJudgeDecision,
  fitsInAccountRow,
  isSpeechJudgeDecisionRecord,
  isSpeechJudgeDecisionsStorageEvent,
  listSpeechJudgeDecisions,
  previewSpeechJudgeDecision,
  saveSpeechJudgeDecision,
  type SpeechJudgeDecisionRecord,
} from "../src/state/speechJudgeDecisions";
import type { JudgedSpeech } from "../src/round/speech-judge-ai";

/** Minimal in-memory `localStorage`; this package's Vitest environment is `node`. */
class MemoryStorage {
  private store = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

let storage: MemoryStorage;

const speeches = (text = "We affirm."): JudgedSpeech[] => [
  { id: "s1", name: "AC", side: "aff", text },
  { id: "s2", name: "NC", side: "neg", text: "" },
];

const input = (judgedAt: number, decision = `Verdict at ${judgedAt}`) => ({
  speeches: speeches(),
  decision,
  judgeName: "Standard Judge",
  judgedAt,
});

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  mirror.save.mockReset();
  mirror.delete.mockReset();
});

describe("saveSpeechJudgeDecision", () => {
  it("keeps the verdict with a copy of the judged speeches and mirrors it to the account", () => {
    const judged = speeches();
    const { record, trimmedIds } = saveSpeechJudgeDecision({ ...input(100), speeches: judged });
    judged[0].text = "edited after judging";

    expect(record?.id).toMatch(/^speech-judge-/);
    expect(trimmedIds).toEqual([]);
    expect(listSpeechJudgeDecisions()).toEqual([record]);
    expect(listSpeechJudgeDecisions()[0].speeches[0].text).toBe("We affirm.");
    expect(mirror.save).toHaveBeenCalledWith(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, record);
  });

  it("lists newest first", () => {
    saveSpeechJudgeDecision(input(100));
    saveSpeechJudgeDecision(input(300));
    saveSpeechJudgeDecision(input(200));

    expect(listSpeechJudgeDecisions().map((record) => record.judgedAt)).toEqual([300, 200, 100]);
  });

  it(`drops the oldest beyond ${MAX_SPEECH_JUDGE_DECISIONS} here and on the account`, () => {
    const first = saveSpeechJudgeDecision(input(1)).record!;
    for (let i = 2; i <= MAX_SPEECH_JUDGE_DECISIONS; i += 1) saveSpeechJudgeDecision(input(i));

    const { trimmedIds } = saveSpeechJudgeDecision(input(1_000));

    expect(trimmedIds).toEqual([first.id]);
    expect(listSpeechJudgeDecisions()).toHaveLength(MAX_SPEECH_JUDGE_DECISIONS);
    expect(listSpeechJudgeDecisions().some((record) => record.id === first.id)).toBe(false);
    expect(mirror.delete).toHaveBeenCalledWith(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, first.id);
  });

  it("keeps a verdict too large for one account row on this device without mirroring it", () => {
    const huge = "word ".repeat(MAX_TOOL_RECORD_BYTES / 4);
    const { record } = saveSpeechJudgeDecision({ ...input(100), speeches: speeches(huge) });

    expect(record).not.toBeNull();
    expect(fitsInAccountRow(record!)).toBe(false);
    expect(listSpeechJudgeDecisions()).toHaveLength(1);
    expect(mirror.save).not.toHaveBeenCalled();
  });

  it("reports nothing saved when storage refuses the write", () => {
    storage.failWrites = true;

    expect(saveSpeechJudgeDecision(input(100))).toEqual({ record: null, trimmedIds: [] });
    expect(mirror.save).not.toHaveBeenCalled();
  });
});

describe("deleteSpeechJudgeDecision", () => {
  it("removes one verdict here and on the account", () => {
    const keep = saveSpeechJudgeDecision(input(1)).record!;
    const drop = saveSpeechJudgeDecision(input(2)).record!;

    deleteSpeechJudgeDecision(drop.id);

    expect(listSpeechJudgeDecisions()).toEqual([keep]);
    expect(mirror.delete).toHaveBeenCalledWith(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, drop.id);
  });

  it("does nothing for an unknown id", () => {
    saveSpeechJudgeDecision(input(1));

    deleteSpeechJudgeDecision("missing");

    expect(listSpeechJudgeDecisions()).toHaveLength(1);
    expect(mirror.delete).not.toHaveBeenCalled();
  });
});

describe("reading stored data", () => {
  it("returns nothing for missing, unparsable or non-array data", () => {
    expect(listSpeechJudgeDecisions()).toEqual([]);
    storage.setItem(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, "{not json");
    expect(listSpeechJudgeDecisions()).toEqual([]);
    storage.setItem(SPEECH_JUDGE_DECISIONS_STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(listSpeechJudgeDecisions()).toEqual([]);
  });

  it("skips malformed entries and keeps the good ones", () => {
    const good: SpeechJudgeDecisionRecord = { id: "ok", ...input(5) };
    storage.setItem(
      SPEECH_JUDGE_DECISIONS_STORAGE_KEY,
      JSON.stringify([
        good,
        { ...good, id: "" },
        { ...good, id: "blank", decision: "   " },
        { ...good, id: "bad-side", speeches: [{ id: "x", name: "AC", side: "both", text: "" }] },
        { ...good, id: "no-time", judgedAt: "yesterday" },
        null,
      ]),
    );

    expect(listSpeechJudgeDecisions()).toEqual([good]);
    expect(isSpeechJudgeDecisionRecord(good)).toBe(true);
  });
});

describe("helpers", () => {
  it("is a synced collection keyed by id on the AI Judge Decision page", () => {
    expect(findToolRecordCollection(SPEECH_JUDGE_DECISIONS_STORAGE_KEY)).toMatchObject({
      storageKey: SPEECH_JUDGE_DECISIONS_STORAGE_KEY,
      idField: "id",
      href: "/practice/judge-decision",
    });
  });

  it("matches storage events for its key, or a full clear", () => {
    expect(isSpeechJudgeDecisionsStorageEvent({ key: SPEECH_JUDGE_DECISIONS_STORAGE_KEY })).toBe(true);
    expect(isSpeechJudgeDecisionsStorageEvent({ key: null })).toBe(true);
    expect(isSpeechJudgeDecisionsStorageEvent({ key: "judgeDecisions" })).toBe(false);
  });

  it("previews the first non-blank line without Markdown markers", () => {
    expect(previewSpeechJudgeDecision("\n\n## **Decision:** Aff wins\nmore")).toBe("Decision: Aff wins");
    expect(previewSpeechJudgeDecision("- Neg wins on the turn")).toBe("Neg wins on the turn");
    expect(previewSpeechJudgeDecision("   ")).toBe("");
  });

  it("clips a long preview with an ellipsis", () => {
    const preview = previewSpeechJudgeDecision("a".repeat(SPEECH_JUDGE_DECISION_PREVIEW_CHARS + 50));

    expect(preview).toHaveLength(SPEECH_JUDGE_DECISION_PREVIEW_CHARS);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("counts only speeches with text", () => {
    expect(countJudgedSpeeches({ speeches: speeches() })).toBe(1);
  });
});
