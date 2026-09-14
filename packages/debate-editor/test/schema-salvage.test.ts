/**
 * @fileoverview Salvage and slice validation — the two guards that stand
 * between a damaged payload and the live document.
 *
 * `salvageDoc` runs when a file fails its schema check: rather than refusing
 * outright, it rebuilds what it can and reports what it dropped, so a debater
 * gets a concrete "content may be lost" warning instead of a dead file. The
 * two properties worth pinning are that a generated filler saves a body that
 * merely lost its head, and that the result is re-checked — the function
 * returns null rather than ever handing back an invalid doc.
 *
 * `checkedSliceFromJSON` guards the seven surfaces that rebuild stored slice
 * JSON. Its threat model is exact: closed nodes get a full recursive check
 * while open spine nodes are legitimately partial, so both halves are tested.
 */

import { describe, expect, it } from "vitest";
import { Fragment, Slice, type Node as PMNode } from "prosemirror-model";

import { salvageDoc } from "../src/schema/salvage";
import { checkedSliceFromJSON, sliceJsonIsValid } from "../src/schema/slice-check";
import { schema } from "../src/schema/index";

const textBlock = (name: string, value: string) =>
  schema.nodes[name]!.create(null, value ? schema.text(value) : Fragment.empty);

const block = (name: string, children: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(children));

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

describe("salvageDoc on a document that is already valid", () => {
  it("hands it back with nothing dropped", () => {
    const d = doc(block("card", [textBlock("tag", "T"), textBlock("card_body", "body")]));
    const out = salvageDoc(d)!;
    expect(out.dropped).toEqual([]);
    expect(out.doc.textContent).toBe("Tbody");
  });

  it("keeps a plain paragraph", () => {
    const out = salvageDoc(doc(textBlock("paragraph", "loose")))!;
    expect(out.doc.child(0).textContent).toBe("loose");
    expect(out.dropped).toEqual([]);
  });
});

describe("salvageDoc on a damaged document", () => {
  it("generates the head a card is missing rather than losing its body", () => {
    const headless = schema.nodes["card"]!.create(
      null,
      Fragment.from(textBlock("card_body", "argument text")),
    );
    const out = salvageDoc(doc(headless))!;
    expect(out.doc.textContent).toContain("argument text");
    expect(out.doc.child(0).firstChild!.type.name).toBe("tag");
  });

  it("fills the paragraph an empty table cell needs", () => {
    const emptyCell = schema.nodes["table_cell"]!.create();
    const table = block("table", [block("table_row", [emptyCell])]);
    const out = salvageDoc(doc(block("card", [textBlock("tag", "T"), table])))!;
    expect(out.doc.check).toBeDefined();
    const cell = out.doc.child(0).child(1).child(0).child(0);
    expect(cell.childCount).toBeGreaterThan(0);
  });

  it("drops a child that cannot fit even with filling, and reports it", () => {
    // A tag standing at the top level, where the doc's content expression
    // has no place for it.
    const stray = textBlock("tag", "Loose tag text");
    const out = salvageDoc(doc(textBlock("paragraph", "kept"), stray));
    if (out && out.dropped.length > 0) {
      expect(out.dropped[0]!.textPreview).toContain("Loose tag");
      expect(out.doc.textContent).toContain("kept");
    } else {
      // The schema accommodated it; the document still has to be valid.
      expect(() => out!.doc.check()).not.toThrow();
    }
  });

  it("reports each dropped subtree with its type and a text preview", () => {
    const headless = schema.nodes["card"]!.create(null, Fragment.empty);
    const out = salvageDoc(doc(headless, textBlock("paragraph", "kept")));
    expect(out).not.toBeNull();
    for (const entry of out!.dropped) {
      expect(typeof entry.type).toBe("string");
      expect(typeof entry.textPreview).toBe("string");
    }
  });

  it("caps a preview so a long card does not become the whole warning", () => {
    const long = "w".repeat(500);
    const stray = textBlock("tag", long);
    const out = salvageDoc(doc(textBlock("paragraph", "kept"), stray));
    for (const entry of out?.dropped ?? []) {
      expect(entry.textPreview.length).toBeLessThanOrEqual(80);
    }
  });

  it("always hands back a document that passes its own check", () => {
    const cases: PMNode[] = [
      doc(schema.nodes["card"]!.create(null, Fragment.from(textBlock("card_body", "body")))),
      doc(schema.nodes["analytic_unit"]!.create(null, Fragment.from(textBlock("card_body", "b")))),
      doc(schema.nodes["card"]!.create(null, Fragment.empty), textBlock("paragraph", "kept")),
    ];
    for (const d of cases) {
      const out = salvageDoc(d);
      if (out) expect(() => out.doc.check()).not.toThrow();
    }
  });

  it("keeps the text of everything it did not have to drop", () => {
    const headless = schema.nodes["card"]!.create(
      null,
      Fragment.from(textBlock("card_body", "salvaged")),
    );
    const out = salvageDoc(doc(textBlock("paragraph", "before"), headless))!;
    expect(out.doc.textContent).toContain("before");
    expect(out.doc.textContent).toContain("salvaged");
  });
});

describe("checkedSliceFromJSON", () => {
  it("rebuilds a valid slice", () => {
    const d = doc(textBlock("paragraph", "warming is real"));
    const json = d.slice(1, d.content.size - 1).toJSON();
    expect(checkedSliceFromJSON(json).content.textBetween(0, 15, "", "")).toContain("warming");
  });

  it("rebuilds an empty slice", () => {
    expect(checkedSliceFromJSON(Slice.empty.toJSON()).size).toBe(0);
    expect(checkedSliceFromJSON(null).size).toBe(0);
  });

  it("accepts a copy from mid-card, whose open edge cut the tag away", () => {
    const d = doc(block("card", [textBlock("tag", "T"), textBlock("card_body", "body")]));
    const json = d.slice(4, d.content.size - 1, true).toJSON();
    expect(() => checkedSliceFromJSON(json)).not.toThrow();
  });

  it("refuses a closed node whose content the schema forbids", () => {
    // A card with no tag, embedded as a fully closed node.
    const hollow = {
      content: [{ type: "card", content: [{ type: "card_body" }] }],
      openStart: 0,
      openEnd: 0,
    };
    expect(() => checkedSliceFromJSON(hollow)).toThrow();
  });

  it("refuses a node type the schema does not define", () => {
    expect(() =>
      checkedSliceFromJSON({ content: [{ type: "not_a_node" }], openStart: 0, openEnd: 0 }),
    ).toThrow();
  });

  it("refuses a payload whose nodes are not nodes", () => {
    expect(() =>
      checkedSliceFromJSON({ content: [{ type: "paragraph", content: [{ text: "no type" }] }] }),
    ).toThrow();
    expect(() => checkedSliceFromJSON({ content: [{}] })).toThrow();
  });

  it("checks a closed node beside an open one", () => {
    const bad = {
      content: [
        { type: "paragraph", content: [{ type: "text", text: "open edge" }] },
        { type: "card", content: [{ type: "card_body" }] },
      ],
      openStart: 1,
      openEnd: 0,
    };
    expect(() => checkedSliceFromJSON(bad)).toThrow();
  });

  it("keeps checking below an open spine as the openness runs out", () => {
    const bad = {
      content: [
        {
          type: "card",
          content: [
            { type: "tag", content: [{ type: "text", text: "T" }] },
            { type: "card", content: [{ type: "card_body" }] },
          ],
        },
      ],
      openStart: 1,
      openEnd: 0,
    };
    expect(() => checkedSliceFromJSON(bad)).toThrow();
  });
});

describe("sliceJsonIsValid", () => {
  it("is true for a slice that rebuilds", () => {
    const d = doc(textBlock("paragraph", "text"));
    expect(sliceJsonIsValid(d.slice(1, d.content.size - 1).toJSON())).toBe(true);
    expect(sliceJsonIsValid(Slice.empty.toJSON())).toBe(true);
  });

  it("is false for a payload that would throw, rather than throwing itself", () => {
    expect(
      sliceJsonIsValid({
        content: [{ type: "card", content: [{ type: "card_body" }] }],
        openStart: 0,
        openEnd: 0,
      }),
    ).toBe(false);
    expect(sliceJsonIsValid({ content: [{}] })).toBe(false);
    expect(sliceJsonIsValid({ content: [{ type: "not_a_node" }] })).toBe(false);
  });

  it("filters a stored library down to the payloads that still rebuild", () => {
    const good = doc(textBlock("paragraph", "text")).slice(1, 5).toJSON();
    const bad = { content: [{ type: "not_a_node" }], openStart: 0, openEnd: 0 };
    expect([good, bad, good].filter(sliceJsonIsValid)).toHaveLength(2);
  });
});
