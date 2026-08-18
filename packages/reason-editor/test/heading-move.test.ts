import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { schema } from "../src/engine/schema/index";
import { buildHeadingOutline } from "../src/engine/outline/heading-outline";
import {
  buildMoveHeadingSectionTransaction,
  findHeadingAtPos,
} from "../src/engine/outline/heading-move";

/** Case > Off (DA > paragraph) > AC (Framework > paragraph) — same fixture
 *  shape as heading-outline.test.ts/collapsed-headings-plugin.test.ts. */
function buildDoc() {
  return schema.node("doc", null, [
    schema.node("pocket", { id: "case" }, schema.text("Case")),
    schema.node("hat", { id: "off" }, schema.text("Off")),
    schema.node("block", { id: "da" }, schema.text("DA")),
    schema.node("paragraph", null, schema.text("DA intro")),
    schema.node("hat", { id: "ac" }, schema.text("AC")),
    schema.node("block", { id: "fw" }, schema.text("Framework")),
    schema.node("paragraph", null, schema.text("FW text")),
  ]);
}

function stateFor(doc: ReturnType<typeof buildDoc>) {
  return EditorState.create({ schema, doc });
}

/** Every top-level node's type name, in document order. */
function topLevelTypes(doc: ReturnType<typeof buildDoc>): string[] {
  const types: string[] = [];
  doc.forEach((node) => types.push(node.type.name));
  return types;
}

describe("buildMoveHeadingSectionTransaction", () => {
  it("swaps a heading's section down past the next heading's whole section", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);

    const tr = buildMoveHeadingSectionTransaction(state, outline, "da", "down");
    expect(tr).not.toBeNull();

    const next = state.apply(tr!).doc;
    expect(topLevelTypes(next)).toEqual(["pocket", "hat", "hat", "block", "paragraph", "block", "paragraph"]);
    // "ac"'s section (just the hat node — "fw" is itself the next heading,
    // so it isn't part of "ac"'s section) now comes right after "off",
    // ahead of "da"'s section (block + paragraph), which follows it.
    const outlineAfter = buildHeadingOutline(next);
    expect(outlineAfter.map((h) => h.id)).toEqual(["case", "off", "ac", "da", "fw"]);
  });

  it("swaps a heading's section up with the previous heading's whole section", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);

    const tr = buildMoveHeadingSectionTransaction(state, outline, "ac", "up");
    expect(tr).not.toBeNull();

    const next = state.apply(tr!).doc;
    const outlineAfter = buildHeadingOutline(next);
    expect(outlineAfter.map((h) => h.id)).toEqual(["case", "off", "ac", "da", "fw"]);
  });

  it("preserves each section's own content when swapping", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);

    const tr = buildMoveHeadingSectionTransaction(state, outline, "da", "down");
    const next = state.apply(tr!).doc;

    // "da"'s own paragraph text travels with its heading to the new
    // position, right after it; "fw"'s section is untouched at the end.
    const types = topLevelTypes(next);
    const daIndex = types.indexOf("block");
    expect(next.child(daIndex + 1).textContent).toBe("DA intro");
    expect(next.child(next.childCount - 1).textContent).toBe("FW text");
  });

  it("returns null when moving the first heading up", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);
    expect(buildMoveHeadingSectionTransaction(state, outline, "case", "up")).toBeNull();
  });

  it("returns null when moving the last heading down", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);
    expect(buildMoveHeadingSectionTransaction(state, outline, "fw", "down")).toBeNull();
  });

  it("returns null for an unknown heading id", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);
    expect(buildMoveHeadingSectionTransaction(state, outline, "nope", "down")).toBeNull();
  });
});

describe("findHeadingAtPos", () => {
  it("returns the heading whose section contains the position", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);
    const daHeading = outline.find((h) => h.id === "da")!;

    // A position inside the "DA intro" paragraph, after the "da" heading.
    const posInSection = daHeading.endPos + 2;
    expect(findHeadingAtPos(outline, posInSection)?.id).toBe("da");
  });

  it("returns the heading itself when the position is on the heading", () => {
    const state = stateFor(buildDoc());
    const outline = buildHeadingOutline(state.doc);
    const offHeading = outline.find((h) => h.id === "off")!;
    expect(findHeadingAtPos(outline, offHeading.pos)?.id).toBe("off");
  });

  it("returns null when the document has no headings", () => {
    expect(findHeadingAtPos([], 5)).toBeNull();
  });
});
