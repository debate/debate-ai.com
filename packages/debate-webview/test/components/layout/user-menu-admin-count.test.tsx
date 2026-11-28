/** @vitest-environment jsdom */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/videos",
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("../../../src/lib/hooks/useSession", () => ({
  useSession: () => ({ user: { id: "u1", name: "Ada", email: "ada@example.com" }, isAuthenticated: true, isLoading: false }),
}));
vi.mock("../../../src/lib/auth/use-sign-out", () => ({ useSignOut: () => vi.fn() }));
vi.mock("../../../src/components/layout/command-palette/GlobalCommandPalette", () => ({
  openGlobalCommandPalette: vi.fn(),
}));

import { SettingsMenu } from "../../../src/components/layout/CategoryDock";
import { resetAdminUserCountCache } from "../../../src/lib/admin/use-admin-user-count";
import { DropdownMenu, DropdownMenuTrigger } from "../../../src/ui/primitives/dropdown-menu";
import { cleanup, flush, installDomShims, mockFetch, mount, type Route } from "../../helpers/dom";

beforeAll(() => installDomShims());
beforeEach(() => resetAdminUserCountCache());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openMenu() {
  mount(
    <DropdownMenu open>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <SettingsMenu side="bottom" onSignIn={() => {}} />
    </DropdownMenu>,
  );
}

const adminItem = () =>
  [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].find((el) => el.textContent?.startsWith("Admin"));

const adminMe: Route = {
  method: "GET",
  match: "/api/admin/me",
  respond: { role: "admin", isAdmin: true, isModerator: false, canEditContent: true },
};
const overview = (users: number): Route => ({
  method: "GET",
  match: "/api/admin/overview",
  respond: { stats: { users, sessions: 1, files: 2, publishedVideos: 3, stagedVideos: 4 }, recentUsers: [] },
});

describe("user menu Admin row", () => {
  it("shows the total user count as a badge next to Admin for an admin", async () => {
    const { calls } = mockFetch([adminMe, overview(1249)]);
    openMenu();
    await flush();

    const item = adminItem()!;
    expect(item).toBeTruthy();
    expect(item.textContent).toBe("Admin1,249");
    expect(item.querySelector("[data-testid='user-count-badge']")?.textContent).toBe("1,249");
    expect(calls.filter((c) => c.url.includes("/api/admin/overview"))).toHaveLength(1);
  });

  it("shows no badge, and asks for no count, for a moderator", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/admin/me", respond: { role: "moderator", isAdmin: false, isModerator: true, canEditContent: true } },
      overview(49),
    ]);
    openMenu();
    await flush();

    expect(adminItem()?.textContent).toBe("Admin");
    expect(calls.some((c) => c.url.includes("/api/admin/overview"))).toBe(false);
  });

  it("shows no Admin row at all for a regular user", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/me", respond: { role: null, isAdmin: false, isModerator: false, canEditContent: false } }, overview(49)]);
    openMenu();
    await flush();

    expect(adminItem()).toBeUndefined();
  });

  it("leaves the Admin row without a badge when the count request fails", async () => {
    mockFetch([adminMe, { method: "GET", match: "/api/admin/overview", respond: { error: "boom" }, status: 500 }]);
    openMenu();
    await flush();

    expect(adminItem()?.textContent).toBe("Admin");
    expect(document.querySelector("[data-testid='user-count-badge']")).toBeNull();
  });

  it("leaves the Admin row without a badge when the count request throws", async () => {
    mockFetch([adminMe]);
    const base = globalThis.fetch;
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("/api/admin/overview") ? Promise.reject(new Error("offline")) : base(input, init),
    ) as unknown as typeof fetch;
    openMenu();
    await flush();

    expect(adminItem()?.textContent).toBe("Admin");
  });
});
