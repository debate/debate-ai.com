/**
 * @fileoverview The load-time document migrations.
 *
 * Each one repairs a shape an older build could write but the current schema
 * check refuses, so what they guard against is a real file reading as "damaged"
 * — the beta.21 refusal that the empty-shell heals were written for. Two
 * properties matter for every one of them: the repair is lossless (no text a
 * debater typed disappears), and an already-valid doc comes back as the *same
 * node*, since `parseNative` skips the dispatch on identity.
 */

import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import {
  IMAGE_ALLOWED_MARKS,
  dropEmptyZones,
  flattenNestedZones,
  healAnalyticUnits,
  healCards,
  healTables,
  splitInCardAnalytics,
  stripImageVisualMarks,
} from "../src/schema/migrate";
import { schema } from "../src/schema/index";

const node = (name: string, content: PMNode[] = [], attrs: Record<string, unknown> | null = null) =>
  schema.nodes[name]!.create(attrs, Fragment.fromArray(content));

const text = (name: string, value: string) =>
  schema.nodes[name]!.create(null, value ? schema.text(value) : Fragment.empty);

const doc = (content: PMNode[]) => node("doc", content);

/** Every text run in the document, in order — what a lossless repair preserves. */
function allText(n: PMNode): string[] {
  const out: string[] = [];
  n.descendants((child) => {
    if (child.isText && child.text) out.push(child.text);
    return true;
  });
  return out;
}

const tag = (value = "Warming is real") => text("tag", value);
const body = (value = "Card body") => text("card_body", value);
const analytic = (value = "But warming is slow") => text("analytic", value);
const cite = (value = "Lovelace 24") => text("cite_paragraph", value);

describe("splitInCardAnalytics", () => {
  it("leaves a card with no analytic in it alone, as the same node", () => {
    const d = doc([node("card", [tag(), body()])]);
    expect(splitInCardAnalytics(d)).toBe(d);
  });

  it("splits an in-card analytic out into its own trailing unit", () => {
    const d = doc([node("card", [tag(), body(), analytic()])]);
    const out = splitInCardAnalytics(d);
    expect(out.child(0).type.name).toBe("card");
    expect(out.child(0).childCount).toBe(2);
    expect(out.child(1).type.name).toBe("analytic_unit");
    expect(out.child(1).firstChild!.type.name).toBe("analytic");
  });

  it("lets the new unit absorb the children that follow the analytic", () => {
    const d = doc([node("card", [tag(), body("first"), analytic(), cite(), body("after")])]);
    const unit = splitInCardAnalytics(d).child(1);
    expect(unit.childCount).toBe(3);
    expect(unit.child(1).type.name).toBe("cite_paragraph");
  });

  it("gives each in-card analytic its own unit", () => {
    const d = doc([
      node("card", [tag(), analytic("A1"), body("x"), analytic("A2"), body("y")]),
    ]);
    const out = splitInCardAnalytics(d);
    expect(out.childCount).toBe(3);
    expect(out.child(1).firstChild!.textContent).toBe("A1");
    expect(out.child(2).firstChild!.textContent).toBe("A2");
  });

  it("loses no text", () => {
    const d = doc([node("card", [tag("T"), body("B"), analytic("A"), cite("C")])]);
    expect(allText(splitInCardAnalytics(d))).toEqual(allText(d));
  });

  it("leaves the cards around the split one alone", () => {
    const before = node("card", [tag("one")]);
    const after = node("card", [tag("three")]);
    const out = splitInCardAnalytics(doc([before, node("card", [tag(), analytic()]), after]));
    expect(out.child(0)).toBe(before);
    expect(out.child(out.childCount - 1)).toBe(after);
  });
});

describe("flattenNestedZones", () => {
  it("leaves a doc with no zone alone, as the same node", () => {
    const d = doc([node("card", [tag()])]);
    expect(flattenNestedZones(d)).toBe(d);
  });

  it("leaves a flat zone alone, as the same node", () => {
    const d = doc([node("transclusion_ref", [node("card", [tag()])])]);
    expect(flattenNestedZones(d)).toBe(d);
  });

  it("unwraps a zone nested inside a live one, keeping the outer zone live", () => {
    const inner = node("transclusion_ref", [node("card", [tag("inner")])]);
    const out = flattenNestedZones(doc([node("transclusion_ref", [inner])]));
    expect(out.child(0).type.name).toBe("transclusion_ref");
    expect(out.child(0).child(0).type.name).toBe("card");
  });

  it("unwraps a zone nested several levels deep", () => {
    const deep = node("transclusion_ref", [
      node("transclusion_ref", [node("transclusion_ref", [node("card", [tag("deep")])])]),
    ]);
    const out = flattenNestedZones(doc([deep]));
    expect(out.child(0).child(0).type.name).toBe("card");
  });

  it("loses no text", () => {
    const d = doc([
      node("transclusion_ref", [node("transclusion_ref", [node("card", [tag("kept")])])]),
    ]);
    expect(allText(flattenNestedZones(d))).toEqual(["kept"]);
  });
});

describe("dropEmptyZones", () => {
  it("leaves a doc with no empty zone alone, as the same node", () => {
    const d = doc([node("transclusion_ref", [node("card", [tag()])])]);
    expect(dropEmptyZones(d)).toBe(d);
  });

  it("drops a zone that carries nothing, so no phantom zone refills later", () => {
    const out = dropEmptyZones(doc([node("transclusion_ref"), node("card", [tag()])]));
    expect(out.childCount).toBe(1);
    expect(out.child(0).type.name).toBe("card");
  });

  it("drops every empty zone in the doc", () => {
    const out = dropEmptyZones(
      doc([node("transclusion_ref"), node("card", [tag()]), node("transclusion_ref")]),
    );
    expect(out.childCount).toBe(1);
  });

  it("keeps a zone that still holds a card", () => {
    const out = dropEmptyZones(doc([node("transclusion_ref", [node("card", [tag()])])]));
    expect(out.child(0).type.name).toBe("transclusion_ref");
  });
});

describe("healAnalyticUnits", () => {
  it("leaves a valid unit alone, as the same node", () => {
    const d = doc([node("analytic_unit", [analytic(), body()])]);
    expect(healAnalyticUnits(d)).toBe(d);
  });

  it("drops an empty unit, which has nothing inside to lose", () => {
    const out = healAnalyticUnits(doc([node("analytic_unit"), node("card", [tag()])]));
    expect(out.childCount).toBe(1);
    expect(out.child(0).type.name).toBe("card");
  });

  it("floats a headless unit's children up to the parent", () => {
    const out = healAnalyticUnits(doc([node("analytic_unit", [body("orphan"), cite()])]));
    expect(out.child(0).type.name).toBe("card_body");
    expect(out.child(1).type.name).toBe("cite_paragraph");
  });

  it("re-heads a unit at each analytic past the first", () => {
    const d = doc([
      node("analytic_unit", [analytic("A1"), body("x"), analytic("A2"), body("y")]),
    ]);
    const out = healAnalyticUnits(d);
    expect(out.childCount).toBe(2);
    expect(out.child(0).firstChild!.textContent).toBe("A1");
    expect(out.child(1).firstChild!.textContent).toBe("A2");
    expect(out.child(1).childCount).toBe(2);
  });

  it("floats the headless children and re-heads the rest in one pass", () => {
    const d = doc([node("analytic_unit", [body("loose"), analytic("A"), body("tail")])]);
    const out = healAnalyticUnits(d);
    expect(out.child(0).type.name).toBe("card_body");
    expect(out.child(1).type.name).toBe("analytic_unit");
    expect(out.child(1).childCount).toBe(2);
  });

  it("loses no text", () => {
    const d = doc([node("analytic_unit", [body("a"), analytic("b"), body("c")])]);
    expect(allText(healAnalyticUnits(d))).toEqual(["a", "b", "c"]);
  });

  it("heals a unit sitting one level inside a zone", () => {
    const d = doc([node("transclusion_ref", [node("analytic_unit", [body("orphan")])])]);
    const zone = healAnalyticUnits(d).child(0);
    expect(zone.type.name).toBe("transclusion_ref");
    expect(zone.child(0).type.name).toBe("card_body");
  });
});

describe("healCards", () => {
  it("leaves a valid card alone, as the same node", () => {
    const d = doc([node("card", [tag(), body()])]);
    expect(healCards(d)).toBe(d);
  });

  it("drops an empty card, the shape the beta.22 field report saved", () => {
    const out = healCards(doc([node("card"), node("card", [tag()])]));
    expect(out.childCount).toBe(1);
    expect(out.child(0).childCount).toBe(1);
  });

  it("floats a headless card's children up to the parent", () => {
    const out = healCards(doc([node("card", [body("orphan"), cite()])]));
    expect(out.child(0).type.name).toBe("card_body");
    expect(out.child(1).type.name).toBe("cite_paragraph");
  });

  it("re-heads a card at each tag past the first", () => {
    const d = doc([node("card", [tag("T1"), body("x"), tag("T2"), body("y")])]);
    const out = healCards(d);
    expect(out.childCount).toBe(2);
    expect(out.child(0).firstChild!.textContent).toBe("T1");
    expect(out.child(1).firstChild!.textContent).toBe("T2");
  });

  it("loses no text", () => {
    const d = doc([node("card", [body("a"), tag("b"), body("c")])]);
    expect(allText(healCards(d))).toEqual(["a", "b", "c"]);
  });

  it("heals a card sitting one level inside a zone", () => {
    const d = doc([node("transclusion_ref", [node("card", [body("orphan")])])]);
    expect(healCards(d).child(0).child(0).type.name).toBe("card_body");
  });
});

describe("healTables", () => {
  const cell = (value = "x") =>
    node("table_cell", [schema.nodes["paragraph"]!.create(null, schema.text(value))]);
  const row = (cells: PMNode[]) => node("table_row", cells);

  it("leaves a valid table alone, as the same node", () => {
    const d = doc([node("card", [tag(), node("table", [row([cell()])])])]);
    expect(healTables(d)).toBe(d);
  });

  it("drops a table with no rows", () => {
    const out = healTables(doc([node("card", [tag(), node("table")])]));
    expect(out.child(0).childCount).toBe(1);
  });

  it("fills an empty cell with a paragraph rather than dropping the column", () => {
    const d = doc([node("card", [tag(), node("table", [row([node("table_cell"), cell()])])])]);
    const table = healTables(d).child(0).child(1);
    const healedRow = table.child(0);
    expect(healedRow.childCount).toBe(2);
    expect(healedRow.child(0).childCount).toBe(1);
    expect(healedRow.child(0).firstChild!.type.name).toBe("paragraph");
  });

  it("fills an empty header cell the same way", () => {
    const d = doc([node("card", [tag(), node("table", [row([node("table_header")])])])]);
    const header = healTables(d).child(0).child(1).child(0).child(0);
    expect(header.firstChild!.type.name).toBe("paragraph");
  });

  it("reaches a table nested inside a zone", () => {
    const d = doc([
      node("transclusion_ref", [node("card", [tag(), node("table", [row([node("table_cell")])])])]),
    ]);
    const healed = healTables(d).child(0).child(0).child(1).child(0).child(0);
    expect(healed.childCount).toBe(1);
  });

  it("loses no text", () => {
    const d = doc([node("card", [tag("T"), node("table", [row([cell("a"), node("table_cell")])])])]);
    expect(allText(healTables(d))).toEqual(["T", "a"]);
  });
});

describe("stripImageVisualMarks", () => {
  const image = (marks: string[] = []) =>
    schema.nodes["image"]!.create(
      { src: "data:image/png;base64,AA" },
      undefined,
      marks.map((m) => schema.marks[m]!.create(m === "link" ? { href: "https://x" } : null)),
    );

  const para = (children: PMNode[]) => schema.nodes["paragraph"]!.create(null, Fragment.fromArray(children));

  it("names the two marks an image may carry", () => {
    expect([...IMAGE_ALLOWED_MARKS].sort()).toEqual(["comment_range", "link"]);
  });

  it("leaves an unmarked image alone, as the same node", () => {
    const d = doc([para([image()])]);
    expect(stripImageVisualMarks(d)).toBe(d);
  });

  it("keeps a link on an image, which is functional rather than visual", () => {
    const d = doc([para([image(["link"])])]);
    expect(stripImageVisualMarks(d)).toBe(d);
  });

  it("strips a typography mark, which cannot render on an image without artifacts", () => {
    const d = doc([para([image(["italic"])])]);
    const out = stripImageVisualMarks(d);
    expect(out).not.toBe(d);
    expect(out.child(0).child(0).marks).toHaveLength(0);
  });

  it("keeps the allowed marks while stripping the rest", () => {
    const d = doc([para([image(["italic", "link"])])]);
    const marks = stripImageVisualMarks(d).child(0).child(0).marks.map((m) => m.type.name);
    expect(marks).toEqual(["link"]);
  });

  it("leaves the same mark on the text beside the image", () => {
    const italic = schema.marks["italic"]!.create();
    const d = doc([para([schema.text("words", [italic]), image(["italic"])])]);
    const out = stripImageVisualMarks(d);
    expect(out.child(0).child(0).marks.map((m) => m.type.name)).toEqual(["italic"]);
    expect(out.child(0).child(1).marks).toHaveLength(0);
  });

  it("reaches an image nested inside a card", () => {
    const d = doc([node("card", [tag(), node("card_body", [image(["italic"])])])]);
    const stripped = stripImageVisualMarks(d).child(0).child(1).child(0);
    expect(stripped.marks).toHaveLength(0);
  });
});
