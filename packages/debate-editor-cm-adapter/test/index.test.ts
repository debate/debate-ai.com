import { describe, expect, it } from "vitest";
import { cardsOf, exportDocxBlob, importDocx, outlineOf, schema } from "../src/index";

/** A small debate doc: pocket > hat > block > one card. */
function sampleDoc() {
  const { nodes } = schema;
  return nodes.doc.create(null, [
    nodes.pocket.create(null, schema.text("1AC")),
    nodes.hat.create(null, schema.text("Advantage")),
    nodes.block.create(null, schema.text("Framing")),
    nodes.card.create(null, [
      nodes.tag.create(null, schema.text("Pleasure is intrinsic value")),
      nodes.cite_paragraph.create(null, schema.text("Blum 18")),
      nodes.card_body.create(null, schema.text("Pleasure is one of the primary reward functions.")),
    ]),
  ]);
}

describe("debate-editor-cm-adapter", () => {
  it("reads the outline and cards of a document", () => {
    const doc = sampleDoc();
    expect(outlineOf(doc).map((item) => [item.kind, item.level, item.text])).toEqual([
      ["pocket", 1, "1AC"],
      ["hat", 2, "Advantage"],
      ["block", 3, "Framing"],
      ["tag", 4, "Pleasure is intrinsic value"],
    ]);
    expect(cardsOf(doc)).toEqual([
      { tag: "Pleasure is intrinsic value", cite: "Blum 18", body: "Pleasure is one of the primary reward functions." },
    ]);
  });

  it("round-trips a document through .docx with upstream CardMirror", async () => {
    const blob = await exportDocxBlob(sampleDoc());
    expect(blob.type).toContain("wordprocessingml");
    const { doc } = await importDocx(blob);
    expect(outlineOf(doc).map((item) => item.text)).toEqual([
      "1AC",
      "Advantage",
      "Framing",
      "Pleasure is intrinsic value",
    ]);
    // Verbatim has no cite paragraph style, so the cite comes back as the
    // card's first body paragraph — upstream's import, not a loss of text.
    expect(cardsOf(doc)).toEqual([
      { tag: "Pleasure is intrinsic value", cite: "", body: "Blum 18\nPleasure is one of the primary reward functions." },
    ]);
  });
});
