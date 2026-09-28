// @vitest-environment jsdom
/**
 * @fileoverview Every rankings column resizes by dragging its header's right
 * edge, and the table's width follows so nothing else is squeezed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { RankingEntry } from "debate-rankings-adapter";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));

import { RankingsTable } from "../src/panels/leaderboard/RankingsTable";
import { TooltipProvider } from "../src/ui/primitives/tooltip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const entry = {
  rank: 1,
  school: "Harker School",
  name: "Lee & Liu",
  adjustedRating: 1543,
  matches: 40,
  affWinRate: 80,
  negWinRate: 70,
  affElimWinRate: null,
  negElimWinRate: 50,
  hash: "h1",
} as unknown as RankingEntry;

function render() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      createElement(
        TooltipProvider,
        null,
        createElement(RankingsTable, { entries: [entry], division: "VCX", sort: null, onToggleSort: () => {} }),
      ),
    );
  });
  return host;
}

const px = (value: string) => Number(value.replace("px", ""));

describe("RankingsTable column resizing", () => {
  it("gives every column a drag handle", () => {
    const container = render();
    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(9);
    for (const header of headers) expect(header.querySelector('[role="separator"]')).not.toBeNull();
  });

  it("widens a column and the table by the distance dragged", () => {
    const container = render();
    const table = container.querySelector("table")!;
    const school = Array.from(container.querySelectorAll("th")).find((th) => th.textContent?.includes("School"))!;
    const before = { column: px(school.style.width), table: px(table.style.width) };

    const handle = school.querySelector('[role="separator"]')!;
    act(() => {
      handle.dispatchEvent(new MouseEvent("mousedown", { clientX: 300, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 380, bubbles: true }));
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });

    expect(px(school.style.width)).toBe(before.column + 80);
    expect(px(table.style.width)).toBe(before.table + 80);
  });
});
