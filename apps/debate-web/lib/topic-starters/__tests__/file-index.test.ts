import { beforeEach, describe, expect, it, vi } from "vitest";

const bucketState: { bucket: FakeBucket | null } = { bucket: null };
vi.mock("@/lib/search/card-text-store", () => ({ getCardTextBucket: () => bucketState.bucket }));

import {
  TOPIC_STARTER_INDEX_KEY,
  getTopicStarterFileIndex,
  refreshTopicStarterFileIndexQuietly,
  regenerateTopicStarterFileIndex,
} from "@/lib/topic-starters/file-index";

class FakeBucket {
  objects = new Map<string, string>();
  puts = 0;
  async put(key: string, value: string) {
    this.puts++;
    this.objects.set(key, value);
  }
  async get(key: string) {
    const value = this.objects.get(key);
    return value == null ? null : { text: async () => value };
  }
}

/** A drizzle-shaped db whose select chain resolves to `rows`. */
function fakeDb(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
  };
  return { select: vi.fn(() => chain) } as never;
}

const ROWS = [
  { id: 2, title: "Neg", parentId: null, isFolder: true, tags: "[]", year: null, format: "html" },
  { id: 5, title: "Warming", parentId: 2, isFolder: false, tags: "[]", year: 2026, format: "cmir" },
];

beforeEach(() => {
  bucketState.bucket = null;
});

describe("topic starter file index", () => {
  it("builds from D1 and stores the snapshot in R2", async () => {
    const bucket = new FakeBucket();
    const index = await regenerateTopicStarterFileIndex(fakeDb(ROWS), bucket);
    expect(index.items.map((item) => item.id)).toEqual([2, 5]);
    expect(JSON.parse(bucket.objects.get(TOPIC_STARTER_INDEX_KEY)!)).toEqual(index);
  });

  it("serves the stored snapshot without touching D1", async () => {
    const bucket = new FakeBucket();
    bucketState.bucket = bucket;
    await regenerateTopicStarterFileIndex(fakeDb(ROWS), bucket);
    const db = fakeDb([]);
    const index = await getTopicStarterFileIndex(db);
    expect(index.count).toBe(2);
    expect((db as unknown as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();
  });

  it("builds (and stores) one when there is no snapshot yet", async () => {
    const bucket = new FakeBucket();
    bucketState.bucket = bucket;
    expect((await getTopicStarterFileIndex(fakeDb(ROWS))).count).toBe(2);
    expect(bucket.puts).toBe(1);
  });

  it("answers from D1 when no bucket is bound", async () => {
    expect((await getTopicStarterFileIndex(fakeDb(ROWS))).count).toBe(2);
  });

  it("rebuilds quietly after an edit, and skips without a bucket", async () => {
    const db = fakeDb(ROWS);
    await refreshTopicStarterFileIndexQuietly(db);
    expect((db as unknown as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();

    const bucket = new FakeBucket();
    bucket.put = async () => {
      throw new Error("r2 down");
    };
    bucketState.bucket = bucket;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(refreshTopicStarterFileIndexQuietly(db)).resolves.toBeUndefined();
  });
});
