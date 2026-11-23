// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const animate = vi.fn();
vi.mock("animejs", () => ({ animate, utils: { set: vi.fn() } }));

const { attachSidebarIconHover, setSidebarIconAnimations } = await import("../src/ui/layout/sidebar-icon-hover");

/** A sidebar with one row, and the OS asking for reduced motion. */
function setup() {
  window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), media: query })) as never;
  const root = document.createElement("aside");
  root.innerHTML = '<a href="#"><svg></svg>Row</a>';
  document.body.append(root);
  const detach = attachSidebarIconHover(root);
  return { root, detach, row: root.querySelector("a")! };
}

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  animate.mockClear();
});

describe("sidebar icon hover under reduced motion", () => {
  it("still moves the icon when the reader hasn't set anything", () => {
    const { row, detach } = setup();
    row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(animate).toHaveBeenCalledTimes(1);
    detach();
  });

  it("does nothing once the Settings switch is off", () => {
    setSidebarIconAnimations(false);
    const { row, detach } = setup();
    row.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(animate).not.toHaveBeenCalled();
    detach();
  });
});
