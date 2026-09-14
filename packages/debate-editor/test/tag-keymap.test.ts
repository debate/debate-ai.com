/**
 * @fileoverview The tag / analytic boundary commands (ARCHITECTURE.md §12).
 *
 * These exist to stop the editor's defaults from doing the wrong thing at a
 * heading boundary. Word's own `joinBackward` would merge a card's body text
 * up into its tag, silently turning argument text into a heading; the default
 * Enter at the end of a tag would make a Cite. So the interesting assertions
 * here are the *refusals*: a command that returns true having changed nothing
 * is swallowing a keystroke on purpose, and that is exactly the behaviour a
 * regression would quietly drop.
 */

import { describe, expect, it } from "vitest";
import { EditorState, TextSelection, type Command } from "prosemirror-state";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import {
  backspaceAtFirstBodyStart,
  backspaceAtTagStart,
  deleteAtTagEnd,
  enterAtTagEnd,
  enterInHeading,
  enterMidTag,
} from "../src/editor/tag-keymap";
import { schema } from "../src/schema/index";

const textBlock = (name: string, value: string) =>
  schema.nodes[name]!.create(
    name === "tag" || name === "analytic" ? { id: `id-${name}-${value || "x"}` } : null,
    value ? schema.text(value) : Fragment.empty,
  );

const block = (name: string, children: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(children));

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

const card = (children: PMNode[]) => block("card", children);
const unit = (children: PMNode[]) => block("analytic_unit", children);

/** The position just inside the block whose text is `needle`, plus `offset`. */
function cursorIn(d: PMNode, needle: string, offset = 0): number {
  let found = -1;
  d.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isTextblock && node.textContent === needle) found = pos + 1 + offset;
    return found < 0;
  });
  if (found < 0) throw new Error(`no block reading ${JSON.stringify(needle)}`);
  return found;
}

const stateAt = (d: PMNode, pos: number) =>
  EditorState.create({ doc: d, selection: TextSelection.create(d, pos) });

/** Runs a command, reporting whether it handled the key and what it wrote. */
function run(command: Command, state: EditorState) {
  // Held on an object rather than in a local: TypeScript does not track an
  // assignment made inside the dispatch callback, and would narrow a plain
  // `let` back to null at the return.
  const written: { doc: PMNode | null } = { doc: null };
  const handled = command(state, (tr) => {
    written.doc = state.apply(tr).doc;
  });
  return { handled, doc: written.doc, changed: written.doc !== null };
}

describe("backspaceAtTagStart", () => {
  it("passes the key on when the cursor is not in a heading", () => {
    const d = doc(schema.nodes["paragraph"]!.create(null, schema.text("body")));
    expect(run(backspaceAtTagStart, stateAt(d, cursorIn(d, "body"))).handled).toBe(false);
  });

  it("passes the key on when the cursor is not at the tag's start", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    expect(run(backspaceAtTagStart, stateAt(d, cursorIn(d, "TAG", 2))).handled).toBe(false);
  });

  it("deletes a blank paragraph ahead of the tag", () => {
    const d = doc(
      schema.nodes["paragraph"]!.create(null, schema.text("   ")),
      card([textBlock("tag", "TAG")]),
    );
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "TAG")));
    expect(out.handled).toBe(true);
    expect(out.doc!.childCount).toBe(1);
    expect(out.doc!.child(0).type.name).toBe("card");
  });

  it("deletes an empty paragraph ahead of the tag", () => {
    const d = doc(schema.nodes["paragraph"]!.create(), card([textBlock("tag", "TAG")]));
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "TAG")));
    expect(out.doc!.childCount).toBe(1);
  });

  it("swallows the key rather than merging body text up into the heading", () => {
    const d = doc(
      schema.nodes["paragraph"]!.create(null, schema.text("argument text")),
      card([textBlock("tag", "TAG")]),
    );
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "TAG")));
    expect(out.handled).toBe(true);
    expect(out.changed).toBe(false);
  });

  it("swallows the key rather than pulling a cite into the heading", () => {
    const d = doc(
      card([textBlock("tag", "FIRST"), textBlock("cite_paragraph", "Lovelace 24")]),
      card([textBlock("tag", "SECOND")]),
    );
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "SECOND")));
    expect(out.handled).toBe(true);
    expect(out.changed).toBe(false);
  });

  it("merges two tag-only cards", () => {
    const d = doc(card([textBlock("tag", "FIRST")]), card([textBlock("tag", "SECOND")]));
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "SECOND")));
    expect(out.handled).toBe(true);
    expect(out.doc!.childCount).toBe(1);
    expect(out.doc!.child(0).firstChild!.textContent).toBe("FIRSTSECOND");
  });

  it("deletes the whole preceding card when its only tag is blank", () => {
    const d = doc(card([textBlock("tag", "  ")]), card([textBlock("tag", "SECOND")]));
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "SECOND")));
    expect(out.doc!.childCount).toBe(1);
    expect(out.doc!.child(0).firstChild!.textContent).toBe("SECOND");
  });

  it("applies the same rules to an analytic", () => {
    const d = doc(
      schema.nodes["paragraph"]!.create(null, schema.text("  ")),
      unit([textBlock("analytic", "ANALYTIC")]),
    );
    const out = run(backspaceAtTagStart, stateAt(d, cursorIn(d, "ANALYTIC")));
    expect(out.doc!.childCount).toBe(1);
  });

  it("reports handled without writing when there is no dispatch", () => {
    const d = doc(
      schema.nodes["paragraph"]!.create(null, schema.text("  ")),
      card([textBlock("tag", "TAG")]),
    );
    expect(backspaceAtTagStart(stateAt(d, cursorIn(d, "TAG")), undefined)).toBe(true);
  });
});

describe("deleteAtTagEnd", () => {
  const atEnd = (d: PMNode, text: string) => stateAt(d, cursorIn(d, text, text.length));

  it("passes the key on when the cursor is not at the tag's end", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    expect(run(deleteAtTagEnd, stateAt(d, cursorIn(d, "TAG"))).handled).toBe(false);
  });

  it("merges the next card's tag in, keeping its body", () => {
    const d = doc(
      card([textBlock("tag", "FIRST")]),
      card([textBlock("tag", "SECOND"), textBlock("card_body", "body text")]),
    );
    const out = run(deleteAtTagEnd, atEnd(d, "FIRST"));
    expect(out.handled).toBe(true);
    expect(out.doc!.childCount).toBe(1);
    expect(out.doc!.child(0).firstChild!.textContent).toBe("FIRSTSECOND");
    expect(out.doc!.child(0).textContent).toContain("body text");
  });

  it("swallows the key rather than pulling a body up into the heading", () => {
    const d = doc(
      card([textBlock("tag", "FIRST")]),
      schema.nodes["paragraph"]!.create(null, schema.text("argument")),
    );
    const out = run(deleteAtTagEnd, atEnd(d, "FIRST"));
    expect(out.handled).toBe(true);
    expect(out.changed).toBe(false);
  });

  it("swallows the key when the tag has a sibling after it in its own card", () => {
    const d = doc(
      card([textBlock("tag", "FIRST"), textBlock("card_body", "body")]),
      card([textBlock("tag", "SECOND")]),
    );
    const out = run(deleteAtTagEnd, atEnd(d, "FIRST"));
    expect(out.handled).toBe(true);
    expect(out.changed).toBe(false);
  });

  it("passes the key on at the end of the document", () => {
    const d = doc(card([textBlock("tag", "ONLY")]));
    expect(run(deleteAtTagEnd, atEnd(d, "ONLY")).handled).toBe(false);
  });
});

describe("backspaceAtFirstBodyStart", () => {
  it("passes the key on when the cursor is not at a block's start", () => {
    const d = doc(card([textBlock("tag", "TAG"), textBlock("card_body", "body")]));
    expect(
      run(backspaceAtFirstBodyStart, stateAt(d, cursorIn(d, "body", 2))).handled,
    ).toBe(false);
  });

  it("swallows the key rather than merging body text into the tag above it", () => {
    const d = doc(card([textBlock("tag", "TAG"), textBlock("card_body", "argument text")]));
    const out = run(backspaceAtFirstBodyStart, stateAt(d, cursorIn(d, "argument text")));
    expect(out.handled).toBe(true);
    expect(out.changed).toBe(false);
  });

  it("removes an empty body below a tag, which is just a blank line", () => {
    const d = doc(
      card([textBlock("tag", "TAG"), schema.nodes["card_body"]!.create()]),
    );
    const out = run(backspaceAtFirstBodyStart, stateAt(d, 1 + d.child(0).firstChild!.nodeSize + 1));
    expect(out.handled).toBe(true);
    expect(out.doc!.child(0).childCount).toBe(1);
  });

  it("passes the key on from a body that is not the first", () => {
    const d = doc(
      card([
        textBlock("tag", "TAG"),
        textBlock("card_body", "one"),
        textBlock("card_body", "two"),
      ]),
    );
    expect(run(backspaceAtFirstBodyStart, stateAt(d, cursorIn(d, "two"))).handled).toBe(false);
  });

  it("passes the key on when there is a selection rather than a cursor", () => {
    const d = doc(card([textBlock("tag", "TAG"), textBlock("card_body", "body")]));
    const from = cursorIn(d, "body");
    const state = EditorState.create({
      doc: d,
      selection: TextSelection.create(d, from, from + 2),
    });
    expect(run(backspaceAtFirstBodyStart, state).handled).toBe(false);
  });
});

describe("enterMidTag", () => {
  it("splits a tag into two cards at the cursor", () => {
    const d = doc(card([textBlock("tag", "ONETWO")]));
    const out = run(enterMidTag, stateAt(d, cursorIn(d, "ONETWO", 3)));
    expect(out.handled).toBe(true);
    expect(out.doc!.childCount).toBe(2);
    expect(out.doc!.child(0).firstChild!.textContent).toBe("ONE");
    expect(out.doc!.child(1).firstChild!.textContent).toBe("TWO");
  });

  it("leaves the original card's body and cite with the post-cursor half", () => {
    const d = doc(
      card([
        textBlock("tag", "ONETWO"),
        textBlock("cite_paragraph", "Lovelace 24"),
        textBlock("card_body", "body"),
      ]),
    );
    const out = run(enterMidTag, stateAt(d, cursorIn(d, "ONETWO", 3)));
    expect(out.doc!.child(0).childCount).toBe(1);
    expect(out.doc!.child(1).textContent).toContain("Lovelace 24");
    expect(out.doc!.child(1).textContent).toContain("body");
  });

  it("gives the new card its own heading id", () => {
    const d = doc(card([textBlock("tag", "ONETWO")]));
    const out = run(enterMidTag, stateAt(d, cursorIn(d, "ONETWO", 3)));
    const ids = [out.doc!.child(0).firstChild!.attrs["id"], out.doc!.child(1).firstChild!.attrs["id"]];
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[0]).toBeTruthy();
  });

  it("leaves an empty tag above when the cursor sits at the tag's start", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    const out = run(enterMidTag, stateAt(d, cursorIn(d, "TAG")));
    expect(out.doc!.childCount).toBe(2);
    expect(out.doc!.child(0).firstChild!.textContent).toBe("");
    expect(out.doc!.child(1).firstChild!.textContent).toBe("TAG");
  });

  it("passes the key on at the tag's end, which the other command owns", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    expect(run(enterMidTag, stateAt(d, cursorIn(d, "TAG", 3))).handled).toBe(false);
  });

  it("splits an analytic into two units of its own type", () => {
    const d = doc(unit([textBlock("analytic", "ONETWO")]));
    const out = run(enterMidTag, stateAt(d, cursorIn(d, "ONETWO", 3)));
    expect(out.doc!.child(0).type.name).toBe("analytic_unit");
    expect(out.doc!.child(1).type.name).toBe("analytic_unit");
  });
});

describe("enterAtTagEnd", () => {
  it("adds a body directly under the tag and puts the cursor in it", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    const out = run(enterAtTagEnd, stateAt(d, cursorIn(d, "TAG", 3)));
    expect(out.handled).toBe(true);
    const card0 = out.doc!.child(0);
    expect(card0.childCount).toBe(2);
    expect(card0.child(1).type.name).toBe("card_body");
    expect(card0.child(1).textContent).toBe("");
  });

  it("puts the new body above an existing cite, never below it", () => {
    const d = doc(card([textBlock("tag", "TAG"), textBlock("cite_paragraph", "Lovelace 24")]));
    const out = run(enterAtTagEnd, stateAt(d, cursorIn(d, "TAG", 3)));
    const card0 = out.doc!.child(0);
    expect(card0.child(1).type.name).toBe("card_body");
    expect(card0.child(2).type.name).toBe("cite_paragraph");
  });

  it("passes the key on from mid-tag, which the split command owns", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    expect(run(enterAtTagEnd, stateAt(d, cursorIn(d, "TAG", 1))).handled).toBe(false);
  });

  it("adds a body under an analytic too", () => {
    const d = doc(unit([textBlock("analytic", "A")]));
    const out = run(enterAtTagEnd, stateAt(d, cursorIn(d, "A", 1)));
    expect(out.doc!.child(0).child(1).type.name).toBe("card_body");
  });
});

describe("enterInHeading", () => {
  it("adds a plain paragraph after a heading, not another heading", () => {
    for (const kind of ["pocket", "hat", "block"] as const) {
      const d = doc(textBlock(kind, "HEAD"));
      const out = run(enterInHeading, stateAt(d, cursorIn(d, "HEAD", 4)));
      expect(out.handled).toBe(true);
      expect(out.doc!.child(1).type.name).toBe("paragraph");
    }
  });

  it("splits a heading into two of its own type, never the wrong one", () => {
    for (const kind of ["pocket", "hat", "block"] as const) {
      const d = doc(textBlock(kind, "ONETWO"));
      const out = run(enterInHeading, stateAt(d, cursorIn(d, "ONETWO", 3)));
      expect(out.doc!.child(0).type.name).toBe(kind);
      expect(out.doc!.child(1).type.name).toBe(kind);
      expect(out.doc!.child(0).textContent).toBe("ONE");
      expect(out.doc!.child(1).textContent).toBe("TWO");
    }
  });

  it("splits at the start, leaving an empty heading above", () => {
    const d = doc(textBlock("hat", "HEAD"));
    const out = run(enterInHeading, stateAt(d, cursorIn(d, "HEAD")));
    expect(out.doc!.child(0).textContent).toBe("");
    expect(out.doc!.child(1).textContent).toBe("HEAD");
  });

  it("passes the key on outside a heading", () => {
    const d = doc(schema.nodes["paragraph"]!.create(null, schema.text("body")));
    expect(run(enterInHeading, stateAt(d, cursorIn(d, "body"))).handled).toBe(false);
  });

  it("passes the key on inside a tag, which the tag commands own", () => {
    const d = doc(card([textBlock("tag", "TAG")]));
    expect(run(enterInHeading, stateAt(d, cursorIn(d, "TAG", 1))).handled).toBe(false);
  });

  it("passes the key on when there is a selection rather than a cursor", () => {
    const d = doc(textBlock("hat", "HEAD"));
    const from = cursorIn(d, "HEAD");
    const state = EditorState.create({
      doc: d,
      selection: TextSelection.create(d, from, from + 2),
    });
    expect(run(enterInHeading, state).handled).toBe(false);
  });
});
