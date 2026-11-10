// @vitest-environment jsdom
/**
 * @fileoverview The argument map's SVG export: theme classes become explicit
 * attributes, interactive attributes are dropped, a background is painted,
 * the live chart is untouched, and the "Download SVG" button saves a file.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArgumentTreeNode } from "@debate-ai/round/src/flow/argument-tree";
import { buildArgumentMap } from "../src/flow/argument-map";
import ArgumentMapChart from "../src/panels/argument-map/ArgumentMapChart";
import {
  ARGUMENT_MAP_EXPORT_PALETTE,
  argumentMapSvgFilename,
  buildArgumentMapSvg,
} from "../src/panels/argument-map/export-svg";
import { click, mount, type Mounted } from "./helpers/mount";

function parseSvg(markup: string): Element {
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  return holder.firstElementChild as Element;
}

const LIVE = `<svg width="100" height="50" viewBox="-10 -8 100 50" class="shrink-0" data-map-root="">
  <g fill="none"><path d="M0 0L10 10" class="text-muted-foreground/50" stroke="currentColor"></path></g>
  <g role="button" tabindex="0" aria-label="Plan boosts GDP" class="cursor-pointer outline-none text-foreground">
    <rect width="30" height="20" fill="hsl(152 62% 36%)" class="cursor-pointer outline-none stroke-foreground"></rect>
    <text class="pointer-events-none fill-foreground stroke-background text-[10px]">Plan</text>
  </g>
</svg>`;

describe("buildArgumentMapSvg", () => {
  it("swaps theme classes for explicit attributes and drops interactive ones", () => {
    const source = parseSvg(LIVE);
    const out = parseSvg(buildArgumentMapSvg(source).replace(/^<\?xml[^>]*>\n/, ""));

    expect(out.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    expect(out.querySelectorAll("[class]")).toHaveLength(0);
    expect(out.querySelectorAll("[role], [tabindex], [data-map-root]")).toHaveLength(0);
    expect(out.hasAttribute("data-map-root")).toBe(false);

    expect(out.querySelector("path")?.getAttribute("color")).toBe(ARGUMENT_MAP_EXPORT_PALETTE.mutedForeground);
    const claim = out.querySelector("g[aria-label]");
    expect(claim?.getAttribute("color")).toBe(ARGUMENT_MAP_EXPORT_PALETTE.foreground);
    expect(out.querySelector("g[aria-label] rect")?.getAttribute("stroke")).toBe(ARGUMENT_MAP_EXPORT_PALETTE.foreground);
    expect(out.querySelector("g[aria-label] rect")?.getAttribute("fill")).toBe("hsl(152 62% 36%)");
    const text = out.querySelector("text");
    expect(text?.getAttribute("fill")).toBe(ARGUMENT_MAP_EXPORT_PALETTE.foreground);
    expect(text?.getAttribute("stroke")).toBe(ARGUMENT_MAP_EXPORT_PALETTE.background);
    expect(text?.getAttribute("font-size")).toBe("10px");
  });

  it("paints a background rect over the whole viewBox, first", () => {
    const out = parseSvg(buildArgumentMapSvg(parseSvg(LIVE)).replace(/^<\?xml[^>]*>\n/, ""));
    const first = out.firstElementChild;
    expect(first?.localName).toBe("rect");
    expect([first?.getAttribute("x"), first?.getAttribute("y"), first?.getAttribute("width"), first?.getAttribute("height")]).toEqual([
      "-10",
      "-8",
      "100",
      "50",
    ]);
    expect(first?.getAttribute("fill")).toBe(ARGUMENT_MAP_EXPORT_PALETTE.background);
  });

  it("skips the background when the viewBox is missing or malformed", () => {
    const out = parseSvg(buildArgumentMapSvg(parseSvg(`<svg viewBox="0 0 nope"><circle r="4"></circle></svg>`)));
    expect(out.firstElementChild?.localName).toBe("circle");
  });

  it("starts with an XML declaration and leaves the live chart untouched", () => {
    const source = parseSvg(LIVE);
    const before = source.outerHTML;
    expect(buildArgumentMapSvg(source).startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg')).toBe(true);
    expect(source.outerHTML).toBe(before);
  });

  it("honours a custom palette", () => {
    const palette = { foreground: "#fff", mutedForeground: "#999", background: "#000" };
    const out = parseSvg(buildArgumentMapSvg(parseSvg(LIVE), palette).replace(/^<\?xml[^>]*>\n/, ""));
    expect(out.getAttribute("color")).toBe("#fff");
    expect(out.firstElementChild?.getAttribute("fill")).toBe("#000");
  });

  it("rejects a non-svg element", () => {
    expect(() => buildArgumentMapSvg(document.createElement("div"))).toThrow(/<svg>/);
  });
});

describe("argumentMapSvgFilename", () => {
  it("slugs the root label and appends the view", () => {
    expect(argumentMapSvgFilename("Round r1", "sunburst")).toBe("argument-map-round-r1-sunburst.svg");
    expect(argumentMapSvgFilename("  Round #4 / Finals ", "tree")).toBe("argument-map-round-4-finals-tree.svg");
  });

  it("falls back to 'round' for an empty label", () => {
    expect(argumentMapSvgFilename(" !! ", "bubble")).toBe("argument-map-round-bubble.svg");
  });
});

const TREE: ArgumentTreeNode[] = [
  {
    id: "row-0",
    rowIndex: 0,
    isHeading: false,
    content: "Plan boosts GDP",
    originSpeech: "1AC",
    lastSpeech: "1NC",
    sideKey: "A",
    isUnanswered: true,
    entries: [
      { speech: "1AC", content: "Plan boosts GDP" },
      { speech: "1NC", content: "No link" },
    ],
    children: [],
  },
];

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

describe("ArgumentMapChart Download SVG", () => {
  it("downloads the current view as a standalone .svg", async () => {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:map";
    });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    const root = buildArgumentMap(TREE, "Round r1");
    mounted = await mount(<ArgumentMapChart root={root} mode="mindmap" focusId="root" onFocus={() => {}} />);
    const button = Array.from(mounted.container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Download SVG"),
    );
    await click(button as HTMLElement);

    expect(downloads).toEqual(["argument-map-round-r1-mindmap.svg"]);
    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe("image/svg+xml");
    const markup = await blobs[0].text();
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).toContain("Plan boosts GDP");
    expect(markup).not.toContain('role="button"');
    expect(markup).not.toContain("class=");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:map");
  });
});
