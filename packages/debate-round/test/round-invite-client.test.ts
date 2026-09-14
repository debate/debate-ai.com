import { afterEach, describe, expect, it, vi } from "vitest";
import {
  sendRoundInvites,
  computeAddedInviteEmails,
  type RoundInviteRequest,
} from "../src/round/round-invite-client";

const REQUEST: RoundInviteRequest = {
  emails: ["a@example.com", "b@example.com"],
  tournamentName: "Blake",
  roundLevel: "Prelim 1",
  slug: "blake-prelim-1",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendRoundInvites", () => {
  it("POSTs the request and returns the parsed result", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ notified: ["a@example.com"], emailed: ["b@example.com"], skipped: [] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendRoundInvites(REQUEST);

    expect(result).toEqual({ notified: ["a@example.com"], emailed: ["b@example.com"], skipped: [] });
    expect(fetchMock).toHaveBeenCalledWith("/api/rounds/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(REQUEST),
    });
  });

  it("resolves to null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendRoundInvites(REQUEST)).toBeNull();
  });

  it("resolves to null when fetch itself throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendRoundInvites(REQUEST)).toBeNull();
  });
});

describe("computeAddedInviteEmails", () => {
  it("returns only emails present in nextEmails but not previousEmails", () => {
    const added = computeAddedInviteEmails(
      ["a@example.com", "b@example.com"],
      ["a@example.com", "b@example.com", "c@example.com"],
    );
    expect(added).toEqual(["c@example.com"]);
  });

  it("returns an empty array when nothing new was added", () => {
    const added = computeAddedInviteEmails(
      ["a@example.com", "b@example.com"],
      ["b@example.com", "a@example.com"],
    );
    expect(added).toEqual([]);
  });

  it("is case-insensitive when comparing against previousEmails", () => {
    const added = computeAddedInviteEmails(
      ["A@Example.com"],
      ["a@example.com", "new@example.com"],
    );
    expect(added).toEqual(["new@example.com"]);
  });

  it("ignores blank/whitespace-only entries in both lists", () => {
    const added = computeAddedInviteEmails(
      ["a@example.com", "", "   "],
      ["a@example.com", "", "  ", "b@example.com"],
    );
    expect(added).toEqual(["b@example.com"]);
  });

  it("dedupes nextEmails, keeping the first-seen casing", () => {
    const added = computeAddedInviteEmails(
      [],
      ["New@Example.com", "new@example.com", " new@example.com "],
    );
    expect(added).toEqual(["New@Example.com"]);
  });

  it("trims surrounding whitespace from a returned added email", () => {
    const added = computeAddedInviteEmails([], ["  new@example.com  "]);
    expect(added).toEqual(["new@example.com"]);
  });

  it("returns an empty array when both lists are empty", () => {
    expect(computeAddedInviteEmails([], [])).toEqual([]);
  });
});
