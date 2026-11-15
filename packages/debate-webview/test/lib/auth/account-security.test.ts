/**
 * @fileoverview Helpers behind Settings → Debate Account and the 2FA code
 * page: the same-site callback guard, reading the TOTP secret for manual
 * entry, and turning better-auth errors into sentences.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("../../../src/lib/auth/client", () => ({ authClient: {} }))
vi.mock("../../../src/host/config", () => ({ getHostConfig: () => ({}) }))

import { safeCallbackURL } from "../../../src/lib/auth/safe-callback"
import { describeAuthError, totpSecretOf } from "../../../src/components/settings/sections/AccountSecuritySection"

describe("safeCallbackURL", () => {
  it.each([
    ["/practice?x=1", "/practice?x=1"],
    ["/", "/"],
    [null, "/"],
    ["", "/"],
    ["https://evil.com", "/"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["javascript:alert(1)", "/"],
  ])("%s → %s", (input, expected) => expect(safeCallbackURL(input)).toBe(expected))
})

describe("totpSecretOf", () => {
  it("reads the secret from an otpauth URI", () => {
    expect(totpSecretOf("otpauth://totp/Debate%20AI:a%40b.com?secret=JBSWY3DPEHPK3PXP&issuer=Debate%20AI")).toBe(
      "JBSWY3DPEHPK3PXP",
    )
    expect(totpSecretOf("not a uri")).toBeNull()
  })
})

describe("describeAuthError", () => {
  it("asks for a fresh sign-in when the session is too old", () => {
    expect(describeAuthError({ code: "SESSION_NOT_FRESH", message: "Session is not fresh" }, "x")).toMatch(/sign back in/)
  })
  it("falls back to the server message, then the fallback", () => {
    expect(describeAuthError({ message: "Nope" }, "x")).toBe("Nope")
    expect(describeAuthError(null, "Fallback")).toBe("Fallback")
  })
})
