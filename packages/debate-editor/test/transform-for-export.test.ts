import { describe, expect, it } from "vitest";
import { Fragment, type Mark, type Node as PMNode } from "prosemirror-model";

import { countMarkedCards, transformForExport } from "../src/export/transform-for-export";
import { schema } from "../src/schema/index";

const hl = () => schema.marks["highlight"]!.create();
const cite = () => schema.marks["cite_mark"]!.create();
const bold = () => schema.marks["bold"]!.create();
const red = () => schema.marks["font_color"]!.create({ color: "ff0000" });

const t = (text: string, marks: Mark[] = []) => schema.text(text, marks);
const block = (name: string, ...content: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(content));
const card = (...children: PMNode[]) => schema.nodes["card"]!.create(null, children);
const analyticUnit = (text: string) =>
  schema.nodes["analytic_unit"]!.create(null, [block("analytic", t(text))]);
const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

const base = {
  includeComments: true,
  includeAnalytics: true,
  includeUndertags: true,
  readMode: false,
};

/** Top-level types, with a card's children in brackets. */
function shape(d: PMNode): string[] {
  const out: string[] = [];
  d.forEach((n) => {
    const kids: string[] = [];
    if (n.type.name === "card" || n.type.name === "analytic_unit") n.forEach((c) => kids.push(c.type.name));
    out.push(kids.length ? `${n.type.name}[${kids.join(",")}]` : n.type.name);
  });
  return out;
}

describe("transformForExport", () => {
  const sample = () =>
    doc(
      block("pocket", t("Pocket")),
      block("undertag", t("loose undertag")),
      card(
        block("tag", t("Tag")),
        block("undertag", t("under")),
        block("cite_paragraph", t("Smith 24", [cite()]), t(" filler")),
        block("card_body", t("skip "), t("keep", [hl()]), t("also", [hl(), bold()])),
        block("undertag", t("between")),
        block("card_body", t(" next", [hl()])),
      ),
      analyticUnit("An analytic"),
      block("paragraph", t("loose")),
    );

  it("passes the doc through when everything is included", () => {
    const d = sample();
    expect(transformForExport(d, base)).toBe(d);
  });

  it("strips analytics and undertags", () => {
    const out = transformForExport(sample(), { ...base, includeAnalytics: false, includeUndertags: false });
    expect(shape(out)).toEqual(["pocket", "card[tag,cite_paragraph,card_body,card_body]", "paragraph"]);
  });

  it("strips undertags inside analytic units too", () => {
    const unit = schema.nodes["analytic_unit"]!.create(null, [
      block("analytic", t("a")),
      block("undertag", t("u")),
    ]);
    const out = transformForExport(doc(unit), { ...base, includeUndertags: false });
    expect(shape(out)).toEqual(["analytic_unit[analytic]"]);
  });

  it("exports only what read mode shows", () => {
    const out = transformForExport(sample(), { ...base, readMode: true });
    expect(shape(out)).toEqual(["pocket", "card[tag,cite_paragraph,card_body]", "analytic_unit[analytic]"]);
    const c = out.child(1);
    expect(c.child(1).textContent).toBe("Smith 24");
    // Bodies flow together across the undertag, with separator spaces added
    // only where no whitespace already sits at the seam.
    expect(c.child(2).textContent).toBe("keep also next");
  });

  it("drops everything read mode hides", () => {
    const out = transformForExport(
      doc(
        card(block("tag"), block("cite_paragraph", t("no cite")), block("card_body", t("unmarked"))),
        block("cite_paragraph", t("loose", [cite()])),
      ),
      { ...base, readMode: true },
    );
    // The tag always survives; the unmarked cite and body do not, and loose
    // doc-level blocks are hidden in read mode.
    expect(shape(out)).toEqual(["card[tag]"]);
  });

  it("keeps only marked cards, flat", () => {
    const marked = card(block("tag", t("M")), block("card_body", t("read to "), t("here", [red()])));
    const unmarked = card(block("tag", t("U")), block("card_body", t("body")));
    const d = doc(block("pocket", t("P")), unmarked, marked, analyticUnit("a"));
    expect(countMarkedCards(d)).toBe(1);
    const out = transformForExport(d, { ...base, markedCardsOnly: true });
    expect(out.childCount).toBe(1);
    expect(out.child(0).firstChild!.textContent).toBe("M");
  });

  it("leaves a doc without markers alone when baking unread red", () => {
    const d = sample();
    expect(transformForExport(d, { ...base, markUnreadAfterMarker: true })).toBe(d);
  });
});
