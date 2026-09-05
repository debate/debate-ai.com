/**
 * @fileoverview Regression tests for the videos sidebar icon discriminator.
 *
 * The bug these pin down: `lucide-react` builds every icon with
 * `React.forwardRef`, so a Lucide icon is an object, not a function. The
 * sidebar's original `typeof icon === "function"` test therefore classified
 * every Lucide icon as an *image* and handed it to `next/image`, which read
 * `src.src` (undefined) and called `undefined.startsWith("http://")` —
 * crashing the whole `/videos` route into the error boundary.
 */

import { describe, it, expect } from "vitest";
import { forwardRef, memo, createElement } from "react";
import { GraduationCap, Library, Dumbbell } from "lucide-react";
import {
  isImageIcon,
  isComponentIcon,
} from "../src/components/category-gallery/tree-item-icon";

describe("isImageIcon", () => {
  it("accepts a URL string", () => {
    expect(isImageIcon("/assets/icon-book-Co8jqSei.svg")).toBe(true);
    expect(isImageIcon("https://i.imgur.com/cFmTAdJ.png")).toBe(true);
  });

  it("accepts a StaticImageData object", () => {
    expect(isImageIcon({ src: "/assets/x.png", width: 16, height: 16 })).toBe(true);
  });

  it("rejects an empty string, null and undefined", () => {
    expect(isImageIcon("")).toBe(false);
    expect(isImageIcon(null)).toBe(false);
    expect(isImageIcon(undefined)).toBe(false);
  });

  it("rejects Lucide icons, which are forwardRef objects", () => {
    // The precise shape that used to slip through and crash /videos.
    expect(typeof GraduationCap).not.toBe("function");
    for (const icon of [GraduationCap, Library, Dumbbell]) {
      expect(isImageIcon(icon)).toBe(false);
    }
  });

  it("rejects other component shapes", () => {
    const Fn = () => createElement("span");
    const Fwd = forwardRef(() => createElement("span"));
    const Memo = memo(Fn);
    for (const component of [Fn, Fwd, Memo]) {
      expect(isImageIcon(component as never)).toBe(false);
    }
  });
});

describe("isComponentIcon", () => {
  it("accepts every Lucide icon used by the sidebar tool sections", () => {
    for (const icon of [GraduationCap, Library, Dumbbell]) {
      expect(isComponentIcon(icon)).toBe(true);
    }
  });

  it("rejects image sources and absent icons", () => {
    expect(isComponentIcon("/assets/icon-book.svg")).toBe(false);
    expect(isComponentIcon({ src: "/assets/x.png" } as never)).toBe(false);
    expect(isComponentIcon(null)).toBe(false);
    expect(isComponentIcon(undefined)).toBe(false);
  });

  it("is mutually exclusive with isImageIcon", () => {
    const cases = [
      "/assets/icon-book.svg",
      { src: "/assets/x.png" },
      GraduationCap,
      Library,
      Dumbbell,
      null,
      undefined,
      "",
    ];
    for (const value of cases) {
      expect(isImageIcon(value as never) && isComponentIcon(value as never)).toBe(false);
    }
  });
});
