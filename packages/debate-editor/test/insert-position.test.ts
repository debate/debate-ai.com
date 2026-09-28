import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import { nearestValidInsertPos } from "../src/editor/insert-position";
import { schema } from "../src/schema/index";

const tb = (name: string, text: string) => schema.nodes[name]!.create(null, schema.text(text));
const card = (text: string) => schema.nodes["card"]!.create(null, [tb("tag", text)]);
const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

describe("nearestValidInsertPos", () => {
  it("keeps the caret for inline content inside a textblock", () => {
    const d = doc(tb("paragraph", "hello"));
    expect(nearestValidInsertPos(d, 3, Fragment.from(schema.text("x")))).toBe(3);
  });

  it("keeps a block at an already-valid doc-level gap", () => {
    const d = doc(tb("paragraph", "a"), tb("paragraph", "b"));
    expect(nearestValidInsertPos(d, 3, Fragment.from(tb("paragraph", "p")))).toBe(3);
  });

  it("snaps a paragraph out of a textblock to the nearer side", () => {
    const d = doc(tb("paragraph", "abcdef"));
    // Paragraph spans [0, 8); inside at 2 is nearer the front, at 6 the back.
    expect(nearestValidInsertPos(d, 2, Fragment.from(tb("paragraph", "p")))).toBe(0);
    expect(nearestValidInsertPos(d, 6, Fragment.from(tb("paragraph", "p")))).toBe(8);
  });

  it("snaps a card to an outline slot rather than inside another card", () => {
    const d = doc(tb("pocket", "P"), card("one"), card("two"));
    const pos = nearestValidInsertPos(d, 5, Fragment.from(card("new")));
    const $pos = d.resolve(pos);
    expect($pos.depth).toBe(0);
    expect(d.type.contentMatch.matchFragment(d.content)).not.toBeNull();
  });

  it("falls back to the doc end for a heading when no slot is nearer", () => {
    const d = doc(tb("paragraph", "x"));
    expect(nearestValidInsertPos(d, 1, Fragment.from(tb("pocket", "P")))).toBe(d.content.size);
  });

  it("returns pos unchanged for empty content", () => {
    const d = doc(tb("paragraph", "x"));
    expect(nearestValidInsertPos(d, 1, Fragment.empty)).toBe(1);
  });
});
