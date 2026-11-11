// @vitest-environment jsdom
/**
 * @fileoverview The argument map's PDF export: filename, page size in points,
 * the dependency-free PDF writer's byte layout (header, objects, xref offsets,
 * embedded JPEG), its input validation, the JPEG rasterize path, and the
 * "Download PDF" button end to end with a stubbed Image and canvas (jsdom has
 * neither).
 */

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ArgumentTreeNode } from "@debate-ai/round/src/flow/argument-tree";
import { buildArgumentMap } from "../src/flow/argument-map";
import ArgumentMapChart from "../src/panels/argument-map/ArgumentMapChart";
import {
  ARGUMENT_MAP_PDF_JPEG_QUALITY,
  argumentMapPdfFilename,
  argumentMapPdfPageSize,
  argumentMapToPdf,
  buildImagePdf,
} from "../src/panels/argument-map/export-pdf";
import { rasterizeSvgToImage, type RasterizeDeps } from "../src/panels/argument-map/export-png";
import { click, mount, type Mounted } from "./helpers/mount";

/** A tiny fake JPEG: SOI marker, a few payload bytes (including non-ASCII ones), EOI marker. */
const JPEG = new Uint8Array([0xff, 0xd8, 0x00, 0x7f, 0x80, 0xfe, 0x0a, 0xff, 0xd9]);

function svgWith(attrs: Record<string, string>): Element {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [name, value] of Object.entries(attrs)) svg.setAttribute(name, value);
  return svg;
}

/** Latin-1 view of PDF bytes, so byte offsets equal string indexes. */
function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe("argumentMapPdfFilename", () => {
  it("uses the SVG slug rule with a .pdf extension", () => {
    expect(argumentMapPdfFilename("  Round #4 / Finals ", "mindmap")).toBe("argument-map-round-4-finals-mindmap.pdf");
    expect(argumentMapPdfFilename("", "tree")).toBe("argument-map-round-tree.pdf");
  });
});

describe("argumentMapPdfPageSize", () => {
  it("converts the on-screen CSS size to points (96 px = 72 pt)", () => {
    expect(argumentMapPdfPageSize(svgWith({ width: "400", height: "200" }))).toEqual({ width: 300, height: 150 });
  });

  it("falls back to the viewBox and is not clamped like the raster", () => {
    expect(argumentMapPdfPageSize(svgWith({ viewBox: "0 0 8000 100" }))).toEqual({ width: 6000, height: 75 });
  });

  it("returns null when there is no usable size", () => {
    expect(argumentMapPdfPageSize(svgWith({}))).toBeNull();
  });
});

describe("buildImagePdf", () => {
  const pdf = buildImagePdf(JPEG, { width: 800, height: 400 }, { width: 300, height: 150 });
  const text = latin1(pdf);

  it("starts with a PDF header and ends with %%EOF", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });

  it("sizes the page in points and scales the image to fill it", () => {
    expect(text).toContain("/MediaBox [0 0 300 150]");
    expect(text).toContain("q 300 0 0 150 0 0 cm /Im0 Do Q");
  });

  it("embeds the JPEG verbatim as a DCTDecode image with its pixel size and length", () => {
    expect(text).toContain("/Width 800 /Height 400");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain(`/Length ${JPEG.length} >>\nstream\n`);
    expect(indexOfBytes(pdf, JPEG)).toBeGreaterThan(0);
  });

  it("writes an xref table whose offsets point at each object", () => {
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 5)).toBe("xref\n");
    const entries = text.slice(startxref).split("\n").slice(3, 8);
    expect(entries).toHaveLength(5);
    entries.forEach((entry, index) => {
      expect(entry).toMatch(/^\d{10} 00000 n $/);
      const offset = Number(entry.slice(0, 10));
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
    expect(text).toContain("trailer\n<< /Size 6 /Root 1 0 R >>");
  });

  it("gives the content stream its exact byte length", () => {
    const match = /<< \/Length (\d+) >>\nstream\n([^\n]*)\nendstream/.exec(text);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(match?.[2].length);
  });

  it("rejects bytes that are not a JPEG", () => {
    expect(() => buildImagePdf(new Uint8Array([0x89, 0x50]), { width: 1, height: 1 }, { width: 1, height: 1 })).toThrow(
      /JPEG bytes/,
    );
    expect(() => buildImagePdf(new Uint8Array(), { width: 1, height: 1 }, { width: 1, height: 1 })).toThrow(/JPEG/);
  });

  it("rejects sizes that are not positive integers", () => {
    expect(() => buildImagePdf(JPEG, { width: 0, height: 1 }, { width: 1, height: 1 })).toThrow(/positive integer/);
    expect(() => buildImagePdf(JPEG, { width: 1, height: 1 }, { width: 1.5, height: 1 })).toThrow(/positive integer/);
  });
});

function fakeCanvas(blob: Blob | null = new Blob([JPEG], { type: "image/jpeg" })) {
  const calls: string[] = [];
  const context = {
    fillStyle: "",
    fillRect: vi.fn(() => calls.push(`fill ${context.fillStyle}`)),
    drawImage: vi.fn(() => calls.push("draw")),
  };
  const canvas = {
    getContext: vi.fn(() => context),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blob)),
  };
  return { canvas, context, calls };
}

describe("rasterizeSvgToImage (JPEG)", () => {
  it("paints white before drawing and passes the type and quality to toBlob", async () => {
    const { canvas, calls } = fakeCanvas();
    const deps: RasterizeDeps = {
      loadImage: async () => ({}) as CanvasImageSource,
      createCanvas: () => canvas as unknown as HTMLCanvasElement,
    };
    await rasterizeSvgToImage("<svg/>", { width: 4, height: 2 }, "image/jpeg", deps, 0.5);
    expect(calls).toEqual(["fill #ffffff", "draw"]);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.5);
  });

  it("names the format when encoding fails", async () => {
    const deps: RasterizeDeps = {
      loadImage: async () => ({}) as CanvasImageSource,
      createCanvas: () => fakeCanvas(null).canvas as unknown as HTMLCanvasElement,
    };
    await expect(rasterizeSvgToImage("<svg/>", { width: 1, height: 1 }, "image/jpeg", deps)).rejects.toThrow(
      /encoded as a JPEG/,
    );
  });
});

describe("argumentMapToPdf", () => {
  it("rasterizes at 2x and wraps the JPEG in a page the chart's size", async () => {
    const { canvas } = fakeCanvas();
    const createCanvas = vi.fn(() => canvas as unknown as HTMLCanvasElement);
    const blob = await argumentMapToPdf(svgWith({ width: "400", height: "200" }), "<svg/>", {
      loadImage: async () => ({}) as CanvasImageSource,
      createCanvas,
    });
    expect(createCanvas).toHaveBeenCalledWith(800, 400);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", ARGUMENT_MAP_PDF_JPEG_QUALITY);
    expect(blob.type).toBe("application/pdf");
    const text = latin1(await blobBytes(blob));
    expect(text).toContain("/MediaBox [0 0 300 150]");
    expect(text).toContain("/Width 800 /Height 400");
  });

  it("rejects when the chart has no size", async () => {
    await expect(argumentMapToPdf(svgWith({}), "<svg/>")).rejects.toThrow(/no size/);
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

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(mounted?.container.querySelectorAll("button") ?? []).find((b) =>
    b.textContent?.includes(label),
  );
  expect(button).toBeDefined();
  return button as HTMLButtonElement;
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("ArgumentMapChart Download PDF", () => {
  it("rasterizes the current view as JPEG and downloads a .pdf", async () => {
    vi.stubGlobal("Image", LoadingImage);
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb, type) {
      cb(new Blob([JPEG], { type }));
    });
    const blobs: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:pdf";
      }),
      revokeObjectURL: vi.fn(),
    });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    mounted = await mount(
      <ArgumentMapChart root={buildArgumentMap(TREE, "Round r1")} mode="tree" focusId="root" onFocus={() => {}} />,
    );
    const button = findButton("Download PDF");
    await click(button);
    await flush();

    expect(LoadingImage.sources).toHaveLength(1);
    expect(decodeURIComponent(LoadingImage.sources[0].split(",")[1])).toContain("Plan boosts GDP");
    expect(context.drawImage).toHaveBeenCalledTimes(1);
    expect(downloads).toEqual(["argument-map-round-r1-tree.pdf"]);
    expect(blobs[0].type).toBe("application/pdf");
    expect(latin1(await blobBytes(blobs[0])).startsWith("%PDF-1.4")).toBe(true);
    expect(button.disabled).toBe(false);
    expect(findButton("Download PNG").disabled).toBe(false);
    expect(mounted?.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("shows an error and suggests SVG when the image cannot be decoded", async () => {
    vi.stubGlobal("Image", LoadingImage);
    LoadingImage.fail = true;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    mounted = await mount(
      <ArgumentMapChart root={buildArgumentMap(TREE, "Round r1")} mode="tree" focusId="root" onFocus={() => {}} />,
    );
    const button = findButton("Download PDF");
    await click(button);
    await flush();

    const alert = mounted?.container.querySelector('[role="alert"]');
    expect(alert?.textContent).toMatch(/could not be loaded.*Try Download SVG instead/);
    expect(clickSpy).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });
});
