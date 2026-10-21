// @vitest-environment jsdom
/**
 * @fileoverview Covers the drag-and-resize hook behind the floating video
 * player — the picture-in-picture window a user drags around while browsing
 * the library.
 *
 * The behaviours worth pinning are the ones a user notices when they break:
 * the window must not be draggable off-screen, resizing from a left edge has
 * to move the window as it narrows (or the right edge visibly walks away), and
 * the width has to stay inside the min/max the layout is built for.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useDragResize, type ResizeEdge } from "../src/components/video-player/useDragResize";

const MIN_WIDTH = 256;
const MAX_WIDTH = 800;

type Api = ReturnType<typeof useDragResize>;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

/**
 * Mounts the hook on a container whose geometry the test controls, since jsdom
 * lays nothing out and reports every rect as zero.
 */
async function renderHook(
  box: { left: number; top: number; width: number; height: number } = {
    left: 100,
    top: 50,
    width: 400,
    height: 300,
  },
) {
  let api!: Api;

  function Probe() {
    const ref = useRef<HTMLDivElement | null>(null);
    api = useDragResize(ref);
    return createElement("div", { ref });
  }

  host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    root = createRoot(host as HTMLDivElement);
    root.render(createElement(Probe));
  });

  const el = host.firstElementChild as HTMLDivElement;
  el.getBoundingClientRect = () =>
    ({ left: box.left, top: box.top, width: box.width, height: box.height }) as DOMRect;
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: box.width });
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: box.height });

  return {
    get current() {
      return api;
    },
  };
}

const mouseMove = (clientX: number, clientY: number) =>
  act(async () => {
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX, clientY, bubbles: true }),
    );
  });

const mouseUp = () =>
  act(async () => {
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

/** jsdom has no TouchEvent constructor, so the shape the handler reads is faked. */
const touch = (type: "touchmove" | "touchend", clientX = 0, clientY = 0) =>
  act(async () => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", {
      value: [{ clientX, clientY }],
    });
    document.dispatchEvent(event);
  });

afterEach(async () => {
  if (root) {
    const current = root;
    await act(async () => current.unmount());
  }
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

describe("useDragResize initial state", () => {
  it("starts undragged, unresized and unpositioned", async () => {
    const hook = await renderHook();
    expect(hook.current).toMatchObject({
      position: null,
      isDragging: false,
      isResizing: false,
      playerWidth: null,
    });
  });
});

describe("dragging", () => {
  it("adopts the element's current position when a drag starts", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));

    expect(hook.current.isDragging).toBe(true);
    expect(hook.current.position).toEqual({ x: 100, y: 50 });
  });

  it("moves the window by the pointer, keeping the grab offset", async () => {
    const hook = await renderHook();
    // Grabbed 50px right and 30px down from the window's corner.
    await act(async () => hook.current.startDrag(150, 80));
    await mouseMove(250, 180);

    expect(hook.current.position).toEqual({ x: 200, y: 150 });
  });

  it("ignores pointer movement before a drag starts", async () => {
    const hook = await renderHook();
    await mouseMove(250, 180);
    expect(hook.current.position).toBeNull();
  });

  it("stops dragging on mouse up", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await mouseUp();

    expect(hook.current.isDragging).toBe(false);
  });

  it("leaves the window where the drag ended", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await mouseMove(250, 180);
    await mouseUp();
    await mouseMove(600, 600);

    expect(hook.current.position).toEqual({ x: 200, y: 150 });
  });

  it("does not start a drag before the element is mounted", async () => {
    let api!: Api;
    function Probe() {
      const ref = useRef<HTMLDivElement | null>(null);
      api = useDragResize(ref);
      return null;
    }
    host = document.createElement("div");
    document.body.append(host);
    await act(async () => {
      root = createRoot(host as HTMLDivElement);
      root.render(createElement(Probe));
    });

    await act(async () => api.startDrag(10, 10));
    expect(api.isDragging).toBe(false);
  });
});

describe("staying on screen", () => {
  it("never drags the window past the left or top edge", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await mouseMove(-500, -500);

    expect(hook.current.position).toEqual({ x: 0, y: 0 });
  });

  it("never drags the window past the right or bottom edge", async () => {
    window.innerWidth = 1000;
    window.innerHeight = 800;
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await mouseMove(5000, 5000);

    // The window is 400x300, so its corner stops with the window fully visible.
    expect(hook.current.position).toEqual({ x: 600, y: 500 });
  });
});

describe("touch dragging", () => {
  it("follows a touch the same way it follows a pointer", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await touch("touchmove", 250, 180);

    expect(hook.current.position).toEqual({ x: 200, y: 150 });
  });

  it("stops dragging when the touch ends", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await touch("touchend");

    expect(hook.current.isDragging).toBe(false);
  });

  it("ignores a touch before a drag starts", async () => {
    const hook = await renderHook();
    await touch("touchmove", 250, 180);
    expect(hook.current.position).toBeNull();
  });
});

describe("resizing", () => {
  it("widens the window when a right edge is dragged outward", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await mouseMove(600, 200);

    expect(hook.current.isResizing).toBe(true);
    expect(hook.current.playerWidth).toBe(500);
  });

  it("narrows the window when a right edge is dragged inward", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "bottom-right"));
    await mouseMove(400, 200);

    expect(hook.current.playerWidth).toBe(300);
  });

  it("widens the window when a left edge is dragged outward", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(100, 200, "left"));
    await mouseMove(0, 200);

    expect(hook.current.playerWidth).toBe(500);
  });

  it.each(["left", "bottom-left"] as ResizeEdge[])(
    "keeps the %s edge under the pointer by moving the window",
    async (edge) => {
      const hook = await renderHook();
      await act(async () => hook.current.startResize(100, 200, edge));
      await mouseMove(150, 200);

      // 50px narrower, so the left edge moves 50px right and stays put visually.
      expect(hook.current.playerWidth).toBe(350);
      expect(hook.current.position).toEqual({ x: 150, y: 50 });
    },
  );

  it("leaves the window in place when a right edge is dragged", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await mouseMove(600, 200);

    expect(hook.current.position).toEqual({ x: 100, y: 50 });
  });

  it("never narrows below the minimum width", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await mouseMove(-5000, 200);

    expect(hook.current.playerWidth).toBe(MIN_WIDTH);
  });

  it("never widens beyond the maximum width", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await mouseMove(5000, 200);

    expect(hook.current.playerWidth).toBe(MAX_WIDTH);
  });

  it("stops resizing on mouse up", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await mouseUp();

    expect(hook.current.isResizing).toBe(false);
  });

  it("stops resizing when the touch ends", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await touch("touchend");

    expect(hook.current.isResizing).toBe(false);
  });

  it("resizes by touch as well as by pointer", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startResize(500, 200, "right"));
    await touch("touchmove", 600, 200);

    expect(hook.current.playerWidth).toBe(500);
  });

  it("resizing takes precedence over an in-flight drag", async () => {
    const hook = await renderHook();
    await act(async () => hook.current.startDrag(150, 80));
    await act(async () => hook.current.startResize(500, 200, "right"));
    await mouseMove(600, 200);

    expect(hook.current.playerWidth).toBe(500);
    // The window stayed put: the move resized rather than dragged.
    expect(hook.current.position).toEqual({ x: 100, y: 50 });
  });

  it("does not start a resize before the element is mounted", async () => {
    let api!: Api;
    function Probe() {
      const ref = useRef<HTMLDivElement | null>(null);
      api = useDragResize(ref);
      return null;
    }
    host = document.createElement("div");
    document.body.append(host);
    await act(async () => {
      root = createRoot(host as HTMLDivElement);
      root.render(createElement(Probe));
    });

    await act(async () => api.startResize(10, 10, "right"));
    expect(api.isResizing).toBe(false);
  });
});

describe("listener cleanup", () => {
  it("removes every document listener it installed on unmount", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");

    await renderHook();
    const installed = add.mock.calls.map(([type]) => type);

    const current = root as Root;
    await act(async () => current.unmount());
    root = null;

    const removed = remove.mock.calls.map(([type]) => type);
    for (const type of installed) {
      expect(removed, type).toContain(type);
    }
  });
});
