import { describe, expect, it } from "vitest";
import { Dumbbell, GraduationCap, Library } from "lucide-react";
import { isImageIconSource } from "../src/components/category-gallery/icon-kind";
import { SIDEBAR_TOOL_SECTIONS } from "../src/components/category-gallery/sidebar-tool-sections";

describe("isImageIconSource", () => {
  it("accepts bundler-resolved image URLs", () => {
    expect(isImageIconSource("/assets/icon-trophy-mL0HiAdO.svg")).toBe(true);
    expect(isImageIconSource("https://i.imgur.com/cFmTAdJ.png")).toBe(true);
  });

  it("accepts StaticImageData objects", () => {
    expect(isImageIconSource({ src: "/assets/icon-book.svg", width: 16, height: 16 })).toBe(true);
  });

  it("rejects Lucide icons, which are forwardRef objects rather than functions", () => {
    // The regression this guards: `typeof icon === "function"` is false for a
    // forwardRef icon, so the component reached `next/image` and threw
    // "Cannot read properties of undefined (reading 'startsWith')".
    expect(typeof GraduationCap).not.toBe("function");
    for (const icon of [GraduationCap, Library, Dumbbell]) {
      expect(isImageIconSource(icon)).toBe(false);
    }
  });

  it("rejects plain function components", () => {
    const PlainGlyph = () => null;
    expect(isImageIconSource(PlainGlyph as never)).toBe(false);
  });

  it("rejects missing and empty icons", () => {
    expect(isImageIconSource(undefined)).toBe(false);
    expect(isImageIconSource(null)).toBe(false);
    expect(isImageIconSource("")).toBe(false);
  });

  it("keeps every sidebar tool section's icon off the next/image path", () => {
    expect(SIDEBAR_TOOL_SECTIONS.length).toBeGreaterThan(0);
    for (const section of SIDEBAR_TOOL_SECTIONS) {
      expect(isImageIconSource(section.icon)).toBe(false);
    }
  });
});
