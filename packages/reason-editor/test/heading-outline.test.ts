import { describe, expect, it } from "vitest";
import { schema } from "../src/engine/schema/index";
import {
  buildHeadingOutline,
  getCollapsedRanges,
  getVisibleHeadingIds,
  isPositionCollapsed,
  type OutlineHeading,
} from "../src/engine/outline/heading-outline";

/** Case > Off (DA > [card: Link turn]) > AC (Framework) */
function buildDoc() {
  return schema.node("doc", null, [
    schema.node("pocket", { id: "case" }, schema.text("Case")),
    schema.node("hat", { id: "off" }, schema.text("Off")),
    schema.node("block", { id: "da" }, schema.text("DA")),
    schema.node("paragraph", null, schema.text("DA intro")),
    schema.node("card", null, [
      schema.node("tag", { id: "tag1" }, schema.text("Link turn")),
      schema.node("card_body", null, schema.text("Body text")),
    ]),
    schema.node("hat", { id: "ac" }, schema.text("AC")),
    schema.node("block", { id: "fw" }, schema.text("Framework")),
    schema.node("paragraph", null, schema.text("FW text")),
  ]);
}

describe("buildHeadingOutline", () => {
  it("collects headings in document order with levels and text", () => {
    const outline = buildHeadingOutline(buildDoc());
    expect(outline.map((h) => [h.id, h.type, h.level, h.text])).toEqual([
      ["case", "pocket", 1, "Case"],
      ["off", "hat", 2, "Off"],
      ["da", "block", 3, "DA"],
      ["tag1", "tag", 4, "Link turn"],
      ["ac", "hat", 2, "AC"],
      ["fw", "block", 3, "Framework"],
    ]);
  });

  it("ignores non-heading nodes like paragraph and card_body", () => {
    const outline = buildHeadingOutline(buildDoc());
    expect(outline.some((h) => h.type === "paragraph" || h.type === "card_body")).toBe(false);
  });

  it("falls back to a position-keyed id for un-stamped headings", () => {
    const doc = schema.node("doc", null, [schema.node("pocket", null, schema.text("Untitled"))]);
    const outline = buildHeadingOutline(doc);
    expect(outline).toHaveLength(1);
    expect(outline[0]?.id).toBe("pos-0");
  });
});

describe("getVisibleHeadingIds", () => {
  const outline = buildHeadingOutline(buildDoc());

  it("shows every heading when nothing is collapsed", () => {
    expect(getVisibleHeadingIds(outline, [])).toEqual(
      new Set(["case", "off", "da", "tag1", "ac", "fw"]),
    );
  });

  it("hides descendants nested under a collapsed heading but keeps it visible", () => {
    expect(getVisibleHeadingIds(outline, ["off"])).toEqual(
      new Set(["case", "off", "ac", "fw"]),
    );
  });

  it("collapsing the top-level heading hides the rest of the document", () => {
    expect(getVisibleHeadingIds(outline, ["case"])).toEqual(new Set(["case"]));
  });

  it("a deeper collapse only hides its own subtree", () => {
    expect(getVisibleHeadingIds(outline, ["da"])).toEqual(
      new Set(["case", "off", "da", "ac", "fw"]),
    );
  });

  it("composes multiple independent collapses", () => {
    expect(getVisibleHeadingIds(outline, ["off", "fw"])).toEqual(
      new Set(["case", "off", "ac", "fw"]),
    );
  });

  it("accepts a Set as well as an array", () => {
    expect(getVisibleHeadingIds(outline, new Set(["off"]))).toEqual(
      new Set(["case", "off", "ac", "fw"]),
    );
  });
});

describe("getCollapsedRanges / isPositionCollapsed", () => {
  const doc = buildDoc();
  const outline = buildHeadingOutline(doc);

  function posOf(text: string): number {
    let found = -1;
    doc.descendants((node, pos) => {
      if (node.isText && node.text === text) found = pos;
      return true;
    });
    if (found === -1) throw new Error(`text not found: ${text}`);
    return found;
  }

  it("returns no ranges when nothing is collapsed", () => {
    expect(getCollapsedRanges(doc, outline, [])).toEqual([]);
  });

  it("hides content up to the next same-or-shallower heading", () => {
    const ranges = getCollapsedRanges(doc, outline, ["off"]);
    expect(ranges).toHaveLength(1);
    const range = ranges[0] as { headingId: string; from: number; to: number };
    expect(range.headingId).toBe("off");

    const acHeading = outline.find((h: OutlineHeading) => h.id === "ac");
    expect(range.to).toBe(acHeading?.pos);

    expect(isPositionCollapsed(posOf("DA intro"), ranges)).toBe(true);
    expect(isPositionCollapsed(posOf("Link turn"), ranges)).toBe(true);
    expect(isPositionCollapsed(posOf("AC"), ranges)).toBe(false);
    expect(isPositionCollapsed(posOf("FW text"), ranges)).toBe(false);
  });

  it("collapsing the outermost heading hides through the end of the doc", () => {
    const ranges = getCollapsedRanges(doc, outline, ["case"]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]?.to).toBe(doc.content.size);
    expect(isPositionCollapsed(posOf("FW text"), ranges)).toBe(true);
  });

  it("omits a range for a heading with no content to hide", () => {
    // "fw" is immediately followed by a paragraph, then the doc ends —
    // it does have trailing content, so it should still produce a range.
    // A heading with literally nothing after it (end of doc right at
    // endPos) should not produce a degenerate empty range.
    const trailingDoc = schema.node("doc", null, [
      schema.node("pocket", { id: "only" }, schema.text("Only")),
    ]);
    const trailingOutline = buildHeadingOutline(trailingDoc);
    expect(getCollapsedRanges(trailingDoc, trailingOutline, ["only"])).toEqual([]);
  });
});
