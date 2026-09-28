import { describe, expect, it } from "vitest";

import {
  FALLBACK_ACCENT_HUE,
  LOADING_ANIMATIONS,
  accentPalette,
  countSvgColors,
  hslToHex,
  parseAccentHue,
  pickLoadingAnimation,
  renderLoadingAnimation,
} from "../../../src/lib/ui/loading-animations";

/** The clips the overlay will not draw when it has to hold a first frame. */
const blank = LOADING_ANIMATIONS.filter((animation) => animation.blankAtStart);

describe("LOADING_ANIMATIONS", () => {
  it("offers every loader `grab-url/animations` ships, under unique ids", () => {
    expect(LOADING_ANIMATIONS).toHaveLength(17);
    expect(new Set(LOADING_ANIMATIONS.map((a) => a.id)).size).toBe(17);
  });

  it("draws real SVG for every clip in the list", () => {
    for (const animation of LOADING_ANIMATIONS) {
      const svg = animation.build({ raw: true });
      expect(svg.startsWith("<svg"), animation.id).toBe(true);
      expect(svg.includes("</svg>"), animation.id).toBe(true);
    }
  });

  it("flags exactly the clips whose first frame has nothing in it", () => {
    // The reduced-motion path holds a clip on frame 0, so a clip that starts
    // with every shape collapsed has to be flagged or it shows blank. Asserted
    // against the markup rather than the flag so a `grab-url` upgrade that
    // changes a clip's opening shapes fails here.
    const collapsed = LOADING_ANIMATIONS.filter((animation) => {
      const shapes =
        animation.build({ raw: true }).match(/<(?:circle|rect|ellipse)\b[^>]*>/g) ?? [];
      return shapes.length > 0 && shapes.every((shape) => /\br="0"/.test(shape));
    });
    expect(collapsed.map((a) => a.id)).toEqual(blank.map((a) => a.id));
  });
});

describe("pickLoadingAnimation", () => {
  it("spreads the draw across the whole list", () => {
    expect(pickLoadingAnimation({ random: () => 0 })).toBe(LOADING_ANIMATIONS[0]);
    expect(pickLoadingAnimation({ random: () => 0.999 })).toBe(
      LOADING_ANIMATIONS[LOADING_ANIMATIONS.length - 1],
    );
    expect(pickLoadingAnimation({ random: () => 0.5 }).id).toBe(
      LOADING_ANIMATIONS[Math.floor(0.5 * LOADING_ANIMATIONS.length)]?.id,
    );
  });

  it("leaves the blank-first-frame clips out of a held draw", () => {
    // Every point of the range, so the excluded clip cannot be reached by any
    // roll rather than merely being unlikely.
    expect(blank.length).toBeGreaterThan(0);
    for (let i = 0; i < 500; i += 1) {
      const animation = pickLoadingAnimation({ random: () => i / 500, staticFrame: true });
      expect(animation.blankAtStart).toBeFalsy();
    }
  });

  it("still draws from the full list when the clip will play", () => {
    const drawn = new Set(
      Array.from({ length: 500 }, (_, i) => pickLoadingAnimation({ random: () => i / 500 }).id),
    );
    expect(drawn.size).toBe(LOADING_ANIMATIONS.length);
  });

  it("returns a clip for a random source that breaks the [0, 1) contract", () => {
    // The failure this exists to catch: an out-of-range roll indexing past the
    // end and handing the overlay `undefined` to call `build` on.
    expect(pickLoadingAnimation({ random: () => 5 })).toBe(
      LOADING_ANIMATIONS[LOADING_ANIMATIONS.length - 1],
    );
    expect(pickLoadingAnimation({ random: () => -1 })).toBe(LOADING_ANIMATIONS[0]);
    expect(pickLoadingAnimation({ random: () => Number.NaN })).toBe(LOADING_ANIMATIONS[0]);
  });

  it("returns a clip from the real random source every time", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(LOADING_ANIMATIONS).toContain(pickLoadingAnimation());
    }
  });
});

describe("hslToHex", () => {
  it("converts the ramp's own triples", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
    expect(hslToHex(192, 80, 70)).toBe("#75d7f0");
  });

  it("collapses to grey at zero saturation and to the ends of the range", () => {
    expect(hslToHex(192, 0, 50)).toBe("#808080");
    expect(hslToHex(192, 80, 0)).toBe("#000000");
    expect(hslToHex(192, 80, 100)).toBe("#ffffff");
  });

  it("wraps the hue so a ramp offset past 360 lands where it should", () => {
    expect(hslToHex(380, 100, 50)).toBe(hslToHex(20, 100, 50));
    expect(hslToHex(-40, 100, 50)).toBe(hslToHex(320, 100, 50));
  });

  it("clamps saturation and lightness rather than emitting out-of-range bytes", () => {
    expect(hslToHex(192, 500, 50)).toBe(hslToHex(192, 100, 50));
    expect(hslToHex(192, 80, -20)).toBe("#000000");
  });

  it("always emits a six-digit hex literal, which is all grab-url substitutes", () => {
    for (let hue = 0; hue < 360; hue += 7) {
      expect(hslToHex(hue, 80, 70)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("countSvgColors", () => {
  it("counts every hex literal, which is what grab-url will replace", () => {
    expect(countSvgColors('<circle fill="#e15b64" />')).toBe(1);
    expect(countSvgColors('values="#d20962;#00a78e;#7ac143"')).toBe(3);
  });

  it("reads a six-digit literal as one colour, not a short one plus junk", () => {
    // The ordering trap in the pattern: `#[0-9a-f]{3}` first would match
    // `#aab` inside `#aabbcc` and leave `bcc` behind, doubling the count and
    // so the palette length asked for.
    expect(countSvgColors("#aabbcc")).toBe(1);
    expect(countSvgColors("#abc")).toBe(1);
  });

  it("counts nothing in markup with no colours in it", () => {
    expect(countSvgColors('<circle fill="none" stroke="none" />')).toBe(0);
  });
});

describe("accentPalette", () => {
  it("builds exactly as many colours as it is asked for", () => {
    expect(accentPalette(192, 3)).toHaveLength(3);
    expect(accentPalette(192, 32)).toHaveLength(32);
  });

  it("walks the wheel before it repeats a shade", () => {
    // Nine ramp entries, so the tenth colour is the first one again.
    const palette = accentPalette(192, 10);
    expect(new Set(palette.slice(0, 9)).size).toBe(9);
    expect(palette[9]).toBe(palette[0]);
  });

  it("emits only literals grab-url will substitute", () => {
    for (const color of accentPalette(192, 32)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("moves with the theme's hue", () => {
    expect(accentPalette(192, 4)).not.toEqual(accentPalette(300, 4));
  });

  it("returns an empty palette for a length there is nothing to colour", () => {
    // grab-url reads an empty array as "leave the colours alone", so a clip
    // with no hex literals keeps its own markup rather than throwing.
    expect(accentPalette(192, 0)).toEqual([]);
    expect(accentPalette(192, -1)).toEqual([]);
    expect(accentPalette(192, Number.NaN)).toEqual([]);
  });
});

describe("parseAccentHue", () => {
  it("reads the bare number the themes set", () => {
    expect(parseAccentHue("192")).toBe(192);
    expect(parseAccentHue(" 300 ")).toBe(300);
    expect(parseAccentHue("42.5")).toBe(42.5);
  });

  it("falls back when the property has not been applied yet", () => {
    // getPropertyValue returns "" for a property the browser has not resolved
    // on the element, which would otherwise parse to NaN and colour the clip
    // with "#NaNNaNNaN".
    expect(parseAccentHue("")).toBe(FALLBACK_ACCENT_HUE);
    expect(parseAccentHue("var(--something-else)")).toBe(FALLBACK_ACCENT_HUE);
  });

  it("wraps a hue set outside one turn of the wheel", () => {
    expect(parseAccentHue("400")).toBe(40);
    expect(parseAccentHue("-40")).toBe(320);
  });
});

describe("renderLoadingAnimation", () => {
  it("recolours every colour in the clip, leaving none of the package's own", () => {
    // The failure this exists to catch: grab-url substitutes in order and
    // stops when the palette runs out, so a fixed-length palette leaves the
    // tail of a 32-colour clip in its shipped colours.
    for (const animation of LOADING_ANIMATIONS) {
      const svg = renderLoadingAnimation(animation, { size: 200, hue: 192 });
      const shipped = new Set(
        animation.build({ raw: true }).match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g) ?? [],
      );
      const drawn = new Set(svg.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g) ?? []);
      expect(drawn.size, animation.id).toBeGreaterThan(0);
      for (const color of drawn) {
        expect(shipped.has(color), `${animation.id} kept ${color}`).toBe(false);
      }
    }
  });

  it("draws raw SVG rather than an <img> wrapping a data URI", () => {
    // The default: without `raw` the builders return an <img>, which cannot be
    // themed by the palette above or paused for reduced motion.
    const svg = renderLoadingAnimation(LOADING_ANIMATIONS[0]!, { size: 200 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.includes("<img")).toBe(false);
  });

  it("draws at the size it is given", () => {
    const svg = renderLoadingAnimation(LOADING_ANIMATIONS[0]!, { size: 64 });
    expect(svg).toContain('width="64px"');
    expect(svg).toContain('height="64px"');
  });

  it("keeps the viewBox, so the art scales into the box rather than cropping", () => {
    for (const animation of LOADING_ANIMATIONS) {
      expect(renderLoadingAnimation(animation, { size: 64 }), animation.id).toContain(
        'viewBox="0 0 100 100"',
      );
    }
  });

  it("carries no script for the overlay to inline", () => {
    // The markup goes through dangerouslySetInnerHTML, so this is the standing
    // check on what the dependency is handing over.
    for (const animation of LOADING_ANIMATIONS) {
      const svg = renderLoadingAnimation(animation, { size: 200 });
      expect(svg.toLowerCase(), animation.id).not.toContain("<script");
      expect(svg.toLowerCase(), animation.id).not.toContain("onload=");
    }
  });

  it("uses the stylesheet's own hue when none is given", () => {
    const animation = LOADING_ANIMATIONS[0]!;
    expect(renderLoadingAnimation(animation, { size: 200 })).toBe(
      renderLoadingAnimation(animation, { size: 200, hue: FALLBACK_ACCENT_HUE }),
    );
  });
});
