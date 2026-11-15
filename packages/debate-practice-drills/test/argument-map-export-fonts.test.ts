// @vitest-environment jsdom
/**
 * @fileoverview The argument map's export font: the page's stack is named,
 * the matching `@font-face` rules are found (readable and cross-origin
 * sheets), only the faces the labels need are kept, their files are inlined
 * as `data:` URLs under a size cap, and every failure falls back quietly.
 */

import { describe, expect, it, vi } from "vitest";

import {
  ARGUMENT_MAP_FALLBACK_FONT_STACK,
  buildEmbeddedFontCss,
  bytesToBase64,
  collectFontFaces,
  exportFontStack,
  fontWeightIncludes,
  parseFontFaceRules,
  pickFontFaces,
  primaryFontFamily,
  resolveArgumentMapExportFont,
  unicodeRangeCovers,
  type FontFaceSource,
  type StyleSheetLike,
} from "../src/panels/argument-map/export-fonts";
import { buildArgumentMapSvg } from "../src/panels/argument-map/export-svg";

const GOOGLE_CSS = `/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/latin-ext.woff2) format('woff2');
  unicode-range: U+0100-02AF, U+1E00-1EFF;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+2000-206F;
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/inter/latin-700.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/inter/latin-italic.woff2) format('woff2');
}
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 400 800;
  src: url(/fonts/garamond.woff2) format("woff2");
}
@font-face { font-family: 'Local Only'; src: local('Arial'); }
@font-face { src: url(/fonts/nameless.woff2); }`;

function face(overrides: Partial<FontFaceSource> = {}): FontFaceSource {
  return {
    family: "Inter",
    style: "normal",
    weight: "400",
    unicodeRange: null,
    url: "https://fonts.example/inter.woff2",
    format: "woff2",
    ...overrides,
  };
}

describe("primaryFontFamily / exportFontStack", () => {
  it("returns the first named family, unquoted, skipping generic ones", () => {
    expect(primaryFontFamily('"EB Garamond", Georgia, serif')).toBe("EB Garamond");
    expect(primaryFontFamily("system-ui, 'Open Sans', sans-serif")).toBe("Open Sans");
    expect(primaryFontFamily("Inter")).toBe("Inter");
    expect(primaryFontFamily("ui-sans-serif, system-ui, sans-serif")).toBeNull();
    expect(primaryFontFamily("")).toBeNull();
  });

  it("keeps a comma inside a quoted family name", () => {
    expect(primaryFontFamily('"Odd, Name", serif')).toBe("Odd, Name");
  });

  it("names the page stack before the fallback, or only the fallback", () => {
    expect(exportFontStack("Inter")).toBe(`Inter, ${ARGUMENT_MAP_FALLBACK_FONT_STACK}`);
    expect(exportFontStack("")).toBe(ARGUMENT_MAP_FALLBACK_FONT_STACK);
    expect(exportFontStack(null)).toBe(ARGUMENT_MAP_FALLBACK_FONT_STACK);
    expect(exportFontStack("sans-serif")).toBe(ARGUMENT_MAP_FALLBACK_FONT_STACK);
    expect(exportFontStack("var(--app-font)")).toBe(ARGUMENT_MAP_FALLBACK_FONT_STACK);
  });
});

describe("parseFontFaceRules", () => {
  it("reads family, style, weight, range, first url and format; skips sourceless rules", () => {
    const faces = parseFontFaceRules(GOOGLE_CSS, "https://debate-ai.com/app.css");
    expect(faces.map((f) => f.family)).toEqual(["Inter", "Inter", "Inter", "Inter", "EB Garamond"]);
    expect(faces[1]).toEqual({
      family: "Inter",
      style: "normal",
      weight: "400",
      unicodeRange: "U+0000-00FF, U+0131, U+2000-206F",
      url: "https://fonts.gstatic.com/s/inter/latin.woff2",
      format: "woff2",
    });
    expect(faces[3].style).toBe("italic");
    expect(faces[4]).toMatchObject({ weight: "400 800", url: "https://debate-ai.com/fonts/garamond.woff2" });
  });

  it("skips faces already inlined as data: URLs", () => {
    expect(parseFontFaceRules("@font-face{font-family:X;src:url(data:font/woff2;base64,AAAA)}")).toEqual([]);
  });
});

describe("unicodeRangeCovers / fontWeightIncludes", () => {
  it("matches single code points, ranges and wildcards; ignores whitespace", () => {
    expect(unicodeRangeCovers("U+0000-00FF", "Plan boosts GDP")).toBe(true);
    expect(unicodeRangeCovers("U+0100-02AF", "Plan boosts GDP")).toBe(false);
    expect(unicodeRangeCovers("U+0131", "ı")).toBe(true);
    expect(unicodeRangeCovers("U+4??", "А")).toBe(true);
    expect(unicodeRangeCovers("U+0041", "   ")).toBe(false);
    expect(unicodeRangeCovers(null, "anything")).toBe(true);
  });

  it("handles single weights, keywords and variable ranges", () => {
    expect(fontWeightIncludes("400", 400)).toBe(true);
    expect(fontWeightIncludes("700", 400)).toBe(false);
    expect(fontWeightIncludes("normal", 400)).toBe(true);
    expect(fontWeightIncludes("bold", 700)).toBe(true);
    expect(fontWeightIncludes("400 800", 600)).toBe(true);
    expect(fontWeightIncludes("400 800", 300)).toBe(false);
    expect(fontWeightIncludes("heavy", 400)).toBe(false);
  });
});

describe("pickFontFaces", () => {
  const faces = parseFontFaceRules(GOOGLE_CSS);

  it("keeps the upright faces of the family, in the used weights, that cover the text", () => {
    const picked = pickFontFaces(faces, "inter", "Plan boosts GDP");
    expect(picked.map((f) => f.url)).toEqual(["https://fonts.gstatic.com/s/inter/latin.woff2"]);
  });

  it("adds a weight's faces when the text uses it", () => {
    const picked = pickFontFaces(faces, "Inter", "Plan", [400, 700]);
    expect(picked.map((f) => f.url)).toEqual([
      "https://fonts.gstatic.com/s/inter/latin.woff2",
      "https://fonts.gstatic.com/s/inter/latin-700.woff2",
    ]);
  });

  it("keeps a duplicate file once and returns nothing for an unknown family", () => {
    expect(pickFontFaces([face(), face()], "Inter", "x")).toHaveLength(1);
    expect(pickFontFaces(faces, "Lato", "x")).toEqual([]);
  });
});

describe("collectFontFaces", () => {
  it("parses readable sheets and fetches cross-origin ones by href", async () => {
    const readable: StyleSheetLike = {
      href: null,
      cssRules: [{ cssText: "@font-face { font-family: Local; src: url(/f.woff2); }" }, { cssText: "body{}" }],
    };
    const crossOrigin: StyleSheetLike = {
      href: "https://fonts.googleapis.com/css2?family=Inter",
      get cssRules(): ArrayLike<{ cssText: string }> {
        throw new DOMException("cross-origin", "SecurityError");
      },
    };
    const fetchText = vi.fn(async () => GOOGLE_CSS);
    const faces = await collectFontFaces([readable, crossOrigin], fetchText, "https://debate-ai.com/");
    expect(fetchText).toHaveBeenCalledWith("https://fonts.googleapis.com/css2?family=Inter");
    expect(faces[0]).toMatchObject({ family: "Local", url: "https://debate-ai.com/f.woff2" });
    expect(faces.filter((f) => f.family === "Inter")).toHaveLength(4);
  });

  it("skips a sheet that can't be read or fetched", async () => {
    const blocked: StyleSheetLike = {
      href: "https://cdn.example/x.css",
      get cssRules(): ArrayLike<{ cssText: string }> {
        throw new Error("blocked");
      },
    };
    const inline: StyleSheetLike = {
      href: null,
      get cssRules(): ArrayLike<{ cssText: string }> {
        throw new Error("blocked");
      },
    };
    const fetchText = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(collectFontFaces([blocked, inline], fetchText)).resolves.toEqual([]);
    expect(fetchText).toHaveBeenCalledTimes(1);
  });
});

describe("buildEmbeddedFontCss", () => {
  it("inlines each file as a base64 data: URL with its range and format", async () => {
    const css = await buildEmbeddedFontCss(
      [face({ unicodeRange: "U+0000-00FF" })],
      async () => new Uint8Array([1, 2, 3]).buffer,
    );
    expect(css).toBe(
      '@font-face{font-family:"Inter";font-style:normal;font-weight:400;unicode-range:U+0000-00FF;' +
        'src:url(data:font/woff2;base64,AQID) format("woff2");}',
    );
  });

  it("guesses the type from the extension and escapes the family name", async () => {
    const css = await buildEmbeddedFontCss(
      [face({ family: 'My "Font"', format: null, url: "https://x.example/f.ttf?v=2" })],
      async () => new Uint8Array([0]).buffer,
    );
    expect(css).toContain('font-family:"My \\"Font\\""');
    expect(css).toContain('src:url(data:font/ttf;base64,AA==) format("truetype")');
  });

  it("leaves out faces that fail to fetch, are empty, or pass the size cap", async () => {
    const files: Record<string, number> = { a: 6, b: 0, c: 5, d: 4 };
    const css = await buildEmbeddedFontCss(
      ["a", "b", "c", "d", "e"].map((k) => face({ url: `https://x.example/${k}.woff2` })),
      async (url) => {
        const key = url.slice(-7, -6);
        if (!(key in files)) throw new Error("404");
        return new Uint8Array(files[key]).buffer;
      },
      10,
    );
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain(bytesToBase64(new Uint8Array(6)));
    expect(css).toContain(bytesToBase64(new Uint8Array(4)));
  });

  it("base64-encodes large inputs without overflowing", () => {
    const big = new Uint8Array(200_000).fill(65);
    expect(atob(bytesToBase64(big))).toHaveLength(200_000);
  });
});

function chart(): Element {
  const holder = document.createElement("div");
  holder.innerHTML = `<svg viewBox="0 0 10 10"><text>Plan boosts GDP</text></svg>`;
  return holder.firstElementChild as Element;
}

describe("resolveArgumentMapExportFont", () => {
  it("names the page font and embeds the faces the labels need", async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([9, 9]).buffer);
    const font = await resolveArgumentMapExportFont(chart(), {
      fontFamilyOf: () => "Inter",
      sheets: [{ href: null, cssRules: [{ cssText: GOOGLE_CSS }] }],
      fetchText: async () => "",
      fetchBytes,
    });
    expect(font.fontFamily).toBe(`Inter, ${ARGUMENT_MAP_FALLBACK_FONT_STACK}`);
    expect(fetchBytes).toHaveBeenCalledExactlyOnceWith("https://fonts.gstatic.com/s/inter/latin.woff2");
    expect(font.fontFaceCss).toContain("base64,CQk=");
  });

  it("embeds a bold face when the chart draws bold text", async () => {
    const svg = chart();
    svg.querySelector("text")?.setAttribute("font-weight", "bold");
    const fetchBytes = vi.fn(async () => new Uint8Array([1]).buffer);
    await resolveArgumentMapExportFont(svg, {
      fontFamilyOf: () => "Inter",
      sheets: [{ href: null, cssRules: [{ cssText: GOOGLE_CSS }] }],
      fetchBytes,
    });
    expect(fetchBytes).toHaveBeenCalledTimes(2);
  });

  it("uses only the fallback stack, fetching nothing, when the page names no family", async () => {
    const fetchBytes = vi.fn();
    const font = await resolveArgumentMapExportFont(chart(), { fontFamilyOf: () => "sans-serif", fetchBytes });
    expect(font).toEqual({ fontFamily: ARGUMENT_MAP_FALLBACK_FONT_STACK, fontFaceCss: "" });
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it("keeps the page stack but embeds nothing when collecting fonts throws", async () => {
    const font = await resolveArgumentMapExportFont(chart(), {
      fontFamilyOf: () => "Lato",
      sheets: {
        [Symbol.iterator]() {
          throw new Error("boom");
        },
      },
    });
    expect(font).toEqual({ fontFamily: `Lato, ${ARGUMENT_MAP_FALLBACK_FONT_STACK}`, fontFaceCss: "" });
  });

  it("falls back when reading the computed style throws", async () => {
    const font = await resolveArgumentMapExportFont(chart(), {
      fontFamilyOf: () => {
        throw new Error("detached");
      },
    });
    expect(font.fontFamily).toBe(ARGUMENT_MAP_FALLBACK_FONT_STACK);
  });
});

describe("buildArgumentMapSvg with a font", () => {
  it("names the font and puts the embedded faces in a leading <style>", () => {
    const css = '@font-face{font-family:"Inter";src:url(data:font/woff2;base64,AQID) format("woff2");}';
    const markup = buildArgumentMapSvg(chart(), undefined, { fontFamily: "Inter, sans-serif", fontFaceCss: css });
    const holder = document.createElement("div");
    holder.innerHTML = markup.replace(/^<\?xml[^>]*>\n/, "");
    const out = holder.firstElementChild as Element;
    expect(out.getAttribute("font-family")).toBe("Inter, sans-serif");
    expect(out.firstElementChild?.localName).toBe("style");
    expect(out.firstElementChild?.textContent).toBe(css);
  });

  it("adds no <style> without embedded faces and keeps the fallback stack without a font", () => {
    const withFamily = buildArgumentMapSvg(chart(), undefined, { fontFamily: "Inter", fontFaceCss: "" });
    expect(withFamily).not.toContain("<style");
    expect(withFamily).toContain('font-family="Inter"');
    expect(buildArgumentMapSvg(chart())).toContain(`font-family="${ARGUMENT_MAP_FALLBACK_FONT_STACK}"`);
  });
});
