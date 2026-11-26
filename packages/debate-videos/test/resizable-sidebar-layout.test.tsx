/** @vitest-environment jsdom */
/**
 * @fileoverview `ResizableSidebarLayout` mounted: restoring and persisting the
 * dragged width, the hide/show choice and its shortcut, the peek-on-hover of a
 * hidden column, and the page-local collapse of `autoCollapse` pages. The
 * resizable-panels library is replaced with a fake that exposes its imperative
 * panel API and `onResize` callback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";

import { click, flush, mount, type Mounted } from "./helpers/mount";

const panel = vi.hoisted(() => ({
  api: {
    resize: vi.fn(),
    collapse: vi.fn(),
    expand: vi.fn(),
    isCollapsed: vi.fn(() => false),
  },
  props: {} as Record<string, unknown>,
}));
const motion = vi.hoisted(() => ({
  reduced: true,
  played: [] as Array<{ direction: string; onComplete?: () => void; cancel: ReturnType<typeof vi.fn> }>,
}));
const sound = vi.hoisted(() => ({ playUISoundEffect: vi.fn() }));

vi.mock("react-resizable-panels", () => ({
  Group: ({ children, className }: { children: unknown; className?: string }) => (
    <div data-testid="group" className={className}>
      {children as never}
    </div>
  ),
  Panel: (props: Record<string, unknown> & { id: string; children: unknown }) => {
    if (props.id === "app-sidebar") panel.props = props;
    return <div data-panel={props.id}>{props.children as never}</div>;
  },
  Separator: (props: { "aria-label": string }) => <div role="separator" aria-label={props["aria-label"]} />,
  usePanelRef: () => useRef(panel.api),
}));
vi.mock("@debate-ai/timer", () => sound);
vi.mock("../src/ui/layout/sidebar-icon-hover", () => ({ useSidebarIconHover: () => {} }));
vi.mock("../src/ui/layout/sidebar-peek-animations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/ui/layout/sidebar-peek-animations")>()),
  prefersReducedMotion: () => motion.reduced,
  playPeekAnimation: (_el: HTMLElement, _animation: unknown, direction: string, onComplete?: () => void) => {
    const handle = { direction, onComplete, cancel: vi.fn() };
    motion.played.push(handle);
    return handle;
  },
}));

import {
  ResizableSidebarLayout,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_PEEK_HIDE_DELAY_MS,
  SIDEBAR_WIDTH_KEY,
} from "../src/ui/layout/ResizableSidebarLayout";
import { SIDEBAR_COLLAPSED_KEY } from "../src/ui/layout/sidebar-collapse";

let mounted: Mounted | undefined;

async function render(props: Partial<React.ComponentProps<typeof ResizableSidebarLayout>> = {}) {
  mounted = await mount(
    <ResizableSidebarLayout sidebar={<nav>tree</nav>} footer={<span>account</span>} {...props}>
      <main>page</main>
    </ResizableSidebarLayout>,
  );
  return mounted.container;
}

const aside = (container: HTMLElement) => container.querySelector("aside")!;
const hideButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('button[aria-label="Hide sidebar"]');
const showTab = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('button[aria-label="Show sidebar"]');
const keepOpen = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[aria-label="Keep sidebar open"]');

function resize(size: number, prev: number | undefined) {
  (panel.props.onResize as (s: unknown, id: unknown, prev: unknown) => void)(
    { inPixels: size, asPercentage: 0 },
    "app-sidebar",
    prev === undefined ? undefined : { inPixels: prev, asPercentage: 0 },
  );
}

function pointer(type: string, init: { clientX?: number; pointerType?: string } = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { clientX: init.clientX ?? 0, pointerType: init.pointerType ?? "mouse" });
  return event;
}

function key(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  panel.api.isCollapsed.mockReturnValue(false);
  panel.props = {};
  motion.reduced = true;
  motion.played = [];
});

afterEach(async () => {
  vi.useRealTimers();
  await mounted?.unmount();
  mounted = undefined;
  localStorage.clear();
});

describe("ResizableSidebarLayout width", () => {
  it("lays out the sidebar, footer, handle and page", async () => {
    const container = await render({ appChrome: true, className: "row", contentClassName: "content" });
    expect(aside(container).textContent).toContain("tree");
    expect(aside(container).textContent).toContain("account");
    expect(aside(container).hasAttribute("data-app-chrome")).toBe(true);
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
    expect(container.querySelector("main")!.parentElement!.className).toContain("content");
    expect(container.querySelector('[data-testid="group"]')!.className).toContain("row");
    expect(panel.props.defaultSize).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("restores the width the user last dragged to", async () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "400");
    await render();
    expect(panel.api.resize).toHaveBeenCalledWith(400);
  });

  it("keeps the default width when nothing valid is stored", async () => {
    await render();
    expect(panel.api.resize).not.toHaveBeenCalled();
    await mounted!.unmount();
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "garbage");
    await render();
    expect(panel.api.resize).not.toHaveBeenCalled();
  });

  it("survives a panel that is not registered yet", async () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "400");
    panel.api.resize.mockImplementationOnce(() => {
      throw new Error("not registered");
    });
    const container = await render();
    expect(aside(container)).toBeTruthy();
  });

  it("saves the rounded width after a drag", async () => {
    await render();
    await flush(() => resize(333.6, 280));
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("334");
  });

  it("ignores the first size report, which has nothing to compare with", async () => {
    await render();
    await flush(() => resize(300, undefined));
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBeNull();
  });

  it("treats a drag down to nothing as hiding the sidebar, without overwriting the width", async () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "400");
    const container = await render();
    await flush(() => resize(0, 300));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("400");
    expect(showTab(container)).not.toBeNull();
    await flush(() => resize(0, 0));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
  });

  it("shows the sidebar again when it is dragged back out", async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
    const container = await render();
    expect(showTab(container)).not.toBeNull();
    await flush(() => resize(250, 0));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe("250");
    expect(showTab(container)).toBeNull();
  });
});

describe("ResizableSidebarLayout hiding", () => {
  it("hides and shows through its buttons, driving the panel and sounding the change", async () => {
    const container = await render();
    expect(sound.playUISoundEffect).not.toHaveBeenCalled();
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);

    await click(hideButton(container)!);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    expect(panel.api.collapse).toHaveBeenCalled();
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
    expect(sound.playUISoundEffect).toHaveBeenLastCalledWith("popDown");

    panel.api.isCollapsed.mockReturnValue(true);
    await click(showTab(container)!);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
    expect(panel.api.expand).toHaveBeenCalled();
    expect(sound.playUISoundEffect).toHaveBeenLastCalledWith("popUpOn");
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);
  });

  it("starts hidden, silently, when the choice was saved", async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
    const container = await render();
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
    expect(panel.api.collapse).toHaveBeenCalled();
    expect(sound.playUISoundEffect).not.toHaveBeenCalled();
  });

  it("does not break when the panel is not registered with its group yet", async () => {
    panel.api.collapse.mockImplementation(() => {
      throw new Error("not registered");
    });
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
    const container = await render();
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
    panel.api.collapse.mockReset();
  });

  it("toggles with Ctrl/Cmd+B", async () => {
    await render();
    const event = await (async () => {
      let pressed!: KeyboardEvent;
      await flush(() => {
        pressed = key({ key: "b", ctrlKey: true });
      });
      return pressed;
    })();
    expect(event.defaultPrevented).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    await flush(() => {
      key({ key: "B", metaKey: true });
    });
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });

  it("leaves Ctrl+B alone where it means bold, and for other combinations", async () => {
    const container = await render();
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    Object.defineProperty(editable, "isContentEditable", { value: true });
    container.append(input, editable);
    await flush(() => {
      expect(key({ key: "b", ctrlKey: true }, input).defaultPrevented).toBe(false);
      expect(key({ key: "b", ctrlKey: true }, editable).defaultPrevented).toBe(false);
      expect(key({ key: "b" }).defaultPrevented).toBe(false);
      expect(key({ key: "b", ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
      expect(key({ key: "b", ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
      expect(key({ key: "x", ctrlKey: true }).defaultPrevented).toBe(false);
    });
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });
});

describe("ResizableSidebarLayout peek", () => {
  async function collapsed(props: Partial<React.ComponentProps<typeof ResizableSidebarLayout>> = {}) {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
    return render(props);
  }

  it("slides the hidden column out over the page when the pointer reaches the left edge", async () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "9999");
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 200 })));
    expect(aside(container).hasAttribute("data-peek")).toBe(false);

    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 3 })));
    expect(aside(container).hasAttribute("data-peek")).toBe(true);
    expect(aside(container).style.width).toBe("640px");
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);
    // Peeking is not the real choice: nothing sounds and the tab goes away.
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("1");
    expect(sound.playUISoundEffect).not.toHaveBeenCalled();
    expect(showTab(container)).toBeNull();
    expect(keepOpen(container)).not.toBeNull();
  });

  it("ignores touch pointers", async () => {
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2, pointerType: "touch" })));
    expect(aside(container).hasAttribute("data-peek")).toBe(false);
  });

  it("slides away a moment after the pointer leaves, and stays while it is over the column", async () => {
    vi.useFakeTimers();
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    expect(aside(container).hasAttribute("data-peek")).toBe(true);

    // jsdom lays nothing out, so the column's right edge is 0 and anything beyond is "outside".
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 500 })));
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS - 1);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(true);
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 0 })));
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS * 2);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(true);

    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 500 })));
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(false);
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
  });

  it("goes when the pointer leaves the column, the window, or focus moves away", async () => {
    vi.useFakeTimers();
    const container = await collapsed();
    const peekThenLeave = async (leave: () => void) => {
      await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
      expect(aside(container).hasAttribute("data-peek")).toBe(true);
      await flush(leave);
      await flush(() => {
        vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS);
      });
      expect(aside(container).hasAttribute("data-peek")).toBe(false);
    };
    await peekThenLeave(() => aside(container).dispatchEvent(pointer("pointerleave")));
    await peekThenLeave(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: null })));
    await peekThenLeave(() => window.dispatchEvent(new Event("blur")));
  });

  it("stays when the pointer re-enters the column, and when a touch leaves it", async () => {
    vi.useFakeTimers();
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    await flush(() => aside(container).dispatchEvent(pointer("pointerleave", { pointerType: "touch" })));
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS * 2);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(true);

    await flush(() => aside(container).dispatchEvent(pointer("pointerleave")));
    await flush(() => aside(container).dispatchEvent(pointer("pointerenter")));
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS * 2);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(true);
  });

  it("hides on Escape", async () => {
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    await flush(() => {
      key({ key: "a" }, document);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(true);
    await flush(() => {
      key({ key: "Escape" }, document);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(false);
  });

  it("is kept out while a popup menu opened from the column is open", async () => {
    vi.useFakeTimers();
    const container = await collapsed({
      sidebar: (
        <button aria-haspopup="menu" aria-expanded="true">
          Account
        </button>
      ),
    });
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 500 })));
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS * 3);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(true);

    aside(container).querySelector("button")!.setAttribute("aria-expanded", "false");
    await flush(() => {
      vi.advanceTimersByTime(SIDEBAR_PEEK_HIDE_DELAY_MS);
    });
    expect(aside(container).hasAttribute("data-peek")).toBe(false);
  });

  it("pins the column open from the peeked state", async () => {
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    await click(keepOpen(container)!);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
    expect(aside(container).hasAttribute("data-peek")).toBe(false);
    expect(hideButton(container)).not.toBeNull();
  });

  it("plays an entrance and exit animation unless reduced motion is on", async () => {
    motion.reduced = false;
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    expect(motion.played.map((p) => p.direction)).toEqual(["in"]);

    await flush(() => {
      key({ key: "Escape" }, document);
    });
    expect(motion.played.map((p) => p.direction)).toEqual(["in", "out"]);
    // Still on screen until the exit animation completes.
    expect(aside(container).hasAttribute("data-peek")).toBe(true);
    await flush(() => motion.played[1].onComplete?.());
    expect(aside(container).hasAttribute("data-peek")).toBe(false);
  });

  it("comes straight back in when the pointer returns mid-exit", async () => {
    motion.reduced = false;
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    await flush(() => {
      key({ key: "Escape" }, document);
    });
    const exit = motion.played[1];
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    expect(exit.cancel).toHaveBeenCalled();
    expect(motion.played.map((p) => p.direction)).toEqual(["in", "out", "in"]);
    // A late completion of the cancelled exit must not hide the column.
    await flush(() => exit.onComplete?.());
    expect(aside(container).hasAttribute("data-peek")).toBe(true);
  });

  it("clears the animation's inline styles once the column is back in the panel", async () => {
    motion.reduced = false;
    const container = await collapsed();
    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    aside(container).style.opacity = "0.5";
    aside(container).style.transform = "scale(0.9)";
    await click(keepOpen(container)!);
    expect(aside(container).style.opacity).toBe("");
    expect(aside(container).style.transform).toBe("");
  });
});

describe("ResizableSidebarLayout autoCollapse", () => {
  it("starts hidden whatever the app-wide choice, with no tab to show it", async () => {
    const container = await render({ autoCollapse: true });
    expect(panel.props.defaultSize).toBe(0);
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
    expect(showTab(container)).toBeNull();
    expect(panel.api.collapse).toHaveBeenCalled();
  });

  it("does not apply the stored width to a panel that mounted collapsed", async () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "400");
    await render({ autoCollapse: true });
    expect(panel.api.resize).not.toHaveBeenCalled();
  });

  it("pins open for this page only, restoring the stored width the first time", async () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "400");
    const container = await render({ autoCollapse: true });
    panel.api.isCollapsed.mockReturnValue(true);

    await flush(() => document.dispatchEvent(pointer("pointermove", { clientX: 2 })));
    await click(keepOpen(container)!);
    expect(panel.api.expand).toHaveBeenCalled();
    expect(panel.api.resize).toHaveBeenCalledWith(400);
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();

    await click(hideButton(container)!);
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });

  it("toggles with Ctrl+B without touching the app-wide choice", async () => {
    const container = await render({ autoCollapse: true });
    await flush(() => {
      key({ key: "b", ctrlKey: true });
    });
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
    await flush(() => {
      key({ key: "b", ctrlKey: true });
    });
    expect(aside(container).hasAttribute("data-collapsed")).toBe(true);
  });

  it("follows the app-wide choice once the page stops asking to collapse", async () => {
    const container = await render({ autoCollapse: true });
    await flush(() => {
      key({ key: "b", ctrlKey: true });
    });
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);
    await mounted!.rerender(
      <ResizableSidebarLayout sidebar={<nav>tree</nav>} autoCollapse={false}>
        <main>page</main>
      </ResizableSidebarLayout>,
    );
    expect(aside(container).hasAttribute("data-collapsed")).toBe(false);
    expect(showTab(container)).toBeNull();
  });
});
