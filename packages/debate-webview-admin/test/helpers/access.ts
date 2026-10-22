/**
 * @fileoverview Who the admin routes see as signed in, and which database they
 * read. Each test file registers the two mocks below with these shared values:
 *
 *   vi.mock("@/lib/auth/session", () => sessionMock);
 *   vi.mock("@/lib/database/context", () => contextMock);
 *
 * `lib/auth/admin.ts` itself stays real, so the admin allowlist (ADMIN_EMAILS)
 * and the moderator grants in `staff_roles` decide access exactly as they do
 * in production.
 */
export const ADMIN = "admin@example.com";
export const MODERATOR = "mod@example.com";

export const access: { email: string | null; db: unknown } = { email: null, db: null };

export const sessionMock = {
  getSession: async () => (access.email ? { user: { email: access.email } } : null),
};

export const contextMock = {
  getDBFromContext: async () => access.db,
};
