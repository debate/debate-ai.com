import { describe, expect, it } from "vitest";
import { describeSignInError } from "../sign-in-errors";

describe("describeSignInError", () => {
  it("says nothing when there is no error on the URL", () => {
    expect(describeSignInError(null)).toBeNull();
    expect(describeSignInError(undefined)).toBeNull();
    expect(describeSignInError("")).toBeNull();
  });

  it("explains the state failures as the expiry they usually are", () => {
    expect(describeSignInError("state_mismatch")).toMatch(/expired or was already used/i);
    expect(describeSignInError("state_expired")).toMatch(/expired/i);
    expect(describeSignInError("state_not_found")).toMatch(/expired or was already used/i);
  });

  /** The code comes off the query string, so it is never echoed back. */
  it("falls back to generic wording for an unknown code", () => {
    const message = describeSignInError("<img src=x onerror=alert(1)>");
    expect(message).toBe("Sign-in did not complete. Please try again.");
    expect(message).not.toContain("<img");
  });
});
