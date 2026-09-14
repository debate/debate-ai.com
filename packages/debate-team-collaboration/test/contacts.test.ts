import { describe, expect, it } from "vitest";
import {
  CONTACT_REQUEST_REFUSED_MESSAGE,
  PRESENCE_ONLINE_WINDOW_MS,
  buildInviteLink,
  canShareWith,
  deriveRelationship,
  findPair,
  isPresenceOnline,
  normalizeCardShareMessage,
  normalizeCardShareTitle,
  parseInviteInput,
  parseShareCode,
  resolveContactRequest,
  sortContacts,
  type BlockPair,
  type ContactPair,
} from "../src/lib/contacts";

const ROOM = "0123456789abcdef0123456789abcdef";
// 32 bytes → 43 base64url chars, no padding.
const KEY = "A".repeat(43);
const V1 = `cmshare1.${ROOM}.${KEY}`;
const V2 = `cmshare2.${ROOM}.${KEY}.1.2.0`;

describe("deriveRelationship", () => {
  const accepted: ContactPair = { id: 1, requesterId: "a", addresseeId: "b", status: "accepted" };
  const pending: ContactPair = { id: 2, requesterId: "a", addresseeId: "c", status: "pending" };

  it("is self for the same id", () => {
    expect(deriveRelationship("a", "a", [], [])).toBe("self");
  });

  it("is none with no rows", () => {
    expect(deriveRelationship("a", "z", [accepted, pending], [])).toBe("none");
  });

  it("reads an accepted row from either side", () => {
    expect(deriveRelationship("a", "b", [accepted], [])).toBe("contact");
    expect(deriveRelationship("b", "a", [accepted], [])).toBe("contact");
  });

  it("distinguishes outgoing from incoming on a pending row", () => {
    expect(deriveRelationship("a", "c", [pending], [])).toBe("outgoing");
    expect(deriveRelationship("c", "a", [pending], [])).toBe("incoming");
  });

  it("lets a block in either direction win over a contact row", () => {
    const iBlocked: BlockPair = { blockerId: "a", blockedId: "b" };
    const theyBlocked: BlockPair = { blockerId: "b", blockedId: "a" };
    expect(deriveRelationship("a", "b", [accepted], [iBlocked])).toBe("blocked");
    expect(deriveRelationship("a", "b", [accepted], [theyBlocked])).toBe("blocked-by");
    // A mutual block reads as "blocked" from both sides.
    expect(deriveRelationship("b", "a", [accepted], [iBlocked, theyBlocked])).toBe("blocked");
  });

  it("findPair ignores rows for other pairs", () => {
    expect(findPair("a", "b", [pending])).toBeNull();
    expect(findPair("b", "a", [accepted, pending])).toBe(accepted);
  });
});

describe("resolveContactRequest", () => {
  it("creates a request when there is no relationship", () => {
    expect(resolveContactRequest("none")).toEqual({ action: "create" });
  });

  it("turns a request at someone who already asked into an accept", () => {
    expect(resolveContactRequest("incoming")).toEqual({ action: "accept" });
  });

  it("is a no-op when already pending or already contacts", () => {
    expect(resolveContactRequest("outgoing")).toEqual({ action: "noop", relationship: "outgoing" });
    expect(resolveContactRequest("contact")).toEqual({ action: "noop", relationship: "contact" });
  });

  it("refuses self, blocked, and blocked-by — the last with the generic message", () => {
    expect(resolveContactRequest("self").action).toBe("reject");
    const blocked = resolveContactRequest("blocked");
    expect(blocked.action).toBe("reject");
    if (blocked.action === "reject") expect(blocked.reason).toMatch(/unblock/i);
    const blockedBy = resolveContactRequest("blocked-by");
    expect(blockedBy).toEqual({ action: "reject", reason: CONTACT_REQUEST_REFUSED_MESSAGE });
  });

  it("only accepted contacts can receive a share", () => {
    expect(canShareWith("contact")).toBe(true);
    for (const r of ["none", "outgoing", "incoming", "blocked", "blocked-by", "self"] as const) {
      expect(canShareWith(r)).toBe(false);
    }
  });
});

describe("parseShareCode", () => {
  it("parses a v1 code", () => {
    expect(parseShareCode(V1)).toEqual({ shareCode: V1, roomId: ROOM, minVersion: null });
  });

  it("parses a v2 code with its version floor (dots and all)", () => {
    expect(parseShareCode(V2)).toEqual({ shareCode: V2, roomId: ROOM, minVersion: "1.2.0" });
    expect(parseShareCode(`cmshare2.${ROOM}.${KEY}.1.0.0-beta.3`)?.minVersion).toBe("1.0.0-beta.3");
  });

  it("trims surrounding whitespace", () => {
    expect(parseShareCode(`  ${V1}\n`)?.shareCode).toBe(V1);
  });

  it("rejects malformed codes", () => {
    expect(parseShareCode("")).toBeNull();
    expect(parseShareCode("cmshare1.notHex.AAAA")).toBeNull();
    expect(parseShareCode(`cmshare1.${ROOM}.${"A".repeat(42)}`)).toBeNull(); // short key
    expect(parseShareCode(`cmshare3.${ROOM}.${KEY}`)).toBeNull(); // unknown generation
    expect(parseShareCode(`cmshare1.${ROOM}.${KEY}.1.0.0`)).toBeNull(); // v1 with a floor
    expect(parseShareCode(`cmshare2.${ROOM}.${KEY}`)).toBeNull(); // v2 without a floor
    expect(parseShareCode(`${V1} extra`)).toBeNull();
  });
});

describe("parseInviteInput", () => {
  it("accepts a bare share code with no guest pass", () => {
    expect(parseInviteInput(V1)).toEqual({ shareCode: V1, roomId: ROOM, minVersion: null, guestPass: null });
  });

  it("extracts the code and guest pass from a full invite link", () => {
    const link = `https://cardmirror.app/#join=${V1}&pass=gp_abc123`;
    expect(parseInviteInput(link)).toEqual({
      shareCode: V1,
      roomId: ROOM,
      minVersion: null,
      guestPass: "gp_abc123",
    });
  });

  it("accepts a link without a pass and a hash-only fragment", () => {
    expect(parseInviteInput(`https://x.test/#join=${V2}`)?.guestPass).toBeNull();
    expect(parseInviteInput(`#join=${V1}&pass=p`)?.guestPass).toBe("p");
  });

  it("rejects links whose join param is not a share code", () => {
    expect(parseInviteInput("https://cardmirror.app/#join=nope&pass=p")).toBeNull();
    expect(parseInviteInput("https://cardmirror.app/#other=1")).toBeNull();
    expect(parseInviteInput("   ")).toBeNull();
  });

  it("buildInviteLink round-trips through parseInviteInput", () => {
    const link = buildInviteLink(V1, "gp", "https://debate-ai.com/");
    expect(link).toBe(`https://debate-ai.com/#join=${V1}&pass=gp`);
    expect(parseInviteInput(link)).toMatchObject({ shareCode: V1, guestPass: "gp" });
    expect(buildInviteLink(V1, null, "https://debate-ai.com")).toBe(`https://debate-ai.com/#join=${V1}`);
  });
});

describe("normalizeCardShareTitle / normalizeCardShareMessage", () => {
  it("trims, defaults, and caps the title", () => {
    expect(normalizeCardShareTitle("  Warming DA  ")).toBe("Warming DA");
    expect(normalizeCardShareTitle("")).toBe("Untitled document");
    expect(normalizeCardShareTitle(undefined)).toBe("Untitled document");
    expect(normalizeCardShareTitle("x".repeat(500))).toHaveLength(200);
  });

  it("trims, nulls, and caps the message", () => {
    expect(normalizeCardShareMessage("  hi ")).toBe("hi");
    expect(normalizeCardShareMessage("   ")).toBeNull();
    expect(normalizeCardShareMessage(42)).toBeNull();
    expect(normalizeCardShareMessage("y".repeat(900))).toHaveLength(500);
  });
});

describe("isPresenceOnline", () => {
  const now = Date.UTC(2026, 8, 7, 12, 0, 0);

  it("is online inside the window and offline just past it", () => {
    expect(isPresenceOnline(now - 30_000, now)).toBe(true);
    expect(isPresenceOnline(new Date(now - PRESENCE_ONLINE_WINDOW_MS), now)).toBe(true);
    expect(isPresenceOnline(now - PRESENCE_ONLINE_WINDOW_MS - 1, now)).toBe(false);
  });

  it("accepts ISO strings and rejects garbage/null", () => {
    expect(isPresenceOnline(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isPresenceOnline("not a date", now)).toBe(false);
    expect(isPresenceOnline(null, now)).toBe(false);
    expect(isPresenceOnline(undefined, now)).toBe(false);
  });
});

describe("sortContacts", () => {
  const u = (id: string, name: string) => ({ id, name, email: `${id}@x.test`, image: null });

  it("puts online contacts first, then sorts by name case-insensitively, then id", () => {
    const rows = [
      { user: u("3", "zed"), online: false },
      { user: u("2", "Amy"), online: false },
      { user: u("1", "bob"), online: true },
      { user: u("0", "amy"), online: false },
    ];
    expect(sortContacts(rows).map((r) => r.user.id)).toEqual(["1", "0", "2", "3"]);
  });

  it("does not mutate its input", () => {
    const rows = [{ user: u("b", "b"), online: false }, { user: u("a", "a"), online: false }];
    const copy = [...rows];
    sortContacts(rows);
    expect(rows).toEqual(copy);
  });
});
