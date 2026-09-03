import { afterEach, describe, expect, it, vi } from "vitest";
import { sendRoundInvites, type RoundInviteRequest } from "../src/round/round-invite-client";

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
