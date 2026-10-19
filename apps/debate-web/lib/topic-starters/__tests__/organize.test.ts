import { describe, expect, it, vi } from "vitest";
import { ORGANIZE_BATCH_SIZE, classifyTopicStarters, organizeInputLines, parseOrganizeReply } from "../organize";

const key = { provider: "anthropic" as const, key: "test", own: false };

describe("organizeInputLines", () => {
  it("gives each file its folder path, and skips folders", () => {
    const lines = organizeInputLines([
      { id: 1, title: "2026 Topic", parentId: null, isFolder: true },
      { id: 2, title: "Neg", parentId: 1, isFolder: true },
      { id: 3, title: "Elections\tDA", parentId: 2, isFolder: false },
      { id: 4, title: "Orphan", parentId: 404, isFolder: false },
    ]);
    expect(lines).toEqual([
      { id: 3, line: "3\t2026 Topic / Neg / Elections DA" },
      { id: 4, line: "4\tOrphan" },
    ]);
  });
});

describe("parseOrganizeReply", () => {
  it("reads a fenced or chatty reply and keeps only ids it asked about", () => {
    const reply = 'Sure:\n```json\n{"files": [{"id": 3, "side": "neg", "type": "da"}, {"id": 99, "side": "aff", "type": "case"}, {"id": 4, "side": "x", "type": "k"}]}\n```';
    expect(parseOrganizeReply(reply, new Set([3, 4]))).toEqual([{ itemId: 3, side: "neg", type: "da" }]);
    expect(parseOrganizeReply("no json here", new Set([3]))).toEqual([]);
    expect(parseOrganizeReply("{broken", new Set([3]))).toEqual([]);
  });
});

describe("classifyTopicStarters", () => {
  const files = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: index + 1, title: `File ${index + 1}`, parentId: null, isFolder: false }));

  it("asks in batches and merges the answers", async () => {
    const ask = vi.fn(async (_key: unknown, content: string) => {
      const ids = content.split("\n").map((line) => Number(line.split("\t")[0]));
      return JSON.stringify({ files: ids.map((id) => ({ id, side: "neg", type: "cp" })) });
    });
    const assignments = await classifyTopicStarters(key, files(ORGANIZE_BATCH_SIZE + 5), ask);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(assignments).toHaveLength(ORGANIZE_BATCH_SIZE + 5);
    expect(assignments[0]).toEqual({ itemId: 1, side: "neg", type: "cp" });
  });

  it("keeps the batches that worked, and throws when none did", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let call = 0;
    const flaky = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error("Anthropic returned 529");
      return '{"files": [{"id": 151, "side": "aff", "type": "case"}]}';
    });
    expect(await classifyTopicStarters(key, files(ORGANIZE_BATCH_SIZE + 1), flaky)).toEqual([{ itemId: 151, side: "aff", type: "case" }]);

    await expect(
      classifyTopicStarters(key, files(2), async () => {
        throw new Error("Anthropic returned 401");
      }),
    ).rejects.toThrow("The AI could not sort the files (Anthropic returned 401).");
    expect(await classifyTopicStarters(key, [], vi.fn())).toEqual([]);
  });
});
