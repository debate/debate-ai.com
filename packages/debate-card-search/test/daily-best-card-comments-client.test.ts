import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedDailyBestCardCommentFromAccount,
  listSavedDailyBestCardComments,
  saveDailyBestCardCommentToAccount,
} from "../src/lib/daily-best-card-comments-client";
import type { DailyBestCardComment } from "../src/state/dailyBestCardComments";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

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
    const fetchMock = mockFetchJson([COMMENT]);

    const result = await listSavedDailyBestCardComments();

    expect(result).toEqual([COMMENT]);
    expect(fetchMock).toHaveBeenCalledWith("/api/daily-best-card-comments", expect.anything());
  });

  it("returns null on a 401 rather than throwing", async () => {
    mockFetchError(401, "Unauthorized");

    expect(await listSavedDailyBestCardComments()).toBeNull();
  });

  it("throws on another failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(listSavedDailyBestCardComments()).rejects.toThrow("Failed to load your synced comments.");
  });
});

describe("saveDailyBestCardCommentToAccount", () => {
  it("PUTs to the comment's id-keyed endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await saveDailyBestCardCommentToAccount(COMMENT);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/daily-best-card-comments/dbc-comment-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ comment: COMMENT });
  });

  it("throws on failure", async () => {
    mockFetchError(400, "Bad Request");

    await expect(saveDailyBestCardCommentToAccount(COMMENT)).rejects.toThrow(
      "Failed to sync this comment to your account.",
    );
  });
});

describe("deleteSavedDailyBestCardCommentFromAccount", () => {
  it("DELETEs the comment's id-keyed endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await deleteSavedDailyBestCardCommentFromAccount(COMMENT.id);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/daily-best-card-comments/dbc-comment-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(deleteSavedDailyBestCardCommentFromAccount(COMMENT.id)).rejects.toThrow(
      "Failed to remove this synced comment.",
    );
  });
});
