import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { schema } from "../src/engine/schema/index";
import {
  collapsedHeadingsKey,
  collapsedHeadingsPlugin,
  computeCollapsedHeadingsDecorations,
  getCollapsedHeadingIds,
  setCollapsedHeadingIdsMeta,
} from "../src/engine/outline/collapsed-headings-plugin";
import { buildHeadingOutline, getCollapsedRanges } from "../src/engine/outline/heading-outline";

/** Case > Off (DA > paragraph > [card: Link turn]) > AC (Framework) — same
 *  fixture shape as heading-outline.test.ts. */
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

function stateFor(doc: ReturnType<typeof buildDoc>) {
  return EditorState.create({ schema, doc, plugins: [collapsedHeadingsPlugin] });
}

/** Positions of every top-level node in `buildDoc()`'s doc, by index. */
function topLevelRanges(doc: ReturnType<typeof buildDoc>): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  doc.forEach((node, offset) => {
    ranges.push({ from: offset, to: offset + node.nodeSize });
  });
  return ranges;
}

describe("collapsedHeadingsPlugin state", () => {
  it("starts with no collapsed ids", () => {
    const state = stateFor(buildDoc());
    expect(getCollapsedHeadingIds(state)).toEqual([]);
  });

  it("sets collapsed ids from a tagged meta transaction", () => {
    const state = stateFor(buildDoc());
    const tr = state.tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(["off"]));
    const next = state.apply(tr);
    expect(getCollapsedHeadingIds(next)).toEqual(["off"]);
  });

  it("leaves collapsed ids unchanged on a transaction without the meta", () => {
    const state = stateFor(buildDoc());
    const withCollapse = state.apply(
      state.tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(["off"])),
    );
    const next = withCollapse.apply(withCollapse.tr);
    expect(getCollapsedHeadingIds(next)).toEqual(["off"]);
  });

  it("clears collapsed ids when told to", () => {
    const state = stateFor(buildDoc());
    const withCollapse = state.apply(
      state.tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(["off"])),
    );
    const cleared = withCollapse.apply(
      withCollapse.tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta([])),
    );
    expect(getCollapsedHeadingIds(cleared)).toEqual([]);
  });
});

describe("collapsedHeadingsPlugin decorations", () => {
  it("produces no decorations when nothing is collapsed", () => {
    const doc = buildDoc();
    const state = stateFor(doc);
    const decorations = computeCollapsedHeadingsDecorations(state);
    expect(decorations.find()).toEqual([]);
  });

  it("hides every top-level node inside a collapsed heading's range and nothing else", () => {
    const doc = buildDoc();
    const state = stateFor(doc).apply(
      stateFor(doc).tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(["off"])),
    );

    const outline = buildHeadingOutline(doc);
    const ranges = getCollapsedRanges(doc, outline, ["off"]);
    const hiddenNodeRanges = topLevelRanges(doc).filter(({ from, to }) =>
      ranges.some((range) => from >= range.from && to <= range.to),
    );
    // "off" collapses "block da", "paragraph DA intro", and "card" — three
    // top-level nodes — leaving "case", "off", "ac", "block fw", and the
    // trailing paragraph visible.
    expect(hiddenNodeRanges).toHaveLength(3);

    const decorations = computeCollapsedHeadingsDecorations(state);
    const found = decorations.find() ?? [];
    expect(found).toHaveLength(3);
    const foundRanges = found.map((d) => ({ from: d.from, to: d.to })).sort((a, b) => a.from - b.from);
    expect(foundRanges).toEqual(hiddenNodeRanges.slice().sort((a, b) => a.from - b.from));

    // A node outside the collapsed range (the "ac" hat and beyond) stays
    // undecorated.
    const acHeading = outline.find((h) => h.id === "ac");
    expect(found.some((d) => d.from === acHeading?.pos)).toBe(false);
  });

  it("hides through the end of the document when the outermost heading collapses", () => {
    const doc = buildDoc();
    const state = stateFor(doc).apply(
      stateFor(doc).tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(["case"])),
    );

    const decorations = computeCollapsedHeadingsDecorations(state);
    // Every top-level node after "case" itself is hidden — 7 of the 8
    // top-level nodes in the fixture.
    expect(decorations.find()).toHaveLength(7);
  });

  it("produces no decorations for a collapsed id with nothing to hide", () => {
    const doc = schema.node("doc", null, [schema.node("pocket", { id: "only" }, schema.text("Only"))]);
    const state = stateFor(doc).apply(
      stateFor(doc).tr.setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(["only"])),
    );
    const decorations = computeCollapsedHeadingsDecorations(state);
    expect(decorations.find()).toEqual([]);
  });
});
