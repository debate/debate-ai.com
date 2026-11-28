/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetAdminUserCountCache,
  USER_COUNT_TTL_MS,
  useAdminUserCount,
} from "../../../src/lib/admin/use-admin-user-count";
import { cleanup, flush, mockFetch, mount } from "../../helpers/dom";

function Probe({ enabled = true }: { enabled?: boolean }) {
  const count = useAdminUserCount(enabled);
  return <span data-testid="count">{count === null ? "none" : count}</span>;
}
const shown = () => document.querySelector("[data-testid='count']")!.textContent;
const overview = (users: unknown) => ({
  method: "GET",
  match: "/api/admin/overview",
  respond: { stats: { users } },
});

beforeEach(() => resetAdminUserCountCache());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAdminUserCount", () => {
  it("reads stats.users from the admin overview endpoint", async () => {
    const { calls } = mockFetch([overview(49)]);
    mount(<Probe />);
    await flush();
    expect(shown()).toBe("49");
    expect(calls.map((c) => c.url)).toEqual(["/api/admin/overview"]);
  });

  it("does not fetch when disabled", async () => {
    const { calls } = mockFetch([overview(49)]);
    mount(<Probe enabled={false} />);
    await flush();
    expect(shown()).toBe("none");
    expect(calls).toHaveLength(0);
  });

  it("shares one request between simultaneous callers and reuses the answer within the TTL", async () => {
    const { calls } = mockFetch([overview(49)]);
    mount(
      <>
        <Probe />
        <Probe />
      </>,
    );
    await flush();
    expect(calls).toHaveLength(1);

    mount(<Probe />);
    await flush();
    expect(calls).toHaveLength(1);
    expect(document.querySelectorAll("[data-testid='count']")[2]!.textContent).toBe("49");
  });

  it("asks again once the cached count is older than the TTL", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { calls } = mockFetch([overview(49)]);
    mount(<Probe />);
    await flush();
    vi.setSystemTime(Date.now() + USER_COUNT_TTL_MS + 1);
    mount(<Probe />);
    await flush();
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["an error status", { method: "GET", match: "/api/admin/overview", respond: {}, status: 403 }],
    ["a non-numeric count", overview("49")],
    ["a negative count", overview(-1)],
  ])("returns null for %s", async (_name, route) => {
    mockFetch([route]);
    mount(<Probe />);
    await flush();
    expect(shown()).toBe("none");
  });
});
