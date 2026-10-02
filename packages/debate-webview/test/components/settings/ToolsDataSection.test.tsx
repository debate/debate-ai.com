import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ToolRecordHydrationResult } from "@debate/data-sync/src/state/tool-record-mirror";

let mockState: {
  enabled: boolean;
  reconciled: boolean;
  results: ToolRecordHydrationResult[];
};

vi.mock("../../../src/lib/hooks/useToolRecordSync", () => ({
  useToolRecordSync: () => mockState,
}));

const { ToolsDataSection } = await import("../../../src/components/settings/ToolsDataSection");

describe("ToolsDataSection", () => {
  it("renders nothing signed out, matching ToolSyncStatusPanel's own signed-out behavior", () => {
    mockState = { enabled: false, reconciled: false, results: [] };
    expect(renderToStaticMarkup(<ToolsDataSection />)).toBe("");
  });

  it("shows a syncing status before the initial reconcile completes", () => {
    mockState = { enabled: true, reconciled: false, results: [] };
    const html = renderToStaticMarkup(<ToolsDataSection />);
    expect(html).toContain("Syncing your saved flows, docs and debates");
  });

  it("shows an all-synced status once reconciled with no failures", () => {
    mockState = { enabled: true, reconciled: true, results: [] };
    const html = renderToStaticMarkup(<ToolsDataSection />);
    expect(html).toContain("All your saved flows, docs and debates are synced to your account.");
  });

  it("counts real sync failures and links to /tools rather than duplicating the retry list", () => {
    mockState = {
      enabled: true,
      reconciled: true,
      results: [
        { collection: "practiceRounds", adopted: 0, pushed: 0, synced: false, error: "network error" },
      ],
    };
    const html = renderToStaticMarkup(<ToolsDataSection />);
    expect(html).toContain("1 tool couldn&#x27;t sync just now.");
    expect(html).toContain('href="/tools"');
    // Does not itself list the failing tool by name — that stays on /tools.
    expect(html).not.toContain("Practice Round Simulator");
  });

  it("drops a stale collection key the current catalog no longer recognizes, same as summarizeToolSyncFailures", () => {
    mockState = {
      enabled: true,
      reconciled: true,
      results: [
        { collection: "notARealCollectionAnymore", adopted: 0, pushed: 0, synced: false, error: "gone" },
      ],
    };
    const html = renderToStaticMarkup(<ToolsDataSection />);
    expect(html).toContain("All your saved flows, docs and debates are synced to your account.");
  });
});
