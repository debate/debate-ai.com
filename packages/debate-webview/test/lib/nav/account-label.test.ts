/**
 * @fileoverview One line names the signed-in user in the dock's menu.
 *
 * The address used to sit under the name as a second line — the longest
 * string in a panel whose width is what the nav submenus have to open beside
 * on a phone. What this pins is that an account with no name on it still
 * gets named, and gets named by something shorter than the whole address.
 */

import { describe, expect, it } from "vitest";
import { accountHandle, accountLabel } from "../../../src/lib/nav/account-label";

describe("accountHandle", () => {
  it("keeps the part before the @", () => {
    expect(accountHandle("alex91gul@gmail.com")).toBe("alex91gul");
  });

  it("has nothing to shorten for an absent or address-less value", () => {
    expect(accountHandle(null)).toBe("");
    expect(accountHandle(undefined)).toBe("");
    expect(accountHandle("  ")).toBe("");
    expect(accountHandle("alex")).toBe("alex");
    // Nothing before the `@` names nobody, so it is left whole.
    expect(accountHandle("@example.com")).toBe("@example.com");
  });
});

describe("accountLabel", () => {
  it("prefers the name", () => {
    expect(accountLabel({ name: "Alex Gul", email: "alex91gul@gmail.com" })).toBe("Alex Gul");
  });

  it("never falls back to the full address", () => {
    const label = accountLabel({ name: null, email: "alex91gul@gmail.com" });
    expect(label).toBe("alex91gul");
    expect(label).not.toContain("@");
  });

  it("says someone is signed in when it knows nothing else", () => {
    expect(accountLabel({ name: "  ", email: null })).toBe("Signed in");
  });
});
