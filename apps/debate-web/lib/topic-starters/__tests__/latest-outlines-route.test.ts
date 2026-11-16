/**
 * @fileoverview `GET /api/homepage/latest-outlines` — the homepage's latest
 * outline files, picked from the Topic Starters file index.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ fail: false, items: [] as unknown[] }));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => ({}) }));
vi.mock("@/lib/topic-starters/changes", () => ({ ensureTopicStarterColumns: async () => {} }));
vi.mock("@/lib/topic-starters/file-index", () => ({
  getTopicStarterFileIndex: async () => {
    if (state.fail) throw new Error("R2 down");
    return { version: 3, generatedAt: "", count: state.items.length, items: state.items };
  },
}));

const { GET } = await import("@/app/api/homepage/latest-outlines/route");

const folder = { id: 1, title: "Aff", parentId: null, isFolder: true, tags: "[]", year: null, topicCode: "lda27" };
const files = Array.from({ length: 15 }, (_, i) => ({
  id: 10 + i,
  title: `File ${i}`,
  parentId: 1,
  isFolder: false,
  tags: "[]",
  year: null,
  topicCode: null,
  updatedAt: new Date(Date.UTC(2026, 10, 1 + i)).toISOString(),
}));

function get(query = "") {
  return GET(new NextRequest(`https://example.test/api/homepage/latest-outlines${query}`));
}

describe("GET /api/homepage/latest-outlines", () => {
  beforeEach(() => {
    state.fail = false;
    state.items = [folder, ...files];
  });

  it("returns the newest files, 12 by default, with cache headers", async () => {
    const res = await get();
    const body = await res.json();
    expect(body).toHaveLength(12);
    expect(body[0]).toMatchObject({ id: 24, formatLabel: "LD", href: "/docs/lda27/aff/file-14" });
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });

  it("honours a limit and ignores a bad one", async () => {
    expect(await (await get("?limit=3")).json()).toHaveLength(3);
    expect(await (await get("?limit=abc")).json()).toHaveLength(12);
  });

  it("answers an empty list when the index can't be read", async () => {
    state.fail = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await (await get()).json()).toEqual([]);
    errors.mockRestore();
  });
});
