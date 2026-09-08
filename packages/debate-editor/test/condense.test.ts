/**
 * @fileoverview Condense / Uncondense / Toggle Case — the F3 family.
 *
 * The rule table in ARCHITECTURE.md §15 is what these pin: which branch
 * touches which blocks, what the pilcrow markers of Branch B have to survive
 * (they are the only thing that makes the merge reversible), and the case
 * cycle's per-segment transform, which exists because a length-changing case
 * map otherwise eats the last characters of a marked run.
 */

import { describe, expect, it } from "vitest";
import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import {
  PILCROW_CHAR,
  PILCROW_HALF_POINTS,
  cleanTextblockContent,
  condenseBranchC,
  condenseMerge,
  isPilcrowMarker,
  makePilcrowText,
  resolveCondenseScope,
  toggleCase,
  uncondense,
} from "../src/editor/condense";
import { schema } from "../src/schema/index";

const textBlock = (name: string, value: string) =>
  schema.nodes[name]!.create(null, value ? schema.text(value) : Fragment.empty);

const block = (name: string, children: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(children));

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

const para = (value: string) => textBlock("paragraph", value);

/** A state with the cursor at `pos`, or a selection over `[from, to]`. */
function stateAt(d: PMNode, from: number, to = from): EditorState {
  return EditorState.create({
    doc: d,
    selection: TextSelection.create(d, from, to),
  });
}

/** Run a command; returns the resulting doc, or null when it declined. */
function run(command: Command, state: EditorState): PMNode | null {
  let next: PMNode | null = null;
  const handled = command(state, (tr) => {
    next = state.apply(tr).doc;
  });
  return handled ? (next ?? state.doc) : null;
}

/** The whole document selected, which is what a select-all condense sees. */
const selectAll = (d: PMNode) => stateAt(d, 1, d.content.size - 1);

describe("cleanTextblockContent", () => {
  const clean = (value: string) => {
    const out = cleanTextblockContent(para(value));
    return out.textBetween(0, out.size, "", "");
  };

  it("collapses a run of spaces to one", () => {
    expect(clean("a    b")).toBe("a b");
  });

  it("strips the leading spaces of a block", () => {
    expect(clean("   a b")).toBe("a b");
  });

  it("keeps a single trailing space, which Verbatim's own rule stops short of", () => {
    expect(clean("a b ")).toBe("a b ");
  });

  it("collapses a trailing run to that one space", () => {
    expect(clean("a b    ")).toBe("a b ");
  });

  it("folds a tab and a non-breaking space into a plain space", () => {
    expect(clean("a\tb")).toBe("a b");
    expect(clean("a b")).toBe("a b");
  });

  it("drops the invisibles, transparently to the run logic", () => {
    // A zero-width between two spaces must not stop the run collapsing.
    expect(clean("a ​ b")).toBe("a b");
    expect(clean("a­b")).toBe("ab");
  });

  it("leaves text with nothing to clean alone", () => {
    expect(clean("already clean")).toBe("already clean");
  });

  it("is empty for a block of nothing but spaces", () => {
    expect(clean("    ")).toBe("");
  });

  it("gives the collapsed space the marks of the run's first space", () => {
    const bold = schema.marks["bold"]!.create();
    const p = schema.nodes["paragraph"]!.create(
      null,
      Fragment.fromArray([schema.text("a ", [bold]), schema.text("  b")]),
    );
    const out = cleanTextblockContent(p);
    expect(out.child(0).text).toBe("a ");
    expect(out.child(0).marks.map((m) => m.type.name)).toEqual(["bold"]);
    expect(out.child(1).text).toBe("b");
  });

  it("groups adjacent characters carrying the same marks into one run", () => {
    const p = schema.nodes["paragraph"]!.create(
      null,
      Fragment.fromArray([schema.text("a  "), schema.text("b")]),
    );
    expect(cleanTextblockContent(p).childCount).toBe(1);
  });

  it("hands back a non-textblock's content untouched", () => {
    const card = block("card", [textBlock("tag", "T")]);
    expect(cleanTextblockContent(card)).toBe(card.content);
  });
});

describe("the pilcrow marker", () => {
  it("is a pilcrow carrying the marker mark", () => {
    const marker = makePilcrowText();
    expect(marker.text).toBe(PILCROW_CHAR);
    expect(marker.marks.map((m) => m.type.name)).toContain("pilcrow_marker");
  });

  it("recognises its own marker", () => {
    expect(isPilcrowMarker(makePilcrowText(), 0)).toBe(true);
  });

  it("still recognises the legacy six-point encoding older files carry", () => {
    const legacy = schema.text(PILCROW_CHAR, [
      schema.marks["font_size"]!.create({ halfPoints: PILCROW_HALF_POINTS }),
    ]);
    expect(isPilcrowMarker(legacy, 0)).toBe(true);
  });

  it("does not recognise a pilcrow a debater typed at body size", () => {
    expect(isPilcrowMarker(schema.text(PILCROW_CHAR), 0)).toBe(false);
  });

  it("does not recognise another character carrying the marker mark", () => {
    const marked = schema.text("x", [schema.marks["pilcrow_marker"]!.create()]);
    expect(isPilcrowMarker(marked, 0)).toBe(false);
  });

  it("does not recognise a non-text node", () => {
    expect(isPilcrowMarker(para("x"), 0)).toBe(false);
  });
});

describe("resolveCondenseScope", () => {
  it("scopes a selection to every textblock it touches", () => {
    const d = doc(para("one"), para("two"), para("three"));
    const { textblocks } = resolveCondenseScope(selectAll(d));
    expect(textblocks.map((t) => t.node.textContent)).toEqual(["one", "two", "three"]);
  });

  it("scopes a cursor inside a card to that card's blocks, tag included", () => {
    const d = doc(block("card", [textBlock("tag", "T"), textBlock("card_body", "body")]));
    const { textblocks } = resolveCondenseScope(stateAt(d, 4));
    expect(textblocks.map((t) => t.node.type.name)).toEqual(["tag", "card_body"]);
  });

  it("scopes a cursor inside an analytic unit to that unit", () => {
    const d = doc(block("analytic_unit", [textBlock("analytic", "A"), textBlock("card_body", "b")]));
    const { textblocks } = resolveCondenseScope(stateAt(d, 3));
    expect(textblocks).toHaveLength(2);
  });

  it("scopes a doc-level cursor to nothing at all", () => {
    const d = doc(para("loose"));
    expect(resolveCondenseScope(stateAt(d, 2)).textblocks).toEqual([]);
  });

  it("takes only the blocks the selection reaches", () => {
    const d = doc(para("one"), para("two"), para("three"));
    const firstEnd = d.child(0).nodeSize;
    const { textblocks } = resolveCondenseScope(stateAt(d, 1, firstEnd));
    expect(textblocks.map((t) => t.node.textContent)).toEqual(["one"]);
  });
});

describe("condenseBranchC", () => {
  const condense = condenseBranchC();

  it("cleans each block without merging any of them", () => {
    const d = doc(para("a    b"), para("  c  d"));
    const out = run(condense, selectAll(d))!;
    expect(out.childCount).toBe(2);
    expect(out.child(0).textContent).toBe("a b");
    expect(out.child(1).textContent).toBe("c d");
  });

  it("declines when every block is already clean", () => {
    expect(run(condense, selectAll(doc(para("a b"))))).toBeNull();
  });

  it("declines with nothing in scope", () => {
    expect(run(condense, stateAt(doc(para("loose")), 2))).toBeNull();
  });

  it("drops a body block that cleaned down to nothing", () => {
    const d = doc(
      block("card", [textBlock("tag", "T"), textBlock("card_body", "   "), textBlock("card_body", "kept")]),
    );
    const out = run(condense, stateAt(d, 4))!;
    expect(out.child(0).childCount).toBe(2);
    expect(out.child(0).child(1).textContent).toBe("kept");
  });

  it("keeps a heading that cleaned down to nothing, since its container needs one", () => {
    const d = doc(block("card", [textBlock("tag", "   "), textBlock("card_body", "body")]));
    const out = run(condense, stateAt(d, 4));
    if (out) expect(out.child(0).firstChild!.type.name).toBe("tag");
  });

  it("keeps every block's marks through the clean", () => {
    const bold = schema.marks["bold"]!.create();
    const p = schema.nodes["paragraph"]!.create(null, schema.text("a    b", [bold]));
    const out = run(condense, selectAll(doc(p)))!;
    expect(out.child(0).firstChild!.marks.map((m) => m.type.name)).toEqual(["bold"]);
  });

  it("reports handled without writing when there is no dispatch", () => {
    const state = selectAll(doc(para("a    b")));
    expect(condense(state, undefined)).toBe(true);
  });
});

describe("condenseMerge", () => {
  const merge = (headingMode: "strict" | "respect" | "demolish", withPilcrows = false) =>
    condenseMerge({ withPilcrows, headingMode });

  it("merges a run of body paragraphs into one", () => {
    const d = doc(para("one"), para("two"), para("three"));
    const out = run(merge("respect"), selectAll(d))!;
    expect(out.childCount).toBe(1);
    expect(out.child(0).textContent).toBe("one two three");
  });

  it("joins the merged paragraphs with a space", () => {
    const d = doc(para("one"), para("two"));
    expect(run(merge("respect"), selectAll(d))!.child(0).textContent).toBe("one two");
  });

  it("joins them with a recoverable marker when asked for pilcrows", () => {
    const d = doc(para("one"), para("two"));
    const out = run(merge("respect", true), selectAll(d))!;
    expect(out.child(0).textContent).toContain(PILCROW_CHAR);
  });

  it("keeps a heading out of the merge under respect", () => {
    const d = doc(
      block("card", [
        textBlock("tag", "TAG"),
        textBlock("card_body", "one"),
        textBlock("card_body", "two"),
      ]),
    );
    const out = run(merge("respect"), selectAll(d))!;
    const card = out.child(0);
    expect(card.child(0).type.name).toBe("tag");
    expect(card.child(0).textContent).toBe("TAG");
    expect(card.childCount).toBe(2);
    expect(card.child(1).textContent).toBe("one two");
  });

  it("declines under strict when the selection touches a structural block", () => {
    const d = doc(
      block("card", [textBlock("tag", "TAG"), textBlock("card_body", "one"), textBlock("card_body", "two")]),
    );
    expect(run(merge("strict"), selectAll(d))).toBeNull();
  });

  it("merges under strict when the selection is body only", () => {
    const d = doc(para("one"), para("two"));
    expect(run(merge("strict"), selectAll(d))!.childCount).toBe(1);
  });

  it("declines when there is nothing to merge", () => {
    expect(run(merge("respect"), selectAll(doc(para("only one"))))).toBeNull();
  });

  it("cleans whitespace as it merges", () => {
    const d = doc(para("one    a"), para("two"));
    expect(run(merge("respect"), selectAll(d))!.child(0).textContent).toBe("one a two");
  });

  it("merges the body of a card the cursor sits in, with no selection", () => {
    const d = doc(
      block("card", [
        textBlock("tag", "TAG"),
        textBlock("card_body", "one"),
        textBlock("card_body", "two"),
      ]),
    );
    const out = run(merge("respect"), stateAt(d, 6))!;
    expect(out.child(0).childCount).toBe(2);
    expect(out.child(0).child(1).textContent).toBe("one two");
  });

  it("loses no words in any heading mode", () => {
    for (const mode of ["respect", "demolish"] as const) {
      const d = doc(para("one"), para("two"), para("three"));
      const out = run(merge(mode), selectAll(d))!;
      for (const word of ["one", "two", "three"]) {
        expect(out.textContent).toContain(word);
      }
    }
  });
});

describe("uncondense", () => {
  it("reverses a pilcrow merge", () => {
    const d = doc(para("one"), para("two"), para("three"));
    const merged = run(condenseMerge({ withPilcrows: true, headingMode: "respect" }), selectAll(d))!;
    expect(merged.childCount).toBe(1);

    const back = run(uncondense(), selectAll(merged))!;
    expect(back.childCount).toBe(3);
    expect(back.child(0).textContent).toBe("one");
    expect(back.child(2).textContent).toBe("three");
  });

  it("drops the marker characters it split on", () => {
    const d = doc(para("one"), para("two"));
    const merged = run(condenseMerge({ withPilcrows: true, headingMode: "respect" }), selectAll(d))!;
    const back = run(uncondense(), selectAll(merged))!;
    expect(back.textContent).not.toContain(PILCROW_CHAR);
  });

  it("declines when the scope holds no marker", () => {
    expect(run(uncondense(), selectAll(doc(para("one two"))))).toBeNull();
  });

  it("declines at a doc-level cursor, rather than acting on the whole file", () => {
    expect(run(uncondense(), stateAt(doc(para("one")), 2))).toBeNull();
  });

  it("leaves a pilcrow a debater typed at body size alone", () => {
    const d = doc(para(`one ${PILCROW_CHAR} two`));
    expect(run(uncondense(), selectAll(d))).toBeNull();
  });
});

describe("toggleCase", () => {
  const cycle = toggleCase();
  const caseOf = (value: string) => {
    const d = doc(para(value));
    return run(cycle, selectAll(d))?.textContent ?? null;
  };

  it("takes lowercase to uppercase", () => {
    expect(caseOf("warming is real")).toBe("WARMING IS REAL");
  });

  it("takes uppercase to title case", () => {
    expect(caseOf("WARMING IS REAL")).toBe("Warming Is Real");
  });

  it("takes title case back to lowercase", () => {
    expect(caseOf("Warming Is Real")).toBe("warming is real");
  });

  it("starts a mixed-case selection at lowercase", () => {
    expect(caseOf("wArMiNg iS reAL")).toBe("warming is real");
  });

  it("returns to where it started after a full cycle", () => {
    let d = doc(para("warming is real"));
    for (let i = 0; i < 3; i++) d = run(cycle, selectAll(d))!;
    expect(d.textContent).toBe("warming is real");
  });

  it("declines on an empty selection", () => {
    expect(run(cycle, stateAt(doc(para("text")), 2))).toBeNull();
  });

  it("declines when the case cycle would change nothing", () => {
    expect(caseOf("123 456")).toBeNull();
  });

  it("keeps the marks on each run", () => {
    const bold = schema.marks["bold"]!.create();
    const p = schema.nodes["paragraph"]!.create(
      null,
      Fragment.fromArray([schema.text("warming ", [bold]), schema.text("is real")]),
    );
    const out = run(cycle, selectAll(doc(p)))!;
    expect(out.child(0).firstChild!.marks.map((m) => m.type.name)).toEqual(["bold"]);
    expect(out.child(0).textContent).toBe("WARMING IS REAL");
  });

  it("does not eat a character to a length-changing case map", () => {
    // The German sharp s uppercases to two characters; a globally-cased
    // string sliced by the original lengths would lose the segment's tail.
    const p = schema.nodes["paragraph"]!.create(
      null,
      Fragment.fromArray([
        schema.text("straße", [schema.marks["bold"]!.create()]),
        schema.text(" ends"),
      ]),
    );
    const out = run(cycle, selectAll(doc(p)))!;
    expect(out.textContent).toBe("STRASSE ENDS");
  });

  it("capitalizes only the first letter of a word split across two runs", () => {
    const p = schema.nodes["paragraph"]!.create(
      null,
      Fragment.fromArray([
        schema.text("WARM", [schema.marks["bold"]!.create()]),
        schema.text("ING IS REAL"),
      ]),
    );
    const out = run(cycle, selectAll(doc(p)))!;
    expect(out.textContent).toBe("Warming Is Real");
  });

  it("keeps an apostrophe inside a word rather than starting a new one", () => {
    const d = doc(para("THE STATE'S CASE"));
    expect(run(cycle, selectAll(d))!.textContent).toBe("The State's Case");
  });
});
