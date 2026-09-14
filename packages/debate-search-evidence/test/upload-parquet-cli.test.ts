/**
 * @fileoverview Drives the `debate-cards-upload` CLI end to end.
 *
 * The CLI writes to a real card library when it is pointed at one, so its
 * guards are worth testing directly: that it refuses to run without
 * credentials, that `--dry-run` posts nothing, that a row range is honoured,
 * and that one unreadable file in a glob neither aborts the run nor lets it
 * exit 0. It is exercised through `main()` with a real Parquet file on disk
 * and a stubbed `fetch`, so the file reading is the CLI's own.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { formatBytes, formatProgressLine, main } from "../src/cli/upload-parquet";
import { buildCardShard } from "./parquet-card-fixture";

let workDir = "";
let shardPath = "";

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "card-import-"));
  shardPath = path.join(workDir, "cards-0000.parquet");
  await writeFile(shardPath, new Uint8Array(buildCardShard({ rowCount: 12, rowGroupSize: 4 })));
});

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** Silences the CLI's console output and returns everything it printed. */
function captureConsole() {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "log").mockImplementation(record);
  vi.spyOn(console, "warn").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);
  return {
    get text() {
      return lines.join("\n");
    },
  };
}

/** A `fetch` that accepts every batch and records the cards it received. */
function acceptingFetch() {
  const received: Array<Record<string, any>> = [];
  const impl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    received.push(body);
    return new Response(
      JSON.stringify({ imported: body.cards.length, skipped: 0, failures: [] }),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", impl);
  return {
    impl,
    received,
    get cards() {
      return received.flatMap((body) => body.cards);
    },
  };
}

describe("formatting helpers", () => {
  it("scales byte counts to a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1_536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 ** 4)).toBe("3.0 TB");
  });

  it("shows a percentage only once the shard's size is known", () => {
    expect(
      formatProgressLine("s.parquet", { read: 50, imported: 40, duplicates: 0, skipped: 0, total: 100 }),
    ).toContain("50%");
    expect(
      formatProgressLine("s.parquet", { read: 50, imported: 40, duplicates: 0, skipped: 0 }),
    ).not.toContain("%");
  });

  it("names skipped rows only when there are some", () => {
    expect(
      formatProgressLine("s.parquet", { read: 10, imported: 8, duplicates: 1, skipped: 1 }),
    ).toContain("2 skipped");
    expect(
      formatProgressLine("s.parquet", { read: 10, imported: 10, duplicates: 0, skipped: 0 }),
    ).not.toContain("skipped");
  });
});

describe("main", () => {
  it("prints usage for --help without importing anything", async () => {
    const output = captureConsole();
    await expect(main(["--help"])).resolves.toBe(0);
    expect(output.text).toContain("debate-cards-upload");
    expect(output.text).toContain("--start-row");
  });

  it("rejects an invocation with no files", async () => {
    const output = captureConsole();
    await expect(main([])).resolves.toBe(2);
    expect(output.text).toContain("Name at least one .parquet file");
  });

  it("rejects an unusable flag value rather than importing a surprise range", async () => {
    captureConsole();
    await expect(main([shardPath, "--batch", "0"])).resolves.toBe(2);
    await expect(main([shardPath, "--endpoint", "not-a-url"])).resolves.toBe(2);
  });

  it("refuses to run against an endpoint with no credentials", async () => {
    const output = captureConsole();
    await expect(main([shardPath])).resolves.toBe(2);
    expect(output.text).toContain("No credentials");
  });

  it("parses a shard and reports it without writing, on --dry-run", async () => {
    const output = captureConsole();
    const fetchStub = acceptingFetch();

    await expect(main([shardPath, "--dry-run", "--quiet"])).resolves.toBe(0);

    expect(fetchStub.impl).not.toHaveBeenCalled();
    expect(output.text).toContain("12 cards imported");
    expect(output.text).toContain("dry run — nothing written");
  });

  it("imports a shard to the endpoint in batches", async () => {
    captureConsole();
    const fetchStub = acceptingFetch();

    await expect(
      main([
        shardPath,
        "--endpoint",
        "https://example.test/api/admin/debate-cards",
        "--token",
        "secret",
        "--batch",
        "5",
        "--quiet",
      ]),
    ).resolves.toBe(0);

    expect(fetchStub.cards).toHaveLength(12);
    expect(fetchStub.received.map((body) => body.cards.length)).toEqual([5, 5, 2]);

    const [, init] = fetchStub.impl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(fetchStub.received[0].fileName).toBe("cards-0000.parquet");
    // Every batch of one run carries the same id, for log correlation.
    expect(new Set(fetchStub.received.map((body) => body.importId)).size).toBe(1);
  });

  it("honours --start-row and --max-rows, so an interrupted run can resume", async () => {
    captureConsole();
    const fetchStub = acceptingFetch();

    await expect(
      main([
        shardPath,
        "--endpoint",
        "https://example.test/api/admin/debate-cards",
        "--token",
        "secret",
        "--start-row",
        "8",
        "--max-rows",
        "3",
        "--quiet",
      ]),
    ).resolves.toBe(0);

    expect(fetchStub.cards.map((card: { id: number }) => card.id)).toEqual([9, 10, 11]);
  });

  it("reads credentials from the environment when no flag gives them", async () => {
    captureConsole();
    const fetchStub = acceptingFetch();
    vi.stubEnv("CARD_IMPORT_TOKEN", "env-secret");
    vi.stubEnv("DEBATE_CARDS_ENDPOINT", "https://example.test/api/admin/debate-cards");

    await expect(main([shardPath, "--quiet"])).resolves.toBe(0);

    const [url, init] = fetchStub.impl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/api/admin/debate-cards");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer env-secret");
  });

  it("imports one shard per id across a multi-file run", async () => {
    captureConsole();
    const fetchStub = acceptingFetch();

    await expect(
      main([
        shardPath,
        shardPath,
        "--endpoint",
        "https://example.test/api/admin/debate-cards",
        "--token",
        "secret",
        "--quiet",
      ]),
    ).resolves.toBe(0);

    // The same shard twice: the second pass is all duplicate ids.
    expect(fetchStub.cards).toHaveLength(12);
  });

  it("imports each file independently under --per-file-dedupe", async () => {
    captureConsole();
    const fetchStub = acceptingFetch();

    await expect(
      main([
        shardPath,
        shardPath,
        "--endpoint",
        "https://example.test/api/admin/debate-cards",
        "--token",
        "secret",
        "--per-file-dedupe",
        "--quiet",
      ]),
    ).resolves.toBe(0);

    expect(fetchStub.cards).toHaveLength(24);
  });

  it("reports a shard's skipped rows with their positions", async () => {
    const junkPath = path.join(workDir, "junk.parquet");
    await writeFile(
      junkPath,
      new Uint8Array(buildCardShard({ rowCount: 4, rows: { 2: { empty: true } } })),
    );

    const output = captureConsole();
    await expect(main([junkPath, "--dry-run"])).resolves.toBe(0);

    expect(output.text).toContain("row 2");
    expect(output.text).toContain("empty-card");
  });

  it("names ignored non-card columns instead of silently dropping them", async () => {
    const widePath = path.join(workDir, "wide.parquet");
    await writeFile(
      widePath,
      new Uint8Array(buildCardShard({ rowCount: 2, extraColumns: ["embedding"] })),
    );

    const output = captureConsole();
    await expect(main([widePath, "--dry-run", "--quiet"])).resolves.toBe(0);
    expect(output.text).toContain("embedding");
  });

  it("keeps going after an unreadable file, but exits non-zero", async () => {
    const badPath = path.join(workDir, "not-parquet.parquet");
    await writeFile(badPath, "this is not a parquet file");

    const output = captureConsole();
    await expect(main([badPath, shardPath, "--dry-run"])).resolves.toBe(1);

    // The good shard still imported...
    expect(output.text).toContain("12 cards imported");
    // ...and the bad one is named in the failure list.
    expect(output.text).toContain("not-parquet.parquet");
    expect(output.text).toContain("1 file(s) failed");
  });

  it("surfaces a rejected batch as a failed file rather than a silent partial", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Forbidden", { status: 403 })),
    );

    const output = captureConsole();
    await expect(
      main([
        shardPath,
        "--endpoint",
        "https://example.test/api/admin/debate-cards",
        "--token",
        "wrong",
        "--quiet",
      ]),
    ).resolves.toBe(1);

    expect(output.text).toContain("403");
    expect(output.text).toContain("file(s) failed");
  });
});
