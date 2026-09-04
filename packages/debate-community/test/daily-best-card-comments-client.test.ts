import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedDailyBestCardCommentFromAccount,
  listSavedDailyBestCardComments,
  saveDailyBestCardCommentToAccount,
} from "../src/lib/daily-best-card-comments-client";
import type { DailyBestCardComment } from "../src/state/dailyBestCardComments";

const COMMENT: DailyBestCardComment = {
  id: "dbc-comment-1700000000000-ab12cd",
  dayKey: "2026-08-30",
  authorId: "alex",
  text: "Great card!",
  postedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedDailyBestCardComments", () => {
  it("GETs the endpoint and returns the parsed comment list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [COMMENT],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedDailyBestCardComments();

    expect(result).toEqual([COMMENT]);
    expect(fetchMock).toHaveBeenCalledWith("/api/daily-best-card-comments");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedDailyBestCardComments()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedDailyBestCardComments()).rejects.toThrow("Something broke.");
  });
});

describe("saveDailyBestCardCommentToAccount", () => {
  it("PUTs to the comment's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveDailyBestCardCommentToAccount(COMMENT);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/daily-best-card-comments/dbc-comment-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ comment: COMMENT });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid comment." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveDailyBestCardCommentToAccount(COMMENT)).rejects.toThrow("Invalid comment.");
  });
});

describe("deleteSavedDailyBestCardCommentFromAccount", () => {
  it("DELETEs the comment's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedDailyBestCardCommentFromAccount(COMMENT.id);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/daily-best-card-comments/dbc-comment-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Failed to remove." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedDailyBestCardCommentFromAccount(COMMENT.id)).rejects.toThrow("Failed to remove.");
  });
});
