/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { HubSectionNav, splitIntoRows } from "../../../src/components/hubs/HubSectionNav";
import { RESEARCH_SECTIONS } from "../../../src/components/research/ResearchHub";

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = container = null;
});

async function render(rows?: number, onChange: (id: string) => void = () => {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <HubSectionNav
        sections={RESEARCH_SECTIONS}
        active="coverage"
        onChange={onChange}
        label="Research sections"
        rows={rows}
      />,
    ),
  );
  return container;
}

const labels = (el: Element) => Array.from(el.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent);

describe("splitIntoRows", () => {
  it("splits in order with earlier rows taking the extra item", () => {
    expect(splitIntoRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 2)).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9, 10, 11, 12, 13],
    ]);
    expect(splitIntoRows([1, 2, 3], 1)).toEqual([[1, 2, 3]]);
    expect(splitIntoRows([1, 2], 5)).toEqual([[1], [2]]);
    expect(splitIntoRows([], 2)).toEqual([]);
  });
});

describe("HubSectionNav rows", () => {
  it("keeps the single scrolling row by default", async () => {
    const el = await render();
    expect(el.querySelectorAll("[data-tab-row]")).toHaveLength(0);
    expect(el.querySelector('[role="tablist"]')?.className).toContain("overflow-x-auto");
    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(RESEARCH_SECTIONS.length);
  });

  it("lays the research tabs out as 7 + 6 in the existing order, with counts", async () => {
    expect(RESEARCH_SECTIONS).toHaveLength(13);
    const el = await render(2);
    const rows = Array.from(el.querySelectorAll("[data-tab-row]"));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.querySelectorAll('[role="tab"]').length)).toEqual([7, 6]);
    expect(rows.every((row) => row.className.includes("flex-wrap"))).toBe(true);
    expect(el.querySelector('[role="tablist"]')?.className).not.toContain("overflow-x-auto");
    expect(labels(el)).toEqual(RESEARCH_SECTIONS.map((s) => `${s.label}${s.panels.length}`));
    expect(labels(rows[0])[6]).toBe("Research Progress1");
    expect(labels(rows[1])[0]).toBe("Quests3");
  });

  it("keeps active styling and roving tabindex", async () => {
    const el = await render(2);
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(tabs.map((_, i) => String(i === 0)));
    expect(tabs[0].className).toContain("bg-primary");
    expect(tabs.map((tab) => tab.tabIndex)).toEqual(tabs.map((_, i) => (i === 0 ? 0 : -1)));
  });

  it("moves between tabs with arrow keys across the row break, wrapping at the ends", async () => {
    const picked: string[] = [];
    const el = await render(2, (id) => picked.push(id));
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
    const press = async (index: number, key: string) =>
      act(async () => {
        tabs[index].dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    await press(6, "ArrowRight");
    await press(0, "ArrowLeft");
    await press(5, "End");
    await press(9, "Home");
    expect(picked).toEqual([
      RESEARCH_SECTIONS[7].id,
      RESEARCH_SECTIONS[12].id,
      RESEARCH_SECTIONS[12].id,
      RESEARCH_SECTIONS[0].id,
    ]);
  });
});
