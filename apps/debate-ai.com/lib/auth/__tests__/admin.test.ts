import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sessionEmail, moderatorRows } = vi.hoisted(() => ({
  sessionEmail: { value: null as string | null },
  moderatorRows: { value: [] as Array<{ role: string }> },
}));

vi.mock("../session", () => ({
  getSession: async () =>
    sessionEmail.value ? { user: { email: sessionEmail.value } } : null,
}));

vi.mock("../../database/context", () => ({
  getCloudflareContext: () => undefined,
  getDBFromContext: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => moderatorRows.value }) }),
    }),
  }),
}));

import { getAdminAccess, getAdminEmails, getStaffAccess, isAdminEmail, parseEmailList } from "../admin";

beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAIL;
  sessionEmail.value = null;
  moderatorRows.value = [];
});

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAIL;
});

describe("parseEmailList", () => {
  it("splits on commas and whitespace, lowercases and drops empties", () => {
    expect(parseEmailList(" A@x.com, ,b@y.com  c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
  });

  it("treats unset as empty", () => {
    expect(parseEmailList(undefined)).toEqual([]);
  });
});

describe("getAdminEmails", () => {
  it("merges ADMIN_EMAILS and ADMIN_EMAIL without duplicates", () => {
    process.env.ADMIN_EMAILS = "a@x.com,b@x.com";
    process.env.ADMIN_EMAIL = "B@x.com";
    expect(getAdminEmails()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("accepts ADMIN_EMAIL alone", () => {
    process.env.ADMIN_EMAIL = "solo@x.com";
    expect(getAdminEmails()).toEqual(["solo@x.com"]);
  });
});

describe("isAdminEmail", () => {
  it("never matches when no allowlist is configured", () => {
    expect(isAdminEmail("anyone@x.com")).toBe(false);
  });

  it("matches case-insensitively", () => {
    process.env.ADMIN_EMAIL = "boss@x.com";
    expect(isAdminEmail("Boss@X.com")).toBe(true);
    expect(isAdminEmail(null)).toBe(false);
  });
});

describe("getAdminAccess", () => {
  it("denies every signed-in user when the allowlist is unset", async () => {
    sessionEmail.value = "user@x.com";
    expect(await getAdminAccess()).toEqual({ isAdmin: false, email: "user@x.com" });
  });

  it("grants listed emails", async () => {
    process.env.ADMIN_EMAILS = "user@x.com";
    sessionEmail.value = "user@x.com";
    expect((await getAdminAccess()).isAdmin).toBe(true);
  });
});

describe("getStaffAccess", () => {
  it("gives admins content-editing rights", async () => {
    process.env.ADMIN_EMAIL = "boss@x.com";
    sessionEmail.value = "boss@x.com";
    expect(await getStaffAccess()).toMatchObject({ role: "admin", isAdmin: true, canEditContent: true });
  });

  it("gives invited moderators content-editing rights but not admin", async () => {
    process.env.ADMIN_EMAIL = "boss@x.com";
    sessionEmail.value = "mod@x.com";
    moderatorRows.value = [{ role: "moderator" }];
    expect(await getStaffAccess()).toMatchObject({
      role: "moderator",
      isAdmin: false,
      isModerator: true,
      canEditContent: true,
    });
  });

  it("gives everyone else nothing", async () => {
    sessionEmail.value = "user@x.com";
    expect(await getStaffAccess()).toMatchObject({ role: null, canEditContent: false });
  });

  it("gives signed-out viewers nothing", async () => {
    expect(await getStaffAccess()).toMatchObject({ role: null, email: null, canEditContent: false });
  });
});
