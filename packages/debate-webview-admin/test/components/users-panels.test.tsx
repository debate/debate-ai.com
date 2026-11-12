/** @vitest-environment jsdom */
/**
 * @fileoverview The Users section: the users table (totals, search debounce,
 * anonymous filter, server-side sorting, paging and a confirmed delete) and
 * the moderators panel (list, invite with its delivery note, remove).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ModeratorsPanel } from "../../src/components/users/ModeratorsPanel";
import { UsersTable } from "../../src/components/users/UsersTable";
import { bodyText, button, change, cleanup, click, flush, installDomShims, mockFetch, mount, submit, toggle } from "../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const DAY = 86_400_000;
function user(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    image: null,
    emailVerified: true,
    isAnonymous: false,
    createdAt: "2026-01-02T00:00:00Z",
    lastActiveAt: new Date(Date.now() - 3 * DAY).toISOString(),
    sessions: 2,
    total: 5,
    docs: 1,
    flows: 0,
    rounds: 4,
    wordCountRounds: 0,
    judgeDecisions: 0,
    speeches: 0,
    practiceRounds: 0,
    drills: 0,
    videosWatched: 1200,
    ...overrides,
  };
}

function usersPage(users: unknown[], overrides: Record<string, unknown> = {}) {
  return { users, page: 1, limit: 25, pageCount: 2, matchedUsers: 30, totals: { users: 30, sessions: 70, activity: 1500 }, ...overrides };
}

describe("UsersTable", () => {
  it("shows totals and each account's usage and activity", async () => {
    mockFetch([
      {
        match: "/api/admin/users?",
        respond: usersPage([
          user("a"),
          user("b", { name: "", isAnonymous: true, lastActiveAt: null, image: "https://img.example/b.png" }),
          user("c", { emailVerified: false, lastActiveAt: new Date().toISOString() }),
          user("d", { lastActiveAt: new Date(Date.now() - DAY).toISOString(), createdAt: "garbage" }),
          user("e", { lastActiveAt: new Date(Date.now() - 60 * DAY).toISOString() }),
          user("f", { lastActiveAt: new Date(Date.now() - 800 * DAY).toISOString() }),
          user("g", { lastActiveAt: "nope" }),
        ]),
      },
    ]);
    mount(<UsersTable />);
    await flush();
    expect(bodyText()).toContain("1,500Saved items");
    expect(bodyText()).toContain("30 matching");
    expect(bodyText()).toContain("1,200");
    expect(bodyText()).toContain("anon");
    expect(bodyText()).toContain("unverified");
    for (const label of ["3d ago", "never", "today", "yesterday", "2mo ago", "2y ago"]) expect(bodyText()).toContain(label);
    expect(document.querySelector('img[src="https://img.example/b.png"]')).not.toBeNull();
    expect(bodyText()).toContain("Page 1 of 2");
  });

  it("sorts by a column, flipping on a second click", async () => {
    const { calls } = mockFetch([{ match: "/api/admin/users?", respond: usersPage([user("a")]) }]);
    mount(<UsersTable />);
    await flush();
    click(button("Videos"));
    await flush();
    expect(calls.at(-1)!.url).toContain("sort=videosWatched&dir=desc");
    expect(bodyText()).toContain("Videos ↓");
    click(button("Videos ↓"));
    await flush();
    expect(calls.at(-1)!.url).toContain("sort=videosWatched&dir=asc");
    click(button("User"));
    await flush();
    expect(calls.at(-1)!.url).toContain("sort=name&dir=asc");
  });

  it("debounces search, filters anonymous accounts and pages", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = mockFetch([{ match: "/api/admin/users?", respond: usersPage([user("a")]) }]);
    mount(<UsersTable />);
    await flush();
    change(document.querySelector('input[placeholder="Search name or email…"]')!, "  ada ");
    await vi.advanceTimersByTimeAsync(350);
    await flush();
    expect(calls.at(-1)!.url).toContain("q=ada");

    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    await flush();
    expect(calls.at(-1)!.url).toContain("hideAnonymous=true");

    click(button("Next"));
    await flush();
    expect(calls.at(-1)!.url).toContain("page=2");
    click(button("Previous"));
    await flush();
    expect(calls.at(-1)!.url).toContain("page=1");
    click(button("Refresh"));
    await flush();
  });

  it("deletes an account only after confirming", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const { calls } = mockFetch([
      { method: "DELETE", match: "/api/admin/users/a", respond: { ok: true }, once: true },
      { method: "DELETE", match: "/api/admin/users/", respond: { error: "x", details: "Has open rounds" }, status: 409 },
      { match: "/api/admin/users?", respond: usersPage([user("a"), user("b", { total: 1, email: "" })]) },
    ]);
    mount(<UsersTable />);
    await flush();
    const deletes = () => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Delete");
    click(deletes()[0]);
    expect(confirm).toHaveBeenCalledWith("Permanently delete a@example.com and 5 saved items? This cannot be undone.");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    click(deletes()[0]);
    await flush();
    expect(bodyText()).toContain("Deleted a@example.com.");
    click(deletes()[1]);
    await flush();
    expect(confirm).toHaveBeenLastCalledWith("Permanently delete User b and 1 saved item? This cannot be undone.");
    expect(bodyText()).toContain("Has open rounds");
  });

  it("shows a load error and the empty state", async () => {
    mockFetch([{ match: "/api/admin/users?", respond: { error: "Forbidden" }, status: 403 }]);
    mount(<UsersTable />);
    await flush();
    expect(bodyText()).toContain("Forbidden");
    expect(bodyText()).toContain("No users match this filter.");
  });
});

describe("ModeratorsPanel", () => {

  it("lists admins and moderators, invites and removes", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/admin/moderators", respond: { email: "new@example.com", delivery: "emailed" }, once: true },
      { method: "POST", match: "/api/admin/moderators", respond: { error: "Already a moderator" }, status: 409 },
      { method: "DELETE", match: "/api/admin/moderators?email=", respond: { ok: true }, once: true },
      { method: "DELETE", match: "/api/admin/moderators?email=", respond: {}, status: 500 },
      {
        match: "/api/admin/moderators",
        respond: { admins: ["boss@example.com"], moderators: [{ email: "mod@example.com", role: "moderator", invitedBy: "boss@example.com", createdAt: null }] },
      },
    ]);
    mount(<ModeratorsPanel />);
    expect(bodyText()).toContain("Loading…");
    await flush();
    expect(bodyText()).toContain("boss@example.com");
    expect(bodyText()).toContain("invited by boss@example.com");

    expect(button("Invite moderator").disabled).toBe(true);
    change(document.querySelector('input[type="email"]')!, " new@example.com ");
    submit(document.querySelector("form")!);
    await flush();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ email: "new@example.com" });
    expect(bodyText()).toContain("new@example.com is now a moderator — they were emailed an invite.");

    change(document.querySelector('input[type="email"]')!, "mod@example.com");
    submit(document.querySelector("form")!);
    await flush();
    expect(bodyText()).toContain("Already a moderator");

    click(button("Remove"));
    await flush();
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("email=mod%40example.com"))).toBe(true);
    expect(bodyText()).toContain("mod@example.com is no longer a moderator.");
    click(button("Remove"));
    await flush();
    expect(bodyText()).toContain("Remove failed");
  });

  it("ignores a blank invite and shows load failures", async () => {
    const { calls } = mockFetch([{ match: "/api/admin/moderators", respond: { details: "D1 down" }, status: 500 }]);
    mount(<ModeratorsPanel />);
    await flush();
    expect(bodyText()).toContain("D1 down");
    submit(document.querySelector("form")!);
    await flush();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("shows the empty list", async () => {
    mockFetch([{ match: "/api/admin/moderators", respond: { admins: [], moderators: [] } }]);
    mount(<ModeratorsPanel />);
    await flush();
    expect(bodyText()).toContain("No moderators yet.");
  });
});
