/** @vitest-environment jsdom */
/**
 * @fileoverview The judge-paradigm sync panel: the cache status badges,
 * the discover and refresh batch loops (stopping when the walk finishes,
 * after idle batches, on a batch error, or on Stop), and verifying or
 * revoking a judge claim.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { JudgeParadigmSyncPanel } from "../../src/components/data/JudgeParadigmSyncPanel";
import { bodyText, button, cleanup, click, flush, installDomShims, mockFetch, mount, type Route } from "../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const status = (overrides: Record<string, unknown> = {}) => ({
  credentialsConfigured: true,
  cached: 1200,
  withParadigm: 900,
  failed: 3,
  stale: 40,
  discoveryOffset: 500,
  discoveryDone: false,
  lastRunAt: "2026-11-01T00:00:00Z",
  lastError: "Tabroom 503",
  claims: [
    { userId: "u1", userName: "Ada", userEmail: "ada@example.com", tabroomPersonId: 42, tabroomName: "Ada L", verified: false },
    { userId: "u2", userName: "Bo", userEmail: "bo@example.com", tabroomPersonId: 7, tabroomName: null, verified: true },
  ],
  ...overrides,
});

const batch = (overrides: Record<string, unknown> = {}) => ({ mode: "discover", fetched: 50, saved: 50, failed: 0, nextOffset: 550, remaining: 0, error: null, ...overrides });

async function render(routes: Route[], s = status()) {
  const mock = mockFetch([...routes, { method: "GET", match: "/api/admin/judge-paradigms", respond: s }]);
  mount(<JudgeParadigmSyncPanel />);
  await flush();
  return mock;
}

describe("JudgeParadigmSyncPanel", () => {
  it("shows the cache status and claims", async () => {
    await render([]);
    for (const text of ["Tabroom session set", "1,200 judges cached", "900 with a paradigm", "40 older than a week", "3 failed", "Discovery at offset 500", "— Tabroom 503", "Waiting", "Verified", "#7"]) {
      expect(bodyText()).toContain(text);
    }
    expect(document.querySelector('a[href$="judge_person_id=42"]')!.textContent).toBe("Ada L");
  });

  it("disables syncing without a Tabroom session", async () => {
    await render([], status({ credentialsConfigured: false, failed: 0, discoveryDone: true, lastRunAt: null, claims: [] }));
    expect(bodyText()).toContain("No Tabroom session");
    expect(bodyText()).toContain("Discovery complete");
    expect(button("Discover & sync all paradigms").disabled).toBe(true);
  });

  it("walks discovery until the last page", async () => {
    const { calls } = await render([
      { method: "POST", match: "judge-paradigms", respond: batch(), once: true },
      { method: "POST", match: "judge-paradigms", respond: batch({ nextOffset: null, saved: 10 }) },
    ]);
    click(button("Discover & sync all paradigms"));
    await flush(10);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(2);
    expect(bodyText()).toContain("Fetched 50, saved 10, failed 0 — walk complete");
    expect(bodyText()).toContain("next offset 550");
  });

  it("stops a refresh after three idle batches", async () => {
    const { calls } = await render([{ method: "POST", match: "judge-paradigms", respond: batch({ mode: "refresh", saved: 0, remaining: 30 }) }]);
    click(button("Refresh stale"));
    await flush(15);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(3);
    expect(bodyText()).toContain("30 stale left");
  });

  it("finishes a refresh when nothing stale remains", async () => {
    const { calls } = await render([{ method: "POST", match: "judge-paradigms", respond: batch({ mode: "refresh", remaining: 0 }) }]);
    click(button("Refresh stale"));
    await flush(10);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("stops on a batch that saved nothing with an error, or a failed request", async () => {
    await render([
      { method: "POST", match: "judge-paradigms", respond: batch({ saved: 0, error: "Login expired" }), once: true },
      { method: "POST", match: "judge-paradigms", respond: { error: "Batch blew up" }, status: 500 },
    ]);
    click(button("Discover & sync all paradigms"));
    await flush(10);
    expect(document.querySelector("[role=alert]")!.textContent).toBe("Login expired");
    click(button("Refresh stale"));
    await flush(10);
    expect(document.querySelector("[role=alert]")!.textContent).toBe("Batch blew up");
  });

  it("stops between batches when asked", async () => {
    let release: () => void = () => {};
    const { calls } = await render([
      { method: "POST", match: "judge-paradigms", respond: () => new Promise((r) => (release = () => r(batch()))) },
    ]);
    click(button("Discover & sync all paradigms"));
    await flush();
    click(button("Stop"));
    release();
    await flush(10);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(() => button("Stop")).toThrow();
  });

  it("verifies and revokes claims, surfacing a failed update", async () => {
    const { calls } = await render([
      { method: "PATCH", match: "judge-paradigms", respond: { ok: true }, once: true },
      { method: "PATCH", match: "judge-paradigms", respond: { error: "No such claim" }, status: 404 },
    ]);
    click(button("Verify"));
    await flush();
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ userId: "u1", verified: true });
    click(button("Revoke"));
    await flush();
    expect(document.querySelector("[role=alert]")!.textContent).toBe("No such claim");
  });

  it("shows a status load failure", async () => {
    mockFetch([{ match: "judge-paradigms", respond: {}, status: 500 }]);
    mount(<JudgeParadigmSyncPanel />);
    await flush();
    expect(bodyText()).toContain("Failed to load paradigm sync status");
  });
});
