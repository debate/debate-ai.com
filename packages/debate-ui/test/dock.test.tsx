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

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Dock, DockIcon, DockItem, DockLabel, dockVariants } from "../src/layout/dock";

function renderItem(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <Dock direction="middle">
      <DockItem {...props}>
        <DockLabel>Videos</DockLabel>
        <DockIcon>
          <span>V</span>
        </DockIcon>
      </DockItem>
    </Dock>,
  );
}

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

describe("DockItem", () => {
  it("renders a navigating item as a real link", () => {
    // Not decoration: the anchor is what gives a dock button middle-click,
    // open-in-new-tab, a hover target in the status bar and Enter to
    // activate. The host still intercepts the plain click to route itself.
    const html = renderItem({ href: "/videos", "aria-label": "Videos" });
    expect(html).toContain('href="/videos"');
    expect(html).toContain('aria-label="Videos"');
  });

  it("gives a non-navigating item button semantics instead", () => {
    // The settings item opens a menu rather than going anywhere, and is also
    // what Radix's DropdownMenuTrigger renders through `asChild`.
    const html = renderItem({ "aria-label": "Settings" });
    expect(html).not.toContain("href=");
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it("marks the current destination for assistive tech", () => {
    expect(renderItem({ href: "/videos", "aria-current": "page" })).toContain('aria-current="page"');
  });
});

describe("magnification", () => {
  it("leaves the hit area a fixed box whatever the magnification", () => {
    // The whole point: magnification is a transform on a layer inside the
    // slot, so the button never resizes and never shoves its neighbours out
    // from under the cursor mid-click. Both the resting and the magnified
    // size come out of the same 40px box.
    const html = renderDock({ iconSize: 40, magnification: 80 });
    expect(html).toContain("width:40px");
    expect(html).not.toContain("width:80px");
  });

  it("rests unmagnified, so a server render matches the first paint", () => {
    // Scale is driven by pointer distance, which is infinite until the cursor
    // arrives, so the resting transform is the identity — anything else here
    // would be a hydration mismatch.
    expect(renderDock()).toContain("transform:none");
  });
});

describe("DockLabel", () => {
  /** The tooltip div, pulled out of a rendered item by its label text. */
  function labelClasses(html: string): string {
    const match = /<div class="([^"]*)">Videos<\/div>/.exec(html);
    if (!match) throw new Error(`no dock label in: ${html}`);
    return match[1];
  }

  it("hangs the tooltip a fixed distance under its own icon", () => {
    // Anchored from the item's bottom edge, so the gap is the same at every
    // icon size and whatever the label's height. Pinning the label's *bottom*
    // instead (`-bottom-8`) made the gap 32px minus the label's height: the
    // tooltip floated free of the icon it belonged to — in the sidebar dock,
    // far enough to land on the panel header below it — and a taller label
    // climbed back up over the icon.
    const classes = labelClasses(renderItem());
    expect(classes).toContain("top-full");
    expect(classes).toContain("mt-1.5");
    expect(classes).not.toContain("-bottom-8");
  });

  it("paints over the content it hangs across", () => {
    // The label leaves the dock's box, and the dock is the first thing in the
    // sidebar column — with no stacking order of its own it goes *under* any
    // positioned element that comes after it in the document.
    expect(labelClasses(renderItem())).toContain("z-50");
  });

  it("stays centred on its icon and out of the pointer's way", () => {
    const classes = labelClasses(renderItem());
    expect(classes).toContain("left-1/2");
    expect(classes).toContain("-translate-x-1/2");
    // Hidden until hover/focus, and never a click target: a visible label
    // overlapping a neighbouring icon must not swallow that icon's click.
    expect(classes).toContain("opacity-0");
    expect(classes).toContain("group-hover:opacity-100");
    expect(classes).toContain("pointer-events-none");
  });

  it("keeps the web app's copy of the dock in step", () => {
    // `apps/debate-ai.com/lib/ui/layout/dock.tsx` is a second copy of this
    // file — the one the app actually renders, and the one the tooltip bug
    // was seen in. Only the package copy is unit-tested, so compare the label
    // markup directly rather than let the two drift apart again.
    const appDock = readFileSync(
      path.resolve(import.meta.dirname, "../../../apps/debate-ai.com/lib/ui/layout/dock.tsx"),
      "utf8",
    );
    const appClasses = /"absolute top-full[^"]*"/.exec(appDock)?.[0];
    expect(appClasses).toBeDefined();
    expect(appClasses!.slice(1, -1)).toBe(labelClasses(renderItem()));
  });
});
