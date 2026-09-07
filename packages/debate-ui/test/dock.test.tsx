/**
 * @fileoverview Pins the Dock's `fluid` mode — the thing that keeps the app
 * dock inside the sidebar column it is hosted in.
 *
 * A content-sized dock (`w-max`) is wider than the 300px app sidebar it sits
 * in at the `md` breakpoint, which either forces the sidebar to scroll
 * sideways or reaches over its border onto the page beside it — the
 * CardMirror editor, on `/reason-editor` and `/doc`. `fluid` swaps that for a
 * column-width, wrapping row, and lets the host shrink the icons so the whole
 * set fits without wrapping in the first place.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Dock, DockIcon, DockItem, DockLabel, dockVariants } from "../src/layout/dock";

function renderDock(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <Dock direction="middle" {...props}>
      <DockItem>
        <DockLabel>Videos</DockLabel>
        <DockIcon>
          <span>V</span>
        </DockIcon>
      </DockItem>
    </Dock>,
  );
}

describe("dockVariants", () => {
  it("sizes a free-floating dock to its own contents", () => {
    const classes = dockVariants({ fluid: false });
    expect(classes).toContain("w-max");
    expect(classes).not.toContain("flex-wrap");
  });

  it("binds a fluid dock to its container instead", () => {
    const classes = dockVariants({ fluid: true });
    // Width comes from the column, never from the item count...
    expect(classes).toContain("w-full");
    expect(classes).toContain("max-w-full");
    expect(classes).not.toContain("w-max");
    // ...and an overflowing row wraps down rather than out.
    expect(classes).toContain("flex-wrap");
    // No auto-centering margin or top margin to push it out of the column.
    expect(classes).toContain("mx-0");
    expect(classes).toContain("mt-0");
  });

  it("defaults to the free-floating form", () => {
    expect(dockVariants({})).toBe(dockVariants({ fluid: false }));
  });
});

describe("Dock", () => {
  it("renders children and their hover labels", () => {
    const html = renderDock();
    expect(html).toContain("Videos");
    expect(html).toContain(">V<");
  });

  it("keeps hover labels visible rather than clipping them", () => {
    // The column itself is the clipping boundary; clipping here would hide
    // every dock tooltip.
    expect(renderDock({ fluid: true })).toContain("overflow-visible");
  });

  it("renders icons at the resting size the host asks for", () => {
    expect(renderDock({ iconSize: 34 })).toContain("width:34px");
    // Default when the host says nothing.
    expect(renderDock()).toContain("width:40px");
  });

  it("never magnifies an icon below its resting size", () => {
    // A host that shrinks the icons without lowering magnification would
    // otherwise get an icon that shrinks on hover.
    const html = renderDock({ iconSize: 34, magnification: 20 });
    expect(html).toContain("width:34px");
  });
});
