import { describe, expect, it, vi } from "vitest";
import {
  CARD_UPLOAD_BATCH_ROWS,
  DEBATE_CARD_PARQUET_COLUMN_ALIASES,
  MAX_CARD_CHARS,
  cardImportPercent,
  chunkForUpload,
  dedupeCardsById,
  emptyCardImportProgress,
  formatCardImportSummary,
  normalizeDebateCardRow,
  normalizeDebateCardRows,
  toCardNumber,
  toCardText,
} from "../src/lib/parquet-card-import";
import {
  createCardBatchSender,
  uploadDebateCardShard,
} from "../src/lib/parquet-card-upload";
import {
  DEFAULT_CARD_ENDPOINT,
  parseCardUploadArgs,
} from "../src/lib/parquet-upload-cli-options";

/** A row shaped like the published dump, with int64 columns as BigInt. */
function dumpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 4_379_114n,
    tag: "Pleasure and pain are intrinsic value and disvalue.",
    cite: "Blum et al. 18",
    fullcite: "Kenneth Blum, Department of Psychiatry…",
    summary: "Pleasure defines reward.",
    spoken: "Pleasure is not only one of the three primary reward functions…",
    fulltext: "Pleasure is not only one of the three primary reward functions…",
    textLength: 18_378n,
    markup: "<h4>Pleasure and pain are intrinsic value</h4>",
    pocket: "CPS R1 v Harker MK",
    hat: "1AC—Schengenlargement",
    block: "1AC—Framing—Util",
    bucketId: 41_540n,
    duplicateCount: 3_168n,
    side: "a",
    caselistDisplayName: "HS LD 2022-23",
    year: 2_022n,
    event: "LD",
    level: "HS",
    ...overrides,
  };
}

describe("toCardText", () => {
  it("decodes byte-array columns that carry no UTF8 annotation", () => {
    expect(toCardText(new TextEncoder().encode("  Blum 18  "))).toBe("Blum 18");
  });

  it("returns an empty string for null, undefined and nested values", () => {
    expect(toCardText(null)).toBe("");
    expect(toCardText(undefined)).toBe("");
    expect(toCardText({ nested: true })).toBe("");
  });

  it("renders bigints as digits rather than [object BigInt]", () => {
    expect(toCardText(4_379_114n)).toBe("4379114");
  });
});

describe("toCardNumber", () => {
  it("converts int64 columns to numbers so JSON can carry them", () => {
    expect(toCardNumber(18_378n)).toBe(18378);
    expect(() => JSON.stringify({ n: toCardNumber(18_378n) })).not.toThrow();
  });

  it("falls back when a bigint exceeds what a JS number holds exactly", () => {
    expect(toCardNumber(2n ** 60n, -1)).toBe(-1);
  });

  it("falls back for missing and non-numeric values", () => {
    expect(toCardNumber(null, 7)).toBe(7);
    expect(toCardNumber("not a number", 7)).toBe(7);
    expect(toCardNumber("2022")).toBe(2022);
  });
});

describe("normalizeDebateCardRow", () => {
  it("normalizes a dump row into a card record", () => {
    const outcome = normalizeDebateCardRow(dumpRow(), 0);
    expect("card" in outcome).toBe(true);
    if (!("card" in outcome)) return;

    expect(outcome.card.id).toBe(4_379_114);
    expect(outcome.card.textLength).toBe(18_378);
    expect(outcome.card.bucketId).toBe(41_540);
    // Side/event/level are case-normalized so filters need not guess.
    expect(outcome.card.side).toBe("A");
    expect(outcome.card.event).toBe("ld");
    expect(outcome.card.level).toBe("hs");
    expect(outcome.card.year).toBe(2_022);
  });

  it("accepts snake_case column spellings", () => {
    const outcome = normalizeDebateCardRow(
      {
        id: 5,
        tag: "tag",
        text_length: 99,
        bucket_id: 12,
        duplicate_count: 4,
        caselist_display_name: "NDT/CEDA 2021-22",
        full_text: "body",
      },
      0,
    );
    expect("card" in outcome).toBe(true);
    if (!("card" in outcome)) return;
    expect(outcome.card.textLength).toBe(99);
    expect(outcome.card.bucketId).toBe(12);
    expect(outcome.card.duplicateCount).toBe(4);
    expect(outcome.card.caselistDisplayName).toBe("NDT/CEDA 2021-22");
    expect(outcome.card.fulltext).toBe("body");
  });

  it("derives textLength from the body when the column is missing", () => {
    const outcome = normalizeDebateCardRow({ id: 1, fulltext: "12345" }, 0);
    expect("card" in outcome && outcome.card.textLength).toBe(5);
  });

  it("keeps the dump's own textLength over the trimmed body length", () => {
    const outcome = normalizeDebateCardRow({ id: 1, fulltext: "  hi  ", textLength: 6 }, 0);
    expect("card" in outcome && outcome.card.textLength).toBe(6);
  });

  it("rejects a row with no usable id", () => {
    const outcome = normalizeDebateCardRow({ id: 0, tag: "orphan" }, 12);
    expect("failure" in outcome && outcome.failure.code).toBe("missing-id");
    expect("failure" in outcome && outcome.failure.rowIndex).toBe(12);
  });

  it("rejects a row that carries no card text at all", () => {
    const outcome = normalizeDebateCardRow({ id: 9, year: 2022n }, 3);
    expect("failure" in outcome && outcome.failure.code).toBe("empty-card");
    expect("failure" in outcome && outcome.failure.id).toBe(9);
  });

  it("rejects a row larger than the per-card character limit", () => {
    const outcome = normalizeDebateCardRow(
      { id: 9, fulltext: "x".repeat(MAX_CARD_CHARS + 1) },
      0,
    );
    expect("failure" in outcome && outcome.failure.code).toBe("row-too-large");
  });

  it("rejects anything that is not a row object", () => {
    expect("failure" in normalizeDebateCardRow("nope", 0)).toBe(true);
    expect("failure" in normalizeDebateCardRow(["nope"], 0)).toBe(true);
    expect("failure" in normalizeDebateCardRow(null, 0)).toBe(true);
  });

  it("keeps a row that has only a tag", () => {
    expect("card" in normalizeDebateCardRow({ id: 1, tag: "Extinction first" }, 0)).toBe(true);
  });
});

describe("normalizeDebateCardRows", () => {
  it("splits good rows from failures and reports absolute row numbers", () => {
    const result = normalizeDebateCardRows([dumpRow(), { id: 0 }, dumpRow({ id: 2n })], 1_000);
    expect(result.cards).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].rowIndex).toBe(1_001);
  });
});

describe("chunkForUpload", () => {
  it("splits into batches of the requested size", () => {
    expect(chunkForUpload([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("never produces empty or infinite batches for a bad size", () => {
    expect(chunkForUpload([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("dedupeCardsById", () => {
  it("drops ids already sent in this run", () => {
    const seen = new Set<number>();
    const a = normalizeDebateCardRows([dumpRow(), dumpRow()]).cards;
    const first = dedupeCardsById(a, seen);
    expect(first.cards).toHaveLength(1);
    expect(first.duplicates).toBe(1);

    const second = dedupeCardsById(a, seen);
    expect(second.cards).toHaveLength(0);
    expect(second.duplicates).toBe(2);
  });
});

describe("progress reporting", () => {
  it("reports percent only when the shard's row count is known", () => {
    expect(cardImportPercent(emptyCardImportProgress())).toBeNull();
    expect(cardImportPercent({ ...emptyCardImportProgress(200), read: 50 })).toBe(25);
  });

  it("caps percent at 100 when more rows are read than the footer promised", () => {
    expect(cardImportPercent({ ...emptyCardImportProgress(10), read: 99 })).toBe(100);
  });

  it("names what landed and what did not", () => {
    expect(
      formatCardImportSummary("cards-0000.parquet", {
        read: 1_000,
        imported: 900,
        duplicates: 40,
        skipped: 60,
      }),
    ).toBe(
      "cards-0000.parquet: 900 cards imported, 40 duplicate ids skipped, 60 rows skipped (1,000 rows read).",
    );
  });

  it("omits the skip clauses when nothing was skipped", () => {
    expect(
      formatCardImportSummary("clean.parquet", {
        read: 2,
        imported: 2,
        duplicates: 0,
        skipped: 0,
      }),
    ).toBe("clean.parquet: 2 cards imported (2 rows read).");
  });
});

describe("column aliases", () => {
  it("lists both spellings of every renamed column", () => {
    expect(DEBATE_CARD_PARQUET_COLUMN_ALIASES).toContain("textLength");
    expect(DEBATE_CARD_PARQUET_COLUMN_ALIASES).toContain("text_length");
    expect(DEBATE_CARD_PARQUET_COLUMN_ALIASES).toContain("caselist_display_name");
  });
});

describe("parseCardUploadArgs", () => {
  it("parses files, flags and value options", () => {
    const parsed = parseCardUploadArgs([
      "a.parquet",
      "b.parquet",
      "--endpoint",
      "https://debate-ai.com/api/admin/debate-cards",
      "--token",
      "secret",
      "--batch",
      "50",
      "--start-row",
      "1000",
      "--dry-run",
    ]);
    expect(parsed.kind).toBe("options");
    if (parsed.kind !== "options") return;
    expect(parsed.options.files).toEqual(["a.parquet", "b.parquet"]);
    expect(parsed.options.endpoint).toBe("https://debate-ai.com/api/admin/debate-cards");
    expect(parsed.options.token).toBe("secret");
    expect(parsed.options.batchRows).toBe(50);
    expect(parsed.options.startRow).toBe(1_000);
    expect(parsed.options.dryRun).toBe(true);
  });

  it("accepts --flag=value form", () => {
    const parsed = parseCardUploadArgs(["a.parquet", "--batch=25"]);
    expect(parsed.kind === "options" && parsed.options.batchRows).toBe(25);
  });

  it("falls back to the environment, then to the default endpoint", () => {
    const fromEnv = parseCardUploadArgs(["a.parquet"], {
      DEBATE_CARDS_ENDPOINT: "https://example.test/api/admin/debate-cards",
      CARD_IMPORT_TOKEN: "env-token",
    });
    expect(fromEnv.kind === "options" && fromEnv.options.endpoint).toBe(
      "https://example.test/api/admin/debate-cards",
    );
    expect(fromEnv.kind === "options" && fromEnv.options.token).toBe("env-token");

    const bare = parseCardUploadArgs(["a.parquet"]);
    expect(bare.kind === "options" && bare.options.endpoint).toBe(DEFAULT_CARD_ENDPOINT);
    expect(bare.kind === "options" && bare.options.batchRows).toBe(CARD_UPLOAD_BATCH_ROWS);
  });

  it("reports usage errors instead of importing something unintended", () => {
    expect(parseCardUploadArgs([])).toEqual({
      kind: "error",
      message: "Name at least one .parquet file to import.",
    });
    expect(parseCardUploadArgs(["a.parquet", "--batch"]).kind).toBe("error");
    expect(parseCardUploadArgs(["a.parquet", "--batch", "0"]).kind).toBe("error");
    expect(parseCardUploadArgs(["a.parquet", "--batch", "1.5"]).kind).toBe("error");
    expect(parseCardUploadArgs(["a.parquet", "--nope"]).kind).toBe("error");
    expect(parseCardUploadArgs(["a.parquet", "--endpoint", "not-a-url"]).kind).toBe("error");
  });

  it("treats -h and --help as a request for the usage text", () => {
    expect(parseCardUploadArgs(["-h"]).kind).toBe("help");
    expect(parseCardUploadArgs(["a.parquet", "--help"]).kind).toBe("help");
  });
});

describe("createCardBatchSender", () => {
  const cards = normalizeDebateCardRows([dumpRow()]).cards;

  it("posts the batch with the file name and credentials", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ imported: 1, skipped: 0, failures: [] }), { status: 200 }),
    );
    const send = createCardBatchSender({
      endpoint: "https://example.test/api/admin/debate-cards",
      token: "secret",
      importId: "run-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await send(cards, { fileName: "cards-0000.parquet", batchIndex: 0 });
    expect(result.imported).toBe(1);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    const body = JSON.parse(init.body as string);
    expect(body.fileName).toBe("cards-0000.parquet");
    expect(body.importId).toBe("run-1");
    expect(body.cards).toHaveLength(1);
  });

  it("retries a transient failure, since batches are idempotent upserts", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream blip", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ imported: 1 }), { status: 200 }));

    const send = createCardBatchSender({
      endpoint: "https://example.test/api/admin/debate-cards",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    await expect(send(cards, { fileName: "s.parquet", batchIndex: 0 })).resolves.toMatchObject({
      imported: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a rejection that will not change, and names the shard", async () => {
    const fetchImpl = vi.fn(async () => new Response("Forbidden", { status: 403 }));
    const send = createCardBatchSender({
      endpoint: "https://example.test/api/admin/debate-cards",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async () => {},
    });

    await expect(send(cards, { fileName: "s.parquet", batchIndex: 4 })).rejects.toThrow(
      /Batch 5 of s\.parquet failed.*403/s,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt on a persistent server error", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    const send = createCardBatchSender({
      endpoint: "https://example.test/api/admin/debate-cards",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
      sleep: async () => {},
    });

    await expect(send(cards, { fileName: "s.parquet", batchIndex: 0 })).rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("uploadDebateCardShard", () => {
  it("throws a readable error rather than a decoder stack trace for a non-Parquet file", async () => {
    const bytes = new TextEncoder().encode("this is not a parquet file").buffer;
    await expect(
      uploadDebateCardShard({
        source: { byteLength: bytes.byteLength, slice: () => bytes },
        fileName: "notes.txt",
        send: async () => ({ imported: 0 }),
      }),
    ).rejects.toThrow();
  });
});
