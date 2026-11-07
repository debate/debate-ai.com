import { describe, expect, it } from "vitest";
import {
  ALLOWED_ADMIN_PLUGIN_PATHS,
  IMPERSONATION_SESSION_SECONDS,
  checkImpersonation,
} from "../impersonation";

const ADMINS = ["boss@example.com", "other-admin@example.com"];
const admin = { id: "a1", email: "Boss@Example.com" };
const member = { id: "u1", email: "ada@example.com" };

describe("checkImpersonation", () => {
  it("lets an allowlisted admin impersonate a regular user", () => {
    expect(checkImpersonation(admin, member, ADMINS)).toBeNull();
  });

  it("refuses a signed-out caller", () => {
    expect(checkImpersonation(null, member, ADMINS)?.status).toBe("UNAUTHORIZED");
  });

  it("refuses a caller who is not on the admin allowlist", () => {
    expect(checkImpersonation({ id: "u2", email: "mod@example.com" }, member, ADMINS)).toMatchObject({
      status: "FORBIDDEN",
    });
  });

  it("refuses impersonating another admin", () => {
    expect(checkImpersonation(admin, { id: "a2", email: "other-admin@example.com" }, ADMINS)).toMatchObject({
      status: "FORBIDDEN",
      message: expect.stringMatching(/other admins/),
    });
  });

  it("refuses starting a second impersonation from an impersonated session", () => {
    expect(checkImpersonation({ ...admin, impersonatedBy: "a0" }, member, ADMINS)?.status).toBe("FORBIDDEN");
  });

  it("refuses a missing target and the caller's own account", () => {
    expect(checkImpersonation(admin, null, ADMINS)?.status).toBe("NOT_FOUND");
    expect(checkImpersonation(admin, admin, ADMINS)?.status).toBe("BAD_REQUEST");
  });
});

describe("admin plugin configuration", () => {
  it("exposes only the impersonation endpoints", () => {
    expect([...ALLOWED_ADMIN_PLUGIN_PATHS].sort()).toEqual([
      "/admin/impersonate-user",
      "/admin/stop-impersonating",
    ]);
  });

  it("caps an impersonated session at 30 minutes", () => {
    expect(IMPERSONATION_SESSION_SECONDS).toBe(1800);
  });
});
