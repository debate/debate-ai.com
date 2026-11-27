/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { ReferenceSuggestionsPanel } from "../../../src/components/admin/docs/ReferenceSuggestionsPanel";
import { bodyText, button, change, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

beforeAll(installDomShims);
afterEach(cleanup);

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    page: "/docs/journal/synergy-slayer-critiques/references",
    refId: "ref-ackerman-2020",
    title: "Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.”",
    text: "Change comes from power, and power comes from organized people.",
    status: "pending",
    userId: null,
    userName: null,
    createdAt: "2026-11-27T04:00:00.000Z",
    resolvedAt: null,
    resolvedBy: null,
    ...overrides,
  };
}

const COUNTS = { pending: 1, approved: 1, dismissed: 0 };

describe("ReferenceSuggestionsPanel", () => {
  it("lists pending suggestions with the reference, text, sender and counts", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/admin/reference-suggestions", respond: { suggestions: [row()], counts: COUNTS } },
    ]);
    mount(<ReferenceSuggestionsPanel />);
    await flush();

    expect(calls[0]!.url).toBe("/api/admin/reference-suggestions?status=pending");
    const text = bodyText();
    expect(text).toContain("Ackerman, Elliot, et al.");
    expect(text).toContain("ref-ackerman-2020");
    expect(text).toContain("Change comes from power");
    expect(text).toContain("an anonymous guest");
    expect(text).toContain("Pending (1)");
    expect(text).toContain("Approved (1)");
    const link = document.querySelector<HTMLAnchorElement>("li a")!;
    expect(link.getAttribute("href")).toBe("/docs/journal/synergy-slayer-critiques/references#ref-ackerman-2020");
  });

  it("approves, dismisses and deletes, reloading after each", async () => {
    const { calls } = mockFetch([
      { method: "GET", match: "/api/admin/reference-suggestions", respond: { suggestions: [row()], counts: COUNTS } },
      { method: "PATCH", match: "/api/admin/reference-suggestions", respond: { ok: true } },
      { method: "DELETE", match: "/api/admin/reference-suggestions", respond: { ok: true } },
    ]);
    mount(<ReferenceSuggestionsPanel />);
    await flush();

    await clickAsync(button("Approve"));
    expect(calls.find((c) => c.method === "PATCH")!.body).toEqual({ id: "s1", status: "approved" });
    await clickAsync(button("Dismiss"));
    expect(calls.filter((c) => c.method === "PATCH").at(-1)!.body).toEqual({ id: "s1", status: "dismissed" });
    await clickAsync(button("Delete"));
    expect(calls.find((c) => c.method === "DELETE")!.url).toBe("/api/admin/reference-suggestions?id=s1");
    expect(calls.filter((c) => c.method === "GET").length).toBe(4);
  });

  it("switches the status filter and narrows by text", async () => {
    const { calls } = mockFetch([
      {
        method: "GET",
        match: "status=approved",
        respond: { suggestions: [row({ id: "s2", status: "approved", resolvedBy: "admin@x.dev", resolvedAt: "2026-11-27T05:00:00.000Z", refId: "ref-b-2021", title: "Bee, B." })], counts: COUNTS },
      },
      { method: "GET", match: "/api/admin/reference-suggestions", respond: { suggestions: [row()], counts: COUNTS } },
    ]);
    mount(<ReferenceSuggestionsPanel />);
    await flush();
    await clickAsync(button(/^Approved/));
    expect(calls.at(-1)!.url).toBe("/api/admin/reference-suggestions?status=approved");
    expect(bodyText()).toContain("approved by admin@x.dev");
    expect(button("Reopen")).toBeTruthy();

    change(document.querySelector("input[aria-label='Filter suggestions']")!, "zzz");
    expect(bodyText()).toContain("Nothing matches that filter.");
  });

  it("shows the error when the list cannot be loaded", async () => {
    mockFetch([{ method: "GET", match: "/api/admin/reference-suggestions", respond: { error: "Forbidden" }, status: 403 }]);
    mount(<ReferenceSuggestionsPanel />);
    await flush();
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Forbidden");
  });
});
