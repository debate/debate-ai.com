// @vitest-environment jsdom
/**
 * @fileoverview The argument map's PNG export: output size (2x, clamped to
 * the canvas limit, viewBox fallback), filename, the injectable rasterizer's
 * success and failure paths, and the "Download PNG" button end to end with a
 * stubbed Image and canvas (jsdom has neither).
 */

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArgumentTreeNode } from "@debate-ai/round/src/flow/argument-tree";
import { buildArgumentMap } from "../src/flow/argument-map";
import ArgumentMapChart from "../src/panels/argument-map/ArgumentMapChart";
import {
  ARGUMENT_MAP_PNG_MAX_SIDE,
  argumentMapPngFilename,
  argumentMapPngSize,
  rasterizeSvgToPng,
  svgDataUrl,
  type RasterizeDeps,
} from "../src/panels/argument-map/export-png";
import { click, mount, type Mounted } from "./helpers/mount";

function svgWith(attrs: Record<string, string>): Element {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries(attrs)) svg.setAttribute(name, value);
  return svg;
}

describe("argumentMapPngSize", () => {
  it("doubles the chart's width and height by default", () => {
    expect(argumentMapPngSize(svgWith({ width: "300", height: "120.5" }))).toEqual({ width: 600, height: 241 });
  });

  it("falls back to the viewBox when width/height are missing", () => {
    expect(argumentMapPngSize(svgWith({ viewBox: "-10 -8 100 50" }), 1)).toEqual({ width: 100, height: 50 });
  });

  it("shrinks proportionally so neither side passes the canvas limit", () => {
    const size = argumentMapPngSize(svgWith({ width: "4000", height: "1000" }));
    expect(size).toEqual({ width: ARGUMENT_MAP_PNG_MAX_SIDE, height: 1024 });
  });

  it("returns null when there is no usable size", () => {
    expect(argumentMapPngSize(svgWith({}))).toBeNull();
    expect(argumentMapPngSize(svgWith({ width: "0", height: "10", viewBox: "0 0 nope" }))).toBeNull();
    expect(argumentMapPngSize(svgWith({ width: "10", height: "10" }), 0)).toBeNull();
  });
});

describe("argumentMapPngFilename", () => {
  it("uses the SVG slug rule with a .png extension", () => {
    expect(argumentMapPngFilename("  Round #4 / Finals ", "sunburst")).toBe("argument-map-round-4-finals-sunburst.png");
    expect(argumentMapPngFilename("", "tree")).toBe("argument-map-round-tree.png");
  });
});

describe("svgDataUrl", () => {
  it("percent-encodes the markup into an SVG data URL", () => {
    const url = svgDataUrl('<svg><text>#1 & "Plan"</text></svg>');
    expect(url.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(url.split(",")[1])).toBe('<svg><text>#1 & "Plan"</text></svg>');
  });
});

function fakeCanvas(opts: { context?: boolean; blob?: Blob | null } = {}) {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => (opts.context === false ? null : { drawImage })),
    toBlob: vi.fn((cb: (blob: Blob | null) => void, type: string) =>
      cb(opts.blob === undefined ? new Blob(["png"], { type }) : opts.blob),
    ),
  };
  return { canvas, drawImage };
}

describe("rasterizeSvgToPng", () => {
  it("draws the decoded image at the requested size and encodes a PNG", async () => {
    const image = { tag: "img" } as unknown as CanvasImageSource;
    const { canvas, drawImage } = fakeCanvas();
    const deps: RasterizeDeps = {
      loadImage: vi.fn(async () => image),
      createCanvas: vi.fn(() => canvas as unknown as HTMLCanvasElement),
    };
    const blob = await rasterizeSvgToPng("<svg/>", { width: 40, height: 20 }, deps);

    expect(deps.loadImage).toHaveBeenCalledWith(svgDataUrl("<svg/>"));
    expect(deps.createCanvas).toHaveBeenCalledWith(40, 20);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 40, 20);
    expect(blob.type).toBe("image/png");
  });

  it("rejects when the image fails to decode", async () => {
    const deps: RasterizeDeps = {
      loadImage: () => Promise.reject(new Error("decode failed")),
      createCanvas: () => fakeCanvas().canvas as unknown as HTMLCanvasElement,
    };
    await expect(rasterizeSvgToPng("<svg/>", { width: 1, height: 1 }, deps)).rejects.toThrow("decode failed");
  });

  it("rejects when the canvas has no 2D context", async () => {
    const deps: RasterizeDeps = {
      loadImage: async () => ({}) as CanvasImageSource,
      createCanvas: () => fakeCanvas({ context: false }).canvas as unknown as HTMLCanvasElement,
    };
    await expect(rasterizeSvgToPng("<svg/>", { width: 1, height: 1 }, deps)).rejects.toThrow(/cannot draw/);
  });

  it("rejects when encoding yields no blob", async () => {
    const deps: RasterizeDeps = {
      loadImage: async () => ({}) as CanvasImageSource,
      createCanvas: () => fakeCanvas({ blob: null }).canvas as unknown as HTMLCanvasElement,
    };
    await expect(rasterizeSvgToPng("<svg/>", { width: 1, height: 1 }, deps)).rejects.toThrow(/encoded as a PNG/);
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

/** jsdom never decodes images; this one "loads" as soon as its src is set. */
class LoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  static sources: string[] = [];
  static fail = false;
  set src(value: string) {
    LoadingImage.sources.push(value);
    queueMicrotask(() => (LoadingImage.fail ? this.onerror?.() : this.onload?.()));
  }
}

let mounted: Mounted | null = null;

afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  LoadingImage.sources = [];
  LoadingImage.fail = false;
});

async function mountChart() {
  const root = buildArgumentMap(TREE, "Round r1");
  mounted = await mount(<ArgumentMapChart root={root} mode="sunburst" focusId="root" onFocus={() => {}} />);
  const button = Array.from(mounted.container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Download PNG"),
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

describe("ArgumentMapChart Download PNG", () => {
  it("rasterizes the current view and downloads a .png", async () => {
    vi.stubGlobal("Image", LoadingImage);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb, type) {
      cb(new Blob(["png"], { type }));
    });
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:png";
      }),
      revokeObjectURL: vi.fn(),
    });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    const button = await mountChart();
    await click(button);
    await flush();

    expect(LoadingImage.sources).toHaveLength(1);
    const markup = decodeURIComponent(LoadingImage.sources[0].split(",")[1]);
    expect(markup).toContain("Plan boosts GDP");
    expect(markup).not.toContain("class=");
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(downloads).toEqual(["argument-map-round-r1-sunburst.png"]);
    expect(blobs[0].type).toBe("image/png");
    expect(button.disabled).toBe(false);
    expect(mounted?.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows an error and suggests SVG when the image cannot be decoded", async () => {
    vi.stubGlobal("Image", LoadingImage);
    LoadingImage.fail = true;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const button = await mountChart();
    await click(button);
    await flush();

    const alert = mounted?.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/could not be loaded.*Try Download SVG instead/);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });
});
