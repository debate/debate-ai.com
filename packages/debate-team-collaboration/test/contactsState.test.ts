import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptContactRequest,
  blockUser,
  declineContactRequest,
  fetchContacts,
  removeContact,
  searchUsers,
  sendContactRequest,
  unblockUser,
} from "../src/state/contacts";
import {
  fetchCardShares,
  markCardShareOpened,
  removeCardShare,
  shareCard,
} from "../src/state/cardShares";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: (url: string, init?: RequestInit) => Partial<Response> | Promise<Partial<Response>>) {
  const mock = vi.fn(impl) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  vi.stubGlobal("fetch", mock);
  return mock;
}

const ok = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload });
const fail = (status: number, error?: string) => ({
  ok: false,
  status,
  json: async () => (error ? { error } : {}),
});

describe("contacts client", () => {
  it("GETs /api/contacts and returns the page; null on 401 or a thrown fetch", async () => {
    const page = { contacts: [], incoming: [], outgoing: [], blocked: [] };
    const mock = stubFetch(() => ok(page));
    expect(await fetchContacts()).toEqual(page);
    expect(mock).toHaveBeenCalledWith("/api/contacts");

    stubFetch(() => fail(401));
    expect(await fetchContacts()).toBeNull();

    stubFetch(() => {
      throw new Error("offline");
    });
    expect(await fetchContacts()).toBeNull();
  });

  it("POSTs a request by userId or email and returns the server's status", async () => {
    const mock = stubFetch(() => ok({ status: "requested" }));
    expect(await sendContactRequest({ userId: "u2" })).toEqual({ status: "requested" });
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contacts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ userId: "u2" });

    stubFetch(() => ok({ status: "accepted" }));
    expect(await sendContactRequest({ email: "a@b.co" })).toEqual({ status: "accepted" });
  });

  it("surfaces the server's error message on a refused request", async () => {
    stubFetch(() => fail(403, "You can't send a contact request to this user."));
    await expect(sendContactRequest({ userId: "x" })).rejects.toThrow(/can't send a contact request/);
  });

  it("accept/decline PATCH with the row id and action", async () => {
    const mock = stubFetch(() => ok({ ok: true }));
    await acceptContactRequest(7);
    await declineContactRequest(8);
    const bodies = mock.mock.calls.map((c: unknown[]) => JSON.parse(String((c[1] as RequestInit).body)));
    expect(bodies).toEqual([
      { id: 7, action: "accept" },
      { id: 8, action: "decline" },
    ]);
    expect((mock.mock.calls[0] as [string, RequestInit])[1].method).toBe("PATCH");
  });

  it("removeContact DELETEs with the id in the query", async () => {
    const mock = stubFetch(() => ok({ ok: true }));
    await removeContact(12);
    expect(mock).toHaveBeenCalledWith("/api/contacts?id=12", { method: "DELETE" });
  });

  it("block/unblock hit /api/contacts/block with POST/DELETE", async () => {
    const mock = stubFetch(() => ok({ ok: true }));
    await blockUser("u9");
    await unblockUser("u9");
    const calls = mock.mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe("/api/contacts/block");
    expect(calls[0][1].method).toBe("POST");
    expect(calls[1][1].method).toBe("DELETE");
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ userId: "u9" });
  });

  it("searchUsers encodes the query, skips blank input, and tolerates failures", async () => {
    const mock = stubFetch(() => ok({ users: [{ id: "1", name: "A", email: "a@x", image: null }] }));
    expect(await searchUsers("  ")).toEqual([]);
    expect(mock).not.toHaveBeenCalled();
    expect(await searchUsers("a b")).toHaveLength(1);
    expect(mock).toHaveBeenCalledWith("/api/users/search?q=a%20b");

    stubFetch(() => fail(401));
    expect(await searchUsers("z")).toEqual([]);
  });
});

describe("card shares client", () => {
  it("GETs /api/card-shares; null when signed out", async () => {
    const page = { received: [], sent: [] };
    const mock = stubFetch(() => ok(page));
    expect(await fetchCardShares()).toEqual(page);
    expect(mock).toHaveBeenCalledWith("/api/card-shares");
    stubFetch(() => fail(401));
    expect(await fetchCardShares()).toBeNull();
  });

  it("shareCard POSTs the input and returns shared/skipped ids", async () => {
    const mock = stubFetch(() => ok({ shared: ["a"], skipped: ["b"] }));
    const input = { shareCode: "cmshare1.x.y", guestPass: "p", title: "T", recipientIds: ["a", "b"] };
    expect(await shareCard(input)).toEqual({ shared: ["a"], skipped: ["b"] });
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it("shareCard throws the server's message on a bad code", async () => {
    stubFetch(() => fail(400, "That does not look like a share code."));
    await expect(shareCard({ shareCode: "nope", recipientIds: [] })).rejects.toThrow(/share code/);
  });

  it("markCardShareOpened PATCHes and never throws", async () => {
    const mock = stubFetch(() => ok({ ok: true }));
    await markCardShareOpened(3);
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ id: 3, action: "opened" });

    stubFetch(() => {
      throw new Error("offline");
    });
    await expect(markCardShareOpened(3)).resolves.toBeUndefined();
  });

  it("removeCardShare DELETEs by id and throws on failure", async () => {
    const mock = stubFetch(() => ok({ ok: true }));
    await removeCardShare(5);
    expect(mock).toHaveBeenCalledWith("/api/card-shares?id=5", { method: "DELETE" });
    stubFetch(() => fail(404, "No share with that id."));
    await expect(removeCardShare(6)).rejects.toThrow(/No share/);
  });
});
