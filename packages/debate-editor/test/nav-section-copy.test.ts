import { describe, expect, it } from "vitest";
import { schema } from "../src/schema";
import { collectHeadings } from "../src/editor/headings";
import { collectSectionCards, formatSectionCopy } from "../src/editor/nav-section-copy";

const hl = () => schema.marks.highlight!.create({ color: "yellow" });
const cite = () => schema.marks.cite_mark!.create();

function card(tag: string, author: string, body: [string, boolean][]) {
  return schema.nodes.card!.create(null, [
    schema.nodes.tag!.create(null, schema.text(tag)),
    schema.nodes.cite_paragraph!.create(null, [schema.text(author, [cite()]), schema.text(", Some Journal")]),
    schema.nodes.card_body!.create(
      null,
      body.map(([t, lit]) => schema.text(t, lit ? [hl()] : [])),
    ),
  ]);
}

const doc = schema.nodes.doc!.create(null, [
  schema.nodes.block!.create(null, schema.text("Overview")),
  card("DA outweighs", "Parrish 13", [
    ["To meaningfully ", true],
    ["skip this ", false],
    ["advance", true],
  ]),
  card("Turns their impact", "Stein 23", [["Only this", true]]),
  schema.nodes.block!.create(null, schema.text("Link")),
  card("The plan causes it", "Smith 20", [["not lit", false]]),
]);

describe("nav section copy", () => {
  const overview = collectHeadings(doc).find((h) => h.text === "Overview")!;

  it("collects only the cards under the heading", () => {
    const cards = collectSectionCards(doc, overview);
    expect(cards.map((c) => c.tag)).toEqual(["DA outweighs", "Turns their impact"]);
    expect(cards[0]).toMatchObject({ cite: "Parrish 13", highlighted: "To meaningfully advance" });
  });

  it("formats tags only, one per line", () => {
    expect(formatSectionCopy(collectSectionCards(doc, overview), "tags").text).toBe(
      "DA outweighs\nTurns their impact",
    );
  });

  it("formats tags, cites and highlighted text per card", () => {
    expect(formatSectionCopy(collectSectionCards(doc, overview), "full").text).toBe(
      "DA outweighs\nParrish 13\nTo meaningfully advance\n\nTurns their impact\nStein 23\nOnly this",
    );
  });
});
