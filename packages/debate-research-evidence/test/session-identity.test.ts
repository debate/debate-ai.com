import { describe, expect, it } from "vitest";
import {
  deriveContributorIdFromSessionIdentity,
  deriveLockedVerifierId,
  isOwnContributorRow,
} from "../src/lib/session-identity";

describe("deriveContributorIdFromSessionIdentity", () => {
  it("returns '' for a null or undefined identity", () => {
    expect(deriveContributorIdFromSessionIdentity(null)).toBe("");
    expect(deriveContributorIdFromSessionIdentity(undefined)).toBe("");
  });

  it("prefers the trimmed display name when present", () => {
    expect(
      deriveContributorIdFromSessionIdentity({
        id: "usr_1",
        name: "  Alice Chen  ",
        email: "alice@example.com",
      }),
    ).toBe("Alice Chen");
  });

  it("falls back to the email's local part when there is no name", () => {
    expect(
      deriveContributorIdFromSessionIdentity({
        id: "usr_1",
        name: null,
        email: "bob.smith@example.com",
      }),
    ).toBe("bob.smith");
  });

  it("falls back to the email's local part when the name is blank", () => {
    expect(
      deriveContributorIdFromSessionIdentity({ id: "usr_1", name: "   ", email: "carol@example.com" }),
    ).toBe("carol");
  });

  it("falls back to the raw account id when there is no usable name or email", () => {
    expect(deriveContributorIdFromSessionIdentity({ id: "usr_42", name: "", email: "" })).toBe("usr_42");
    expect(deriveContributorIdFromSessionIdentity({ id: "usr_42" })).toBe("usr_42");
  });

  it("returns '' when no field is usable", () => {
    expect(deriveContributorIdFromSessionIdentity({})).toBe("");
    expect(deriveContributorIdFromSessionIdentity({ id: "  ", name: "  ", email: "  " })).toBe("");
  });

  it("handles an email with no local part gracefully by falling back to id", () => {
    expect(deriveContributorIdFromSessionIdentity({ id: "usr_9", email: "@example.com" })).toBe("usr_9");
  });
});

describe("isOwnContributorRow", () => {
  it("matches a row whose contributor id equals the signed-in id", () => {
    expect(isOwnContributorRow("alice", "alice")).toBe(true);
  });

  it("matches case-insensitively and ignores surrounding whitespace on both sides", () => {
    expect(isOwnContributorRow("  Alice  ", "alice")).toBe(true);
    expect(isOwnContributorRow("alice", "  ALICE  ")).toBe(true);
  });

  it("does not match a different contributor id", () => {
    expect(isOwnContributorRow("bob", "alice")).toBe(false);
  });

  it("returns false when signed out (null, undefined, or blank)", () => {
    expect(isOwnContributorRow("alice", null)).toBe(false);
    expect(isOwnContributorRow("alice", undefined)).toBe(false);
    expect(isOwnContributorRow("alice", "   ")).toBe(false);
  });

  it("does not match a blank contributor id even when signed in", () => {
    expect(isOwnContributorRow("", "alice")).toBe(false);
    expect(isOwnContributorRow("   ", "alice")).toBe(false);
  });
});

describe("deriveLockedVerifierId", () => {
  it("returns '' when signed out (null, undefined, or blank)", () => {
    expect(deriveLockedVerifierId("alice", null)).toBe("");
    expect(deriveLockedVerifierId("alice", undefined)).toBe("");
    expect(deriveLockedVerifierId("alice", "   ")).toBe("");
  });

  it("returns the trimmed signed-in id when it differs from the task owner", () => {
    expect(deriveLockedVerifierId("alice", "  bob  ")).toBe("bob");
  });

  it("returns '' when the signed-in id matches the task owner (self-verification)", () => {
    expect(deriveLockedVerifierId("alice", "alice")).toBe("");
  });

  it("matches the task owner case-insensitively and ignores surrounding whitespace", () => {
    expect(deriveLockedVerifierId("  Alice  ", "alice")).toBe("");
    expect(deriveLockedVerifierId("alice", "  ALICE  ")).toBe("");
  });

  it("does not treat a blank task owner as a self-match", () => {
    expect(deriveLockedVerifierId("", "alice")).toBe("alice");
  });
});
