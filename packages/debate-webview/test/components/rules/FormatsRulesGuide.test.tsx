/**
 * @fileoverview The `/practice/rules` guide lists World Schools apart from
 * Parliamentary / BP, with the motion-based text they share under its own heading.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormatsRulesGuide } from "../../../src/components/rules/FormatsRulesGuide";

const html = renderToStaticMarkup(<FormatsRulesGuide />);

function headings(level: "h3"): string[] {
  return [...html.matchAll(new RegExp(`<${level}[^>]*>(.*?)</${level}>`, "g"))].map((m) => m[1]);
}

describe("FormatsRulesGuide", () => {
  it("lists World Schools and Parliamentary / BP as separate format cards", () => {
    const titles = headings("h3");
    expect(titles).toContain("World Schools");
    expect(titles).toContain("Parliamentary / BP");
    expect(titles).not.toContain("World Schools / Parliamentary / BP");
  });

  it("gives the shared motion-based text, World Schools and Parli / BP their own rules entries", () => {
    const titles = headings("h3");
    expect(titles).toContain("World Schools, Parliamentary &amp; British Parliamentary");
    expect(titles).toContain("World Schools");
    expect(titles).toContain("Parliamentary &amp; British Parliamentary (Parli)");
  });

  it("keeps BP-specific rules out of World Schools", () => {
    const worldSchools = html.slice(html.indexOf("In World Schools, points of information"));
    const parli = html.indexOf("In BP, closing teams");
    expect(parli).toBeGreaterThan(html.indexOf("In World Schools, points of information"));
    expect(worldSchools.indexOf("Parliamentary &amp; British Parliamentary (Parli)")).toBeLessThan(
      worldSchools.indexOf("In BP, closing teams"),
    );
  });
});
