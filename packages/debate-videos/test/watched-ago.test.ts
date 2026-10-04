import { describe, it, expect } from "vitest";
import { formatWatchedAgo } from "../src/state/videoWatchHistory";
import { filterVideoRows } from "@debate/data-sync/src/videos/video-query";

const now = () => new Date("2026-10-04T12:00:00.000Z");
const ago = (ms: number) => new Date(now().getTime() - ms).toISOString();

describe("formatWatchedAgo", () => {
  it("uses the coarsest sensible unit", () => {
    expect(formatWatchedAgo(ago(10_000), now)).toBe("Just now");
    expect(formatWatchedAgo(ago(5 * 60_000), now)).toBe("5 min ago");
    expect(formatWatchedAgo(ago(3 * 3_600_000), now)).toBe("3 hr ago");
    expect(formatWatchedAgo(ago(86_400_000), now)).toBe("1 day ago");
    expect(formatWatchedAgo(ago(2 * 86_400_000), now)).toBe("2 days ago");
    expect(formatWatchedAgo(ago(120 * 86_400_000), now)).toBe("4 mo ago");
    expect(formatWatchedAgo(ago(800 * 86_400_000), now)).toBe("2 yr ago");
  });
  it("shows a dash for a missing timestamp", () => {
    expect(formatWatchedAgo("", now)).toBe("—");
  });
});

describe("filterVideoRows with an empty id allow-list", () => {
  it("matches nothing, so an empty history lists nothing", () => {
    const rows = [{ videoId: "a", source: "x", style: null, searchText: "" }] as never[];
    expect(filterVideoRows(rows, { ids: [] } as never)).toEqual([]);
    expect(filterVideoRows(rows, { ids: null } as never)).toHaveLength(1);
  });
});
