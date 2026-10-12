/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ModeratorsPanel } from "../../../src/components/admin/ModeratorsPanel";
import { UsersTable } from "../../../src/components/admin/UsersTable";
import {
  bodyText,
  button,
  change,
  cleanup,
  clickAsync,
  flush,
  installDomShims,
  mockFetch,
  mount,
  submit,
  toggle,
} from "../../helpers/dom";

beforeAll(installDomShims);

/** The search box's 300ms debounce resets the page once after mount; let it fire. */
const settleSearchDebounce = () => new Promise((resolve) => setTimeout(resolve, 350)).then(() => flush());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY - 3_600_000).toISOString();

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    image: null,
    emailVerified: true,
    isAnonymous: false,
    createdAt: "2024-03-05T12:00:00.000Z",
    lastActiveAt: ago(3),
    sessions: 4,
    total: 12,
    docs: 2,
    flows: 0,
    rounds: 3,
    wordCountRounds: 0,
    judgeDecisions: 1,
    speeches: 0,
    practiceRounds: 6,
    drills: 0,
    videosWatched: 8,
    ...overrides,
  };
}

function usersBody(users: unknown[], extra: Record<string, unknown> = {}) {
  return {
    users,
    page: 1,
    limit: 25,
    pageCount: 2,
    matchedUsers: users.length,
    totals: { users: 1234, sessions: 50, activity: 99, docs: 7 },
    ...extra,
  };
}

describe("UsersTable", () => {
  it("loads the first page and renders tiles, badges and relative activity", async () => {
    const { calls } = mockFetch([
      {
        match: "/api/admin/users?",
        respond: usersBody([
          user(),
          user({ id: "u2", name: "", email: "anon@x.dev", isAnonymous: true, lastActiveAt: null, total: 0, sessions: 0 }),
          user({ id: "u3", name: "Bob", email: "bob@x.dev", emailVerified: false, lastActiveAt: ago(1), image: "https://img/bob.png" }),
          user({ id: "u4", name: "Cy", email: "cy@x.dev", lastActiveAt: ago(45) }),
          user({ id: "u5", name: "Di", email: "di@x.dev", lastActiveAt: ago(800) }),
          user({ id: "u6", name: "Ed", email: "ed@x.dev", lastActiveAt: new Date(Date.now() - 60_000).toISOString() }),
          user({ id: "u7", name: "Fy", email: "fy@x.dev", lastActiveAt: "not-a-date", createdAt: "bogus" }),
        ]),
      },
    ]);
    mount(<UsersTable />);
    expect(bodyText()).toContain("Loading users…");
    await flush();

    expect(calls[0].url).toBe("/api/admin/users?page=1&limit=25&sort=joined&dir=desc");
    const text = bodyText();
    expect(text).toContain((1234).toLocaleString());
    expect(text).toContain("7 matching");
    expect(text).toContain("anon");
    expect(text).toContain("unverified");
    expect(text).toContain("3d ago");
    expect(text).toContain("never");
    expect(text).toContain("yesterday");
    expect(text).toContain("1mo ago");
    expect(text).toContain("2y ago");
    expect(text).toContain("today");
    expect(text).toContain("Page 1 of 2");
    expect(document.querySelector("img[src='https://img/bob.png']")).not.toBeNull();
    // The initial-letter avatar for a user without a picture.
    expect(text).toContain("A");
  });

  it("toggles sort direction, filters anonymous and pages", async () => {
    const { calls } = mockFetch([{ match: "/api/admin/users?", respond: usersBody([user()]) }]);
    mount(<UsersTable />);
    await flush();
    await settleSearchDebounce();

    await clickAsync(button("User"));
    expect(calls.at(-1)!.url).toContain("sort=name&dir=asc");
    expect(button(/User ↑/)).toBeTruthy();

    await clickAsync(button(/User/));
    expect(calls.at(-1)!.url).toContain("sort=name&dir=desc");

    await clickAsync(button("Docs"));
    expect(calls.at(-1)!.url).toContain("sort=docs&dir=desc");

    toggle(document.querySelector<HTMLInputElement>("input[type=checkbox]")!);
    await flush();
    expect(calls.at(-1)!.url).toContain("hideAnonymous=true");

    await clickAsync(button("Next"));
    expect(calls.at(-1)!.url).toContain("page=2");
    await clickAsync(button("Previous"));
    expect(calls.at(-1)!.url).toContain("page=1");

    const before = calls.length;
    await clickAsync(button("Refresh"));
    expect(calls.length).toBe(before + 1);
  });

  it("debounces the search box into the q parameter", async () => {
    const { calls } = mockFetch([{ match: "/api/admin/users?", respond: usersBody([]) }]);
    mount(<UsersTable />);
    await flush();
    expect(bodyText()).toContain("No users match this filter.");

    change(document.querySelector("input[placeholder='Search name or email…']")!, "  ada ");
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes("q=ada"))).toBe(true));
  });

  it("shows the API error", async () => {
    mockFetch([{ match: "/api/admin/users?", respond: { error: "Forbidden" }, status: 403 }]);
    mount(<UsersTable />);
    await flush();
    expect(bodyText()).toContain("Forbidden");
  });

  it("deletes a user after confirmation and reloads", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { calls } = mockFetch([
      { method: "DELETE", match: "/api/admin/users/u%201", respond: { ok: true } },
      { match: "/api/admin/users?", respond: usersBody([user({ id: "u 1", total: 1 })]) },
    ]);
    mount(<UsersTable />);
    await flush();

    await clickAsync(button("Delete"));
    expect(confirm).toHaveBeenCalledWith(
      "Permanently delete ada@example.com and 1 saved item? This cannot be undone.",
    );
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(bodyText()).toContain("Deleted ada@example.com.");
  });

  it("does nothing when the deletion is cancelled and surfaces delete failures", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { calls } = mockFetch([
      { method: "DELETE", match: "/api/admin/users/", respond: { details: "FK violation" }, status: 500 },
      { match: "/api/admin/users?", respond: usersBody([user({ total: 5000 })]) },
    ]);
    mount(<UsersTable />);
    await flush();

    await clickAsync(button("Delete"));
    expect(confirm.mock.calls[0][0]).toContain(`${(5000).toLocaleString()} saved items`);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    confirm.mockReturnValue(true);
    await clickAsync(button("Delete"));
    expect(bodyText()).toContain("FK violation");
  });
});

describe("ModeratorsPanel", () => {
  const listBody = {
    admins: ["boss@example.com"],
    moderators: [{ email: "mod@example.com", role: "moderator", invitedBy: "boss@example.com", createdAt: null }],
  };

  it("lists admins and moderators", async () => {
    mockFetch([{ match: "/api/admin/moderators", respond: listBody }]);
    mount(<ModeratorsPanel />);
    expect(bodyText()).toContain("Loading…");
    await flush();
    const text = bodyText();
    expect(text).toContain("boss@example.com");
    expect(text).toContain("mod@example.com");
    expect(text).toContain("invited by boss@example.com");
  });

  it("shows the empty state and load errors", async () => {
    mockFetch([{ match: "/api/admin/moderators", respond: { admins: [], moderators: [] } }]);
    mount(<ModeratorsPanel />);
    await flush();
    expect(bodyText()).toContain("No moderators yet.");
    cleanup();

    mockFetch([{ match: "/api/admin/moderators", respond: { error: "nope" }, status: 500 }]);
    mount(<ModeratorsPanel />);
    await flush();
    expect(bodyText()).toContain("nope");
  });

  it("invites a moderator and reports how they were told", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/admin/moderators", respond: { email: "new@example.com", delivery: "emailed" } },
      { match: "/api/admin/moderators", respond: listBody },
    ]);
    mount(<ModeratorsPanel />);
    await flush();

    const input = document.querySelector<HTMLInputElement>("input[type=email]")!;
    change(input, " new@example.com ");
    submit(document.querySelector("form")!);
    await flush();

    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ email: "new@example.com" });
    expect(bodyText()).toContain("new@example.com is now a moderator — they were emailed an invite.");
    expect(input.value).toBe("");
  });

  it("ignores a blank invite and surfaces invite errors", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/admin/moderators", respond: { error: "Invalid email" }, status: 400 },
      { match: "/api/admin/moderators", respond: listBody },
    ]);
    mount(<ModeratorsPanel />);
    await flush();
    submit(document.querySelector("form")!);
    await flush();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    change(document.querySelector("input[type=email]")!, "bad");
    submit(document.querySelector("form")!);
    await flush();
    expect(bodyText()).toContain("Invalid email");
  });

  it("removes a moderator", async () => {
    const { calls } = mockFetch([
      { method: "DELETE", match: "/api/admin/moderators?email=mod%40example.com", respond: { ok: true } },
      { match: "/api/admin/moderators", respond: listBody },
    ]);
    mount(<ModeratorsPanel />);
    await flush();
    await clickAsync(button("Remove"));
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(bodyText()).toContain("mod@example.com is no longer a moderator.");
  });

  it("reports a failed removal", async () => {
    mockFetch([
      { method: "DELETE", match: "/api/admin/moderators", respond: { details: "Cannot remove" }, status: 500 },
      { match: "/api/admin/moderators", respond: listBody },
    ]);
    mount(<ModeratorsPanel />);
    await flush();
    await clickAsync(button("Remove"));
    expect(bodyText()).toContain("Cannot remove");
  });
});
