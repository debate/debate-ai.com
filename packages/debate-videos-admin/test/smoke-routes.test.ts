import { describe, it, expect, vi, beforeEach } from "vitest";
import { access } from "./helpers/access";
import { freshDb } from "./helpers/db";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/access")).sessionMock);
vi.mock("@/lib/database/context", async () => ({
  ...(await import("./helpers/access")).contextMock,
}));

const queued = await import("../src/api/admin/youtube/videos/[id]");

describe("route imports", () => {
  beforeEach(async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    access.db = await freshDb();
    access.email = "admin@example.com";
  });
  it("imports the module", () => {
    expect(queued).toBeDefined();
  });
});
