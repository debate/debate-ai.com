/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TopicStartersAdminPanel } from "../../../src/components/admin/topic-starters/TopicStartersAdminPanel";
import { bodyText, button, cleanup, clickAsync, flush, installDomShims, mockFetch, mount } from "../../helpers/dom";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ITEMS = [
  { id: 1, title: "Neg", parentId: null, isFolder: true, tags: "[]", published: true },
  { id: 2, title: "Elections DA", parentId: 1, isFolder: false, tags: "[]", published: true },
  { id: 3, title: "Draft K", parentId: null, isFolder: false, tags: "[]", published: false },
];

const CHANGE = {
  id: 7,
  change: { kind: "move", itemId: 2, parentId: null },
  summary: "Move Elections DA to the top level",
  status: "pending",
  submittedBy: "reader@example.com",
  reviewedBy: null,
  error: null,
  createdAt: "2026-10-19T00:00:00.000Z",
};

describe("TopicStartersAdminPanel", () => {
  it("lists pending changes and the public tree, and approves a change", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/admin/topic-starters/changes/7", respond: { change: { ...CHANGE, status: "approved" } } },
      { method: "GET", match: "/api/admin/topic-starters/changes", once: true, respond: { changes: [CHANGE] } },
      { method: "GET", match: "/api/admin/topic-starters/changes", respond: { changes: [] } },
      { method: "GET", match: "/api/admin/topic-starters", respond: { items: ITEMS } },
    ]);
    mount(<TopicStartersAdminPanel />);
    await flush();
    expect(bodyText()).toContain("Move Elections DA to the top level");
    expect(bodyText()).toContain("reader@example.com");
    expect(bodyText()).toContain("Elections DA");
    // Public files only.
    expect(bodyText()).not.toContain("Draft K");
    expect(bodyText()).toContain("(1 file)");

    await clickAsync(button("Approve"));
    await flush();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ decision: "approve" });
    expect(bodyText()).toContain("Nothing is waiting for review.");
  });

  it("shows why an approval failed", async () => {
    mockFetch([
      { method: "POST", match: "/api/admin/topic-starters/changes/7", respond: { error: "That Topic Starter item no longer exists." }, status: 404 },
      { method: "GET", match: "/api/admin/topic-starters/changes", respond: { changes: [CHANGE] } },
      { method: "GET", match: "/api/admin/topic-starters", respond: { items: ITEMS } },
    ]);
    mount(<TopicStartersAdminPanel />);
    await flush();
    await clickAsync(button("Approve"));
    await flush();
    expect(bodyText()).toContain("That Topic Starter item no longer exists.");
  });

  it("shows the sync only when canUpload is set, and reloads the tree after a sync", async () => {
    const { calls } = mockFetch([
      { method: "POST", match: "/api/admin/topic-starters/sync", respond: { job: { id: "tsi_1", caselistSlug: "hspolicy26", caselistLabel: "HS Policy 2026-27", archiveFileName: "hspolicy26-all-2026-11-10.zip", topicCode: "vcx27", year: 2027, published: true, status: "succeeded", found: 1, imported: 1, failed: 0, failures: [], error: null, createdAt: "2026-11-12T00:00:00.000Z", startedAt: null, finishedAt: "2026-11-12T00:00:02.000Z" } } },
      { method: "GET", match: "/api/admin/topic-starters/changes", respond: { changes: [] } },
      { method: "GET", match: "/api/admin/topic-starters", respond: { items: ITEMS } },
    ]);
    mount(<TopicStartersAdminPanel />);
    await flush();
    expect(bodyText()).not.toContain("Sync Topic Starters from openCaselist");
    cleanup();

    mount(<TopicStartersAdminPanel canUpload />);
    await flush();
    expect(bodyText()).toContain("Sync Topic Starters from openCaselist");
    const treeLoads = () => calls.filter((c) => c.method === "GET" && c.url === "/api/admin/topic-starters").length;
    const before = treeLoads();
    await clickAsync(button("Sync from openCaselist"));
    await flush();
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/admin/topic-starters/sync")).toBe(true);
    expect(treeLoads()).toBeGreaterThan(before);
  });
});
