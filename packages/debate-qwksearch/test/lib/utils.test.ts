/** @vitest-environment jsdom */
/**
 * @fileoverview The package's small shared helpers: class merging, relative
 * time labels, chat-history flattening, cosine similarity and the URL-state
 * sync used by the workspace.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { cn, computeSimilarity, formatChatHistoryAsString, formatTimeDifference } from "../../src/components/lib/utils";
import { cn as uiCn, setStateInURL } from "../../src/ui/lib/utils";

describe("components/lib/utils", () => {
  it("merges tailwind classes, later ones winning", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4");
    expect(uiCn("text-sm", ["font-bold"])).toBe("text-sm font-bold");
  });

  it.each([
    [1, "1 second"],
    [30, "30 seconds"],
    [60, "1 minute"],
    [125, "2 minutes"],
    [3600, "1 hour"],
    [7300, "2 hours"],
    [86400, "1 day"],
    [86400 * 40, "40 days"],
    [31536000, "1 year"],
    [31536000 * 3, "3 years"],
  ])("labels a %i second gap as %s", (seconds, label) => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(formatTimeDifference(start, new Date(start.getTime() + seconds * 1000))).toBe(label);
    // Order doesn't matter, and strings are accepted.
    expect(formatTimeDifference(new Date(start.getTime() + seconds * 1000).toISOString(), start.toISOString())).toBe(label);
  });

  it("flattens chat history into AI/User lines", () => {
    expect(
      formatChatHistoryAsString([
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { type: "ai", content: 3 },
        { role: "user" },
      ]),
    ).toBe("User: hi\nAI: hello\nAI: 3\nUser: ");
  });

  it("computes cosine similarity", () => {
    expect(computeSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(computeSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("setStateInURL", () => {
  beforeEach(() => window.history.replaceState(null, "", "/doc?keep=1&q=old"));

  it("reads the current params without changing them", () => {
    expect(setStateInURL()).toEqual({ keep: "1", q: "old" });
    expect(setStateInURL({})).toEqual({ keep: "1", q: "old" });
  });

  it("sets and removes params, replacing history by default", () => {
    const length = window.history.length;
    expect(setStateInURL({ q: "new", view: "search", keep: null })).toEqual({ q: "new", view: "search" });
    expect(window.location.search).toBe("?q=new&view=search");
    expect(window.history.length).toBe(length);
    setStateInURL({ q: "" });
    expect(window.location.search).toBe("?view=search");
  });

  it("pushes history and can keep empty values", () => {
    const length = window.history.length;
    setStateInURL({ q: "" }, { addToBrowserHistory: true, removeNullish: false });
    expect(window.history.length).toBe(length + 1);
    expect(window.location.search).toBe("?keep=1&q=");
    setStateInURL({ keep: null }, { removeNullish: false });
    expect(window.location.search).toBe("?keep=1&q=");
  });
});
