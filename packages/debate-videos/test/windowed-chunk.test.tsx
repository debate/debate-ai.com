// @vitest-environment jsdom
/**
 * @fileoverview `WindowedChunk` keeps its cards mounted only while it is near
 * the viewport, and holds its last height while they are gone, so a feed that
 * pages without a ceiling never has every card live at once.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { WindowedChunk } from "../src/components/video-grid/WindowedChunk";

/** The callback of the one observer the chunk created. */
let fire: (isIntersecting: boolean) => void;

class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    fire = (isIntersecting) => callback([{ isIntersecting }]);
  }
  observe() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("WindowedChunk", () => {
  it("mounts its children only while near the viewport", async () => {
    await act(async () => {
      root.render(
        createElement(WindowedChunk, {
          initiallyMounted: false,
          estimatedHeight: 500,
          children: createElement("span", { id: "card" }, "card"),
        }),
      );
    });
    const box = container.firstElementChild as HTMLElement;
    expect(container.querySelector("#card")).toBeNull();
    expect(box.style.height).toBe("500px");

    await act(async () => fire(true));
    expect(container.querySelector("#card")).not.toBeNull();
    expect(box.style.height).toBe("");

    // jsdom lays nothing out, so pretend the cards made the box 1234px tall.
    Object.defineProperty(box, "offsetHeight", { configurable: true, value: 1234 });
    await act(async () => fire(false));
    expect(container.querySelector("#card")).toBeNull();
    expect(box.style.height).toBe("1234px");
  });

  it("keeps a table body's placeholder a valid row", async () => {
    const table = document.createElement("table");
    container.appendChild(table);
    const tableRoot = createRoot(table);
    await act(async () => {
      tableRoot.render(
        createElement(WindowedChunk, {
          as: "tbody",
          colSpan: 4,
          initiallyMounted: false,
          estimatedHeight: 88,
          children: createElement("tr", null, createElement("td", null, "row")),
        }),
      );
    });
    const placeholder = table.querySelector("tbody > tr > td") as HTMLTableCellElement;
    expect(placeholder.colSpan).toBe(4);
    expect(table.textContent).toBe("");
    await act(async () => tableRoot.unmount());
  });
});
