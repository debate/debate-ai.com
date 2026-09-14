/**
 * @fileoverview End-to-end tests for reading a real Parquet shard and driving
 * it into the card library.
 *
 * These read actual Parquet bytes (see `parquet-card-fixture.ts`) rather than
 * a stubbed decoder, so they cover what a stub would hide: int64 columns
 * arriving as `BigInt`, Snappy-compressed pages, multi-row-group reads, and a
 * projection built from the shard's own schema.
 */

import { describe, expect, it, vi } from "vitest";
import {
  inspectDebateCardShard,
  planReadWindows,
  readDebateCardChunks,
  type DebateCardRowGroup,
} from "../src/lib/parquet-card-reader";
import { uploadDebateCardShard } from "../src/lib/parquet-card-upload";
import {
  CARD_READ_MAX_WINDOW_ROWS,
  CARD_READ_WINDOW_BYTES,
  type DebateCardRecord,
} from "../src/lib/parquet-card-import";
import { buildCardShard, shardSource } from "./parquet-card-fixture";

/** Wraps a shard's bytes and records what the decoder actually fetched. */
function countingSource(buffer: ArrayBuffer) {
  const reads = { calls: 0, bytes: 0 };
  return {
    reads,
    source: {
      byteLength: buffer.byteLength,
      slice: (start: number, end?: number) => {
        const stop = end ?? buffer.byteLength;
        reads.calls++;
        reads.bytes += stop - start;
        return buffer.slice(start, stop);
      },
    },
  };
}

/** A row group of `rowCount` rows weighing `bytes`, laid out end to end. */
function groups(...sizes: Array<[rows: number, bytes: number]>): DebateCardRowGroup[] {
  let startRow = 0;
  return sizes.map(([rowCount, bytes]) => {
    const group = { startRow, rowCount, bytes };
    startRow += rowCount;
    return group;
  });
}

/** Collects every card a run posts, and reports counts back like the server. */
function recordingSender() {
  const batches: DebateCardRecord[][] = [];
  return {
    batches,
    get cards() {
      return batches.flat();
    },
    send: vi.fn(async (cards: DebateCardRecord[]) => {
      batches.push(cards);
      return { imported: cards.length, skipped: 0, failures: [] };
    }),
  };
}

describe("inspectDebateCardShard", () => {
  it("reads the row count and the card columns from the footer", async () => {
    const info = await inspectDebateCardShard(shardSource(buildCardShard({ rowCount: 12 })));
    expect(info.rowCount).toBe(12);
    expect(info.columns).toContain("id");
    expect(info.columns).toContain("fulltext");
    expect(info.extraColumns).toEqual([]);
  });

  it("names the columns a shard carries that the card table does not store", async () => {
    const info = await inspectDebateCardShard(
      shardSource(buildCardShard({ rowCount: 4, extraColumns: ["embedding", "provenance"] })),
    );
    expect(info.extraColumns).toEqual(["embedding", "provenance"]);
    expect(info.columns).not.toContain("embedding");
  });

  it("projects only the columns a shard actually has", async () => {
    const info = await inspectDebateCardShard(
      shardSource(buildCardShard({ rowCount: 4, omitColumns: ["spoken", "markup"] })),
    );
    expect(info.columns).not.toContain("spoken");
    expect(info.columns).not.toContain("markup");
    expect(info.columns).toContain("fulltext");
  });

  it("recognizes snake_case column spellings", async () => {
    const info = await inspectDebateCardShard(
      shardSource(buildCardShard({ rowCount: 4, snakeCase: true })),
    );
    expect(info.columns).toContain("text_length");
    expect(info.columns).toContain("caselist_display_name");
    expect(info.extraColumns).toEqual([]);
  });

  it("refuses a Parquet file that holds no card columns", async () => {
    const notCards = buildCardShard({
      rowCount: 2,
      omitColumns: [
        "id",
        "tag",
        "cite",
        "fullcite",
        "summary",
        "spoken",
        "fulltext",
        "textLength",
        "markup",
        "pocket",
        "hat",
        "block",
        "bucketId",
        "duplicateCount",
        "side",
        "caselistDisplayName",
        "year",
        "event",
        "level",
      ],
      extraColumns: ["embedding"],
    });
    await expect(inspectDebateCardShard(shardSource(notCards))).rejects.toThrow(
      /No debate-card columns found/,
    );
  });
});

describe("planReadWindows", () => {
  it("reads a row group that fits the budget in a single window", () => {
    // One window per group is what keeps a shard to one decoding pass: a
    // decoder reads whole column chunks, so two windows over one group decode
    // that group twice.
    expect(planReadWindows(groups([50_000, 1_000_000], [50_000, 1_000_000]), 0, 100_000)).toEqual([
      { rowStart: 0, rowEnd: 50_000 },
      { rowStart: 50_000, rowEnd: 100_000 },
    ]);
  });

  it("never lets a window span two row groups", () => {
    const windows = planReadWindows(groups([3, 30], [3, 30], [3, 30]), 0, 9);
    expect(windows).toEqual([
      { rowStart: 0, rowEnd: 3 },
      { rowStart: 3, rowEnd: 6 },
      { rowStart: 6, rowEnd: 9 },
    ]);
  });

  it("splits a row group heavier than one window's byte budget", () => {
    // Ten windows' worth of text in one group: the reader has no way to hold
    // it at once, so it is the byte budget — not a fixed row count — that says
    // how far into the group one read may go.
    const windows = planReadWindows(groups([40_000, CARD_READ_WINDOW_BYTES * 10]), 0, 40_000);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0].rowEnd - windows[0].rowStart).toBe(4_000);
    expect(windows.at(-1)?.rowEnd).toBe(40_000);
  });

  it("caps a window at the row ceiling however light the rows are", () => {
    const windows = planReadWindows(groups([CARD_READ_MAX_WINDOW_ROWS * 2, 1_000]), 0, CARD_READ_MAX_WINDOW_ROWS * 2);
    expect(windows).toHaveLength(2);
    expect(windows[0].rowEnd).toBe(CARD_READ_MAX_WINDOW_ROWS);
  });

  it("honours a caller's explicit window ceiling", () => {
    expect(planReadWindows(groups([10, 100]), 0, 10, 4)).toEqual([
      { rowStart: 0, rowEnd: 4 },
      { rowStart: 4, rowEnd: 8 },
      { rowStart: 8, rowEnd: 10 },
    ]);
  });

  it("clips to the requested row range and skips groups outside it", () => {
    expect(planReadWindows(groups([10, 100], [10, 100], [10, 100]), 12, 18)).toEqual([
      { rowStart: 12, rowEnd: 18 },
    ]);
  });
});

describe("readDebateCardChunks", () => {
  it("cuts its windows on the shard's row groups", async () => {
    const source = shardSource(buildCardShard({ rowCount: 12, rowGroupSize: 5 }));
    const chunks = [];
    for await (const chunk of readDebateCardChunks(source)) chunks.push(chunk);

    expect(chunks.map((chunk) => chunk.startIndex)).toEqual([0, 5, 10]);
    expect(chunks.map((chunk) => chunk.rows.length)).toEqual([5, 5, 2]);
  });

  it("reads the shard about once, rather than once per window", async () => {
    // The regression this guards: windows cut on a flat row count re-decoded
    // whichever row group they landed in, so a shard read in ten windows was
    // fetched and decompressed the better part of ten times over.
    const buffer = buildCardShard({ rowCount: 20_000, rowGroupSize: 20_000 });
    const { reads, source } = countingSource(buffer);

    let rows = 0;
    for await (const chunk of readDebateCardChunks(source)) rows += chunk.rows.length;

    expect(rows).toBe(20_000);
    expect(reads.bytes).toBeLessThan(buffer.byteLength * 3);
  });


  it("walks the shard in windows rather than decoding it whole", async () => {
    const source = shardSource(buildCardShard({ rowCount: 10 }));
    const chunks = [];
    for await (const chunk of readDebateCardChunks(source, { chunkRows: 4 })) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.startIndex)).toEqual([0, 4, 8]);
    expect(chunks.map((chunk) => chunk.rows.length)).toEqual([4, 4, 2]);
  });

  it("reads only the requested row range, so an import can resume", async () => {
    const source = shardSource(buildCardShard({ rowCount: 10 }));
    const rows = [];
    for await (const chunk of readDebateCardChunks(source, {
      startRow: 6,
      endRow: 9,
      chunkRows: 2,
    })) {
      rows.push(...chunk.rows);
    }

    expect(rows).toHaveLength(3);
    expect((rows[0] as { id: bigint }).id).toBe(7n);
  });

  it("stops between windows when aborted", async () => {
    const source = shardSource(buildCardShard({ rowCount: 20 }));
    const signal = { aborted: false };
    const chunks = [];
    for await (const chunk of readDebateCardChunks(source, { chunkRows: 4, signal })) {
      chunks.push(chunk);
      signal.aborted = true;
    }
    expect(chunks).toHaveLength(1);
  });
});

describe("uploadDebateCardShard", () => {
  it("imports a whole shard and reports what landed", async () => {
    const sender = recordingSender();
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 10, extraColumns: ["embedding"] })),
      fileName: "cards-0000.parquet",
      send: sender.send,
      batchRows: 4,
      chunkRows: 8,
    });

    expect(outcome.progress).toMatchObject({
      read: 10,
      imported: 10,
      skipped: 0,
      duplicates: 0,
      total: 10,
    });
    expect(outcome.extraColumns).toEqual(["embedding"]);
    expect(sender.cards).toHaveLength(10);
    // Batches never exceed the requested size.
    expect(Math.max(...sender.batches.map((batch) => batch.length))).toBeLessThanOrEqual(4);
  });

  it("converts int64 columns on the way through", async () => {
    const sender = recordingSender();
    await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 2 })),
      fileName: "cards-0000.parquet",
      send: sender.send,
    });

    const [card] = sender.cards;
    expect(card.id).toBe(1);
    expect(card.year).toBe(2_020);
    expect(card.textLength).toBe(2_957);
    expect(card.side).toBe("A");
    expect(card.event).toBe("ld");
    // The whole batch has to survive JSON, which BigInt would not.
    expect(() => JSON.stringify(sender.cards)).not.toThrow();
  });

  it("reads snake_case shards into the same records", async () => {
    const sender = recordingSender();
    await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 2, snakeCase: true })),
      fileName: "snake.parquet",
      send: sender.send,
    });

    expect(sender.cards[0]).toMatchObject({
      id: 1,
      textLength: 2_957,
      caselistDisplayName: "HS Policy 2020-21",
    });
  });

  it("skips unimportable rows and reports each one with its shard position", async () => {
    const sender = recordingSender();
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 8, rows: { 5: { empty: true } } })),
      fileName: "cards-0000.parquet",
      send: sender.send,
      chunkRows: 4,
    });

    expect(outcome.progress.imported).toBe(7);
    expect(outcome.progress.skipped).toBe(1);
    expect(outcome.failures).toHaveLength(1);
    expect(outcome.failures[0]).toMatchObject({ rowIndex: 5, id: 6, code: "empty-card" });
  });

  it("drops a card id repeated inside the shard", async () => {
    const sender = recordingSender();
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 6, rows: { 4: { id: 1 } } })),
      fileName: "cards-0000.parquet",
      send: sender.send,
      chunkRows: 6,
    });

    expect(outcome.progress.duplicates).toBe(1);
    expect(outcome.progress.imported).toBe(5);
    expect(new Set(sender.cards.map((card) => card.id)).size).toBe(5);
  });

  it("writes a card that appears in two shards only once across a run", async () => {
    const sender = recordingSender();
    const seenIds = new Set<number>();
    const shard = buildCardShard({ rowCount: 5 });

    const first = await uploadDebateCardShard({
      source: shardSource(shard),
      fileName: "a.parquet",
      send: sender.send,
      seenIds,
    });
    const second = await uploadDebateCardShard({
      source: shardSource(shard),
      fileName: "b.parquet",
      send: sender.send,
      seenIds,
    });

    expect(first.progress.imported).toBe(5);
    expect(second.progress.imported).toBe(0);
    expect(second.progress.duplicates).toBe(5);
  });

  it("posts nothing on a dry run but still counts what would land", async () => {
    const sender = recordingSender();
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 6 })),
      fileName: "cards-0000.parquet",
      send: sender.send,
      dryRun: true,
    });

    expect(outcome.progress.imported).toBe(6);
    expect(outcome.batches).toBe(0);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it("measures progress against the range being imported, not the whole shard", async () => {
    const sender = recordingSender();
    const seen: number[] = [];
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 100 })),
      fileName: "cards-0000.parquet",
      send: sender.send,
      startRow: 10,
      endRow: 30,
      onProgress: (progress) => seen.push(progress.total ?? -1),
    });

    expect(outcome.progress.total).toBe(20);
    expect(outcome.progress.read).toBe(20);
    expect(new Set(seen)).toEqual(new Set([20]));
  });

  it("stops mid-shard when aborted", async () => {
    const sender = recordingSender();
    const signal = { aborted: false };
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 40 })),
      fileName: "cards-0000.parquet",
      send: async (cards) => {
        signal.aborted = true;
        return sender.send(cards);
      },
      batchRows: 4,
      chunkRows: 8,
      signal,
    });

    expect(outcome.progress.imported).toBeLessThan(40);
    expect(sender.batches).toHaveLength(1);
  });

  it("caps the rejections it keeps so a bad shard cannot exhaust memory", async () => {
    const rows: Record<number, { empty: boolean }> = {};
    for (let index = 0; index < 12; index++) rows[index] = { empty: true };

    const sender = recordingSender();
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 12, rows })),
      fileName: "junk.parquet",
      send: sender.send,
      maxReportedFailures: 5,
    });

    expect(outcome.progress.skipped).toBe(12);
    expect(outcome.failures).toHaveLength(5);
    expect(outcome.progress.imported).toBe(0);
  });

  it("counts rows the server itself refuses", async () => {
    const outcome = await uploadDebateCardShard({
      source: shardSource(buildCardShard({ rowCount: 4 })),
      fileName: "cards-0000.parquet",
      send: async (cards) => ({
        imported: cards.length - 1,
        skipped: 1,
        failures: [
          { rowIndex: 0, id: 1, code: "empty-card" as const, reason: "server said no" },
        ],
      }),
    });

    expect(outcome.progress.imported).toBe(3);
    expect(outcome.progress.skipped).toBe(1);
    expect(outcome.failures[0].reason).toBe("server said no");
  });

  it("stops the shard when a batch cannot be posted", async () => {
    await expect(
      uploadDebateCardShard({
        source: shardSource(buildCardShard({ rowCount: 4 })),
        fileName: "cards-0000.parquet",
        send: async () => {
          throw new Error("ingest unreachable");
        },
      }),
    ).rejects.toThrow("ingest unreachable");
  });
});
