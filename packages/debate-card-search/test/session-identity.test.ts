import { describe, expect, it } from "vitest";
import { deriveContributorIdFromSessionIdentity } from "../src/lib/session-identity";

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
