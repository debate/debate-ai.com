import { describe, expect, it, vi } from "vitest";
import {
  extractTranscriptsBulk,
  summarizeBulkTranscriptOutcomes,
} from "../src/round/bulk-transcript-extraction";
import type { ExtractedArgument, TranscriptExtractionAiInput } from "../src/round/transcript-extraction-ai";

function argument(claim: string): ExtractedArgument {
  return { claim };
}

describe("extractTranscriptsBulk", () => {
  it("returns empty rows/outcomes for an empty entry list", async () => {
    const extract = vi.fn();
    const result = await extractTranscriptsBulk([], 0, extract);
    expect(result).toEqual({ rows: [], outcomes: {}, errors: {} });
    expect(extract).not.toHaveBeenCalled();
  });

  it("extracts a single entry and builds rows starting at startIndex", async () => {
    const entries: TranscriptExtractionAiInput[] = [{ speech: "1AC", transcriptText: "..." }];
    const extract = vi.fn().mockResolvedValue([argument("Claim A"), argument("Claim B")]);

    const result = await extractTranscriptsBulk(entries, 5, extract);

    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledWith(entries[0]);
    expect(result.outcomes).toEqual({ 0: "extracted" });
    expect(result.errors).toEqual({});
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].rowIndex).toBe(5);
    expect(result.rows[1].rowIndex).toBe(6);
    expect(result.rows[0].originSpeech).toBe("1AC");
  });

  it("continues rowIndex across multiple successful entries in submission order", async () => {
    const entries: TranscriptExtractionAiInput[] = [
      { speech: "1AC", transcriptText: "..." },
      { speech: "1NC", transcriptText: "..." },
    ];
    const extract = vi
      .fn()
      .mockResolvedValueOnce([argument("A1"), argument("A2")])
      .mockResolvedValueOnce([argument("B1")]);

    const result = await extractTranscriptsBulk(entries, 0, extract);

    expect(result.outcomes).toEqual({ 0: "extracted", 1: "extracted" });
    expect(result.rows.map((row) => row.rowIndex)).toEqual([0, 1, 2]);
    expect(result.rows.map((row) => row.originSpeech)).toEqual(["1AC", "1AC", "1NC"]);
  });

  it("records a failed entry's error without stopping the remaining entries", async () => {
    const entries: TranscriptExtractionAiInput[] = [
      { speech: "1AC", transcriptText: "..." },
      { speech: "1NC", transcriptText: "..." },
    ];
    const extract = vi
      .fn()
      .mockRejectedValueOnce(new Error("AI request failed"))
      .mockResolvedValueOnce([argument("B1")]);

    const result = await extractTranscriptsBulk(entries, 10, extract);

    expect(result.outcomes).toEqual({ 0: "error", 1: "extracted" });
    expect(result.errors).toEqual({ 0: "AI request failed" });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].rowIndex).toBe(10);
    expect(result.rows[0].originSpeech).toBe("1NC");
  });

  it("stringifies a non-Error rejection for the error message", async () => {
    const entries: TranscriptExtractionAiInput[] = [{ speech: "1AC", transcriptText: "..." }];
    const extract = vi.fn().mockRejectedValue("boom");

    const result = await extractTranscriptsBulk(entries, 0, extract);

    expect(result.outcomes).toEqual({ 0: "error" });
    expect(result.errors).toEqual({ 0: "boom" });
    expect(result.rows).toEqual([]);
  });

  it("marks every entry as an error when all extractions fail, contributing no rows", async () => {
    const entries: TranscriptExtractionAiInput[] = [
      { speech: "1AC", transcriptText: "..." },
      { speech: "1NC", transcriptText: "..." },
    ];
    const extract = vi.fn().mockRejectedValue(new Error("down"));

    const result = await extractTranscriptsBulk(entries, 0, extract);

    expect(result.outcomes).toEqual({ 0: "error", 1: "error" });
    expect(result.rows).toEqual([]);
  });
});

describe("summarizeBulkTranscriptOutcomes", () => {
  it("returns zero counts for an empty outcomes map", () => {
    expect(summarizeBulkTranscriptOutcomes({})).toEqual({ extractedCount: 0, errorCount: 0 });
  });

  it("counts extracted and error outcomes separately", () => {
    const outcomes = { 0: "extracted", 1: "error", 2: "extracted" } as const;
    expect(summarizeBulkTranscriptOutcomes(outcomes)).toEqual({ extractedCount: 2, errorCount: 1 });
  });

  it("counts an all-error outcomes map correctly", () => {
    const outcomes = { 0: "error", 1: "error" } as const;
    expect(summarizeBulkTranscriptOutcomes(outcomes)).toEqual({ extractedCount: 0, errorCount: 2 });
  });
});
