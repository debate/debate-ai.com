/**
 * @fileoverview The AI formatting-repair pipeline: which paragraphs it looks
 * at, how it groups and analyses them into signatures, the FACTS it states to
 * the model, and how it reads the reply back.
 *
 * The FACTS bullets carry the load here. The comments record that models
 * reliably miss the *absence* of a signature, and that on a size-encoded card
 * they underline the shrunk majority backwards — so the three cases that
 * builder distinguishes are each pinned to the fact it emits.
 */

import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import {
  analyzeCard,
  buildCardRequest,
  buildFacts,
  collectBodyBlocks,
  groupBlocksByCard,
  parseFormatResponse,
  signatureKey,
  type BodyBlock,
  type FormatFlag,
} from "../src/editor/ai/repair-formatting";
import { schema } from "../src/schema/index";

/** A text node carrying the named marks; `size` is in half-points. */
const run = (text: string, marks: string[] = [], size?: number) =>
  schema.text(text, [
    ...marks.map((m) => schema.marks[m]!.create()),
    ...(size === undefined ? [] : [schema.marks["font_size"]!.create({ halfPoints: size })]),
  ]);

const block = (name: string, children: PMNode[]) =>
  schema.nodes[name]!.create(null, Fragment.fromArray(children));

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

const card = (children: PMNode[]) => schema.nodes["card"]!.create(null, Fragment.fromArray(children));

const tag = (value: string) => block("tag", [schema.text(value)]);

const all = (d: PMNode) => collectBodyBlocks(d, 0, d.content.size);

describe("collectBodyBlocks", () => {
  it("takes card bodies and doc-level paragraphs", () => {
    const d = doc(card([tag("T"), block("card_body", [schema.text("body")])]), block("paragraph", [schema.text("loose")]));
    expect(all(d).map((b) => b.node.textContent)).toEqual(["body", "loose"]);
  });

  it("never takes a structural block", () => {
    const d = doc(
      card([
        tag("Tag text"),
        block("undertag", [schema.text("Undertag text")]),
        block("cite_paragraph", [schema.text("Cite text")]),
        block("card_body", [schema.text("Body text")]),
      ]),
    );
    expect(all(d).map((b) => b.node.textContent)).toEqual(["Body text"]);
  });

  it("skips a block holding only whitespace", () => {
    const d = doc(block("paragraph", [schema.text("   ")]), block("paragraph", [schema.text("real")]));
    expect(all(d).map((b) => b.node.textContent)).toEqual(["real"]);
  });

  it("skips an empty block", () => {
    const d = doc(schema.nodes["paragraph"]!.create(), block("paragraph", [schema.text("real")]));
    expect(all(d)).toHaveLength(1);
  });

  it("takes only the blocks the range reaches", () => {
    const d = doc(block("paragraph", [schema.text("first")]), block("paragraph", [schema.text("second")]));
    const firstEnd = d.child(0).nodeSize;
    expect(collectBodyBlocks(d, 0, firstEnd).map((b) => b.node.textContent)).toEqual(["first"]);
  });

  it("reports each block's own position", () => {
    const d = doc(block("paragraph", [schema.text("first")]), block("paragraph", [schema.text("second")]));
    const blocks = all(d);
    expect(d.nodeAt(blocks[0]!.pos)!.textContent).toBe("first");
    expect(d.nodeAt(blocks[1]!.pos)!.textContent).toBe("second");
  });

  it("is empty for a document with no body text", () => {
    expect(all(doc(card([tag("only a tag")])))).toEqual([]);
  });
});

describe("groupBlocksByCard", () => {
  it("groups the blocks of one card together", () => {
    const d = doc(
      card([tag("T"), block("card_body", [schema.text("a")]), block("card_body", [schema.text("b")])]),
    );
    const groups = groupBlocksByCard(d, all(d));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.map((b) => b.node.textContent)).toEqual(["a", "b"]);
  });

  it("keeps two cards apart", () => {
    const d = doc(
      card([tag("T1"), block("card_body", [schema.text("a")])]),
      card([tag("T2"), block("card_body", [schema.text("b")])]),
    );
    const groups = groupBlocksByCard(d, all(d));
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g[0]!.node.textContent)).toEqual(["a", "b"]);
  });

  it("pools every loose paragraph into one trailing group", () => {
    const d = doc(
      card([tag("T"), block("card_body", [schema.text("in card")])]),
      block("paragraph", [schema.text("loose one")]),
      block("paragraph", [schema.text("loose two")]),
    );
    const groups = groupBlocksByCard(d, all(d));
    expect(groups).toHaveLength(2);
    expect(groups[1]!.map((b) => b.node.textContent)).toEqual(["loose one", "loose two"]);
  });

  it("is empty for no blocks", () => {
    expect(groupBlocksByCard(doc(block("paragraph", [schema.text("x")])), [])).toEqual([]);
  });
});

describe("signatureKey", () => {
  it("names an unformatted run plain", () => {
    expect(signatureKey(new Set())).toBe("plain");
  });

  it("names a single flag by itself", () => {
    expect(signatureKey(new Set<FormatFlag>(["u"]))).toBe("u");
  });

  it("joins several flags in a stable order, whatever order they arrived in", () => {
    expect(signatureKey(new Set<FormatFlag>(["u", "b"]))).toBe("b+u");
    expect(signatureKey(new Set<FormatFlag>(["b", "u"]))).toBe("b+u");
  });
});

describe("analyzeCard", () => {
  const analyze = (blocks: PMNode[]) => {
    const d = doc(card([tag("T"), ...blocks]));
    return analyzeCard(groupBlocksByCard(d, all(d))[0]!);
  };

  it("reads a plain card as one plain run", () => {
    const a = analyze([block("card_body", [schema.text("just body text")])]);
    expect(a.texts).toEqual(["just body text"]);
    expect([...a.signatures.keys()]).toEqual(["plain"]);
  });

  it("splits a block into runs by their formatting", () => {
    const a = analyze([
      block("card_body", [run("plain "), run("underlined", ["underline_mark"])]),
    ]);
    expect([...a.signatures.keys()].sort()).toEqual(["plain", "u"]);
  });

  it("counts the runs and characters under each signature", () => {
    const a = analyze([
      block("card_body", [run("aaa", ["underline_mark"]), run("b"), run("ccc", ["underline_mark"])]),
    ]);
    expect(a.signatures.get("u")).toMatchObject({ runs: 2, chars: 6 });
  });

  it("keeps a sample of each signature's text, for the model to recognise", () => {
    const a = analyze([block("card_body", [run("distinctive words here", ["bold"])])]);
    expect(a.signatures.get("b")!.samples.join(" ")).toContain("distinctive");
  });

  it("names a run carrying two marks by both flags", () => {
    const a = analyze([block("card_body", [run("both", ["bold", "underline_mark"])])]);
    expect([...a.signatures.keys()]).toEqual(["b+u"]);
  });

  it("sees plain underlining when some underlined text is not bold", () => {
    const a = analyze([
      block("card_body", [run("plain u", ["underline_mark"]), run("bold u", ["bold", "underline_mark"])]),
    ]);
    expect(a.hasPlainUnderline).toBe(true);
  });

  it("sees no plain underlining when every underlined run is bold", () => {
    const a = analyze([block("card_body", [run("bold u", ["bold", "underline_mark"])])]);
    expect(a.hasPlainUnderline).toBe(false);
  });

  it("maps each character back to its position in the document", () => {
    const d = doc(card([tag("T"), block("card_body", [schema.text("abc")])]));
    const a = analyzeCard(groupBlocksByCard(d, all(d))[0]!);
    expect(d.textBetween(a.charPos[0]![0]!, a.charPos[0]![0]! + 1)).toBe("a");
  });

  it("takes the base size from the text that dominates the card", () => {
    const a = analyze([
      block("card_body", [run("a lot of full size text here", [], 24), run("tiny", [], 16)]),
    ]);
    expect(a.baseHalfPoints).toBe(24);
  });

  it("marks the text below the base size as small", () => {
    const a = analyze([
      block("card_body", [run("a lot of full size text here", [], 24), run("tiny bit", [], 16)]),
    ]);
    expect([...a.signatures.keys()]).toContain("small");
  });

  it("carries every block of the card", () => {
    const a = analyze([
      block("card_body", [schema.text("one")]),
      block("card_body", [schema.text("two")]),
    ]);
    expect(a.texts).toEqual(["one", "two"]);
  });
});

describe("buildFacts", () => {
  const facts = (blocks: PMNode[]) => {
    const d = doc(card([tag("T"), ...blocks]));
    return buildFacts(analyzeCard(groupBlocksByCard(d, all(d))[0]!));
  };

  it("calls bold+underline a stand-out layer when plain underlining exists", () => {
    const [fact] = facts([
      block("card_body", [run("plain u", ["underline_mark"]), run("bold u", ["bold", "underline_mark"])]),
    ]);
    expect(fact).toContain("HAS plain (non-bold) underlining");
    expect(fact).toContain("stand-out layer");
  });

  it("calls bold+underline the underline pass when nothing is plainly underlined", () => {
    const [fact] = facts([block("card_body", [run("bold u", ["bold", "underline_mark"])])]);
    expect(fact).toContain("NO plain (non-bold) underlining");
    expect(fact).toContain("IS the underline pass");
  });

  it("says a card carries no underlining at all when it does not", () => {
    expect(facts([block("card_body", [schema.text("plain body")])])).toEqual([
      "This card has NO underlining.",
    ]);
  });

  it("names a size-encoded card and states the direction the model gets backwards", () => {
    const out = facts([
      block("card_body", [run("a lot of full size text here", [], 24), run("shrunk unread text", [], 16)]),
    ]);
    expect(out[0]).toContain("SIZE-ENCODED");
    expect(out[1]).toContain("12pt");
    expect(out[1]).toContain("Do NOT underline the \"small\" text");
  });

  it("reports the shrunk share as a percentage", () => {
    const out = facts([
      block("card_body", [run("aaaaaaaaaa", [], 24), run("bbbbbbbbbb", [], 16)]),
    ]);
    expect(out[1]).toMatch(/50% of the body is shrunk/);
  });

  it("says nothing about size when a card has one size throughout", () => {
    expect(facts([block("card_body", [run("all one size", [], 24)])])[0]).toContain(
      "NO underlining",
    );
  });
});

describe("buildCardRequest", () => {
  const request = (blocks: PMNode[]) => {
    const d = doc(card([tag("T"), ...blocks]));
    return buildCardRequest(analyzeCard(groupBlocksByCard(d, all(d))[0]!));
  };

  it("carries the card text, the signature table and the facts", () => {
    const out = request([
      block("card_body", [run("plain part "), run("underlined part", ["underline_mark"])]),
    ]);
    expect(out).toContain("CARD TEXT:");
    expect(out).toContain("plain part underlined part");
    expect(out).toContain("FORMATTING SIGNATURES:");
    expect(out).toContain("FACTS:");
  });

  it("lists the signatures with the largest share first", () => {
    const out = request([
      block("card_body", [run("aaaaaaaaaaaaaaaaaaaa", ["bold"]), run("b", ["underline_mark"])]),
    ]);
    const table = out.slice(out.indexOf("FORMATTING SIGNATURES:"));
    expect(table.indexOf("\nb —")).toBeLessThan(table.indexOf("\nu —"));
  });

  it("counts a single run in the singular", () => {
    expect(request([block("card_body", [schema.text("one run only")])])).toContain("1 run,");
  });

  it("puts each block's text on its own line", () => {
    const out = request([
      block("card_body", [schema.text("one")]),
      block("card_body", [schema.text("two")]),
    ]);
    expect(out).toContain("one\ntwo");
  });
});

describe("parseFormatResponse", () => {
  const known = new Set(["plain", "u", "b+u", "hl"]);
  const parse = (text: string) => parseFormatResponse(text, known);

  it("reads a mapping", () => {
    const { plan, dropped } = parse('{"map":{"u":["u"],"b+u":["em"]}}');
    expect(dropped).toEqual([]);
    expect(plan.map.get("u")).toEqual(["u"]);
    expect(plan.map.get("b+u")).toEqual(["em"]);
  });

  it("reads an empty target as plain text", () => {
    expect(parse('{"map":{"u":[]}}').plan.map.get("u")).toEqual([]);
  });

  it("accepts the compound notation the table itself teaches", () => {
    expect(parse('{"map":{"hl":["u+hl"]}}').plan.map.get("hl")).toEqual(["u", "hl"]);
  });

  it("does not repeat a flag the model listed twice", () => {
    expect(parse('{"map":{"hl":["u","u+hl"]}}').plan.map.get("hl")).toEqual(["u", "hl"]);
  });

  it("drops a signature the table never carried, rather than failing the card", () => {
    const { plan, dropped } = parse('{"map":{"u":["u"],"invented":["b"]}}');
    expect(plan.map.has("invented")).toBe(false);
    expect(dropped.join(" ")).toContain("unknown signature");
    expect(plan.map.get("u")).toEqual(["u"]);
  });

  it("drops a target naming a flag the repair cannot produce", () => {
    const { plan, dropped } = parse('{"map":{"u":["strike"]}}');
    expect(plan.map.has("u")).toBe(false);
    expect(dropped.join(" ")).toContain("invalid target");
  });

  it("drops a target that is not an array", () => {
    expect(parse('{"map":{"u":"u"}}').plan.map.has("u")).toBe(false);
  });

  it("reads the exceptions list", () => {
    const { plan } = parse('{"map":{},"exceptions":[{"text":"Das Kapital","format":["i"]}]}');
    expect(plan.exceptions).toEqual([{ text: "Das Kapital", format: ["i"] }]);
  });

  it("drops an exception whose fragment is too short to place", () => {
    const { plan } = parse('{"map":{},"exceptions":[{"text":"ab","format":["i"]}]}');
    expect(plan.exceptions).toEqual([]);
  });

  it("drops an exception with an unusable format", () => {
    const { plan } = parse('{"map":{},"exceptions":[{"text":"a title","format":"i"}]}');
    expect(plan.exceptions).toEqual([]);
  });

  it("salvages a reply whose verbatim fragment left a quote unescaped", () => {
    const reply = '{"map":{},"exceptions":[{"text":"the "best" case","format":["i"]}]}';
    expect(parse(reply).plan.exceptions[0]!.text).toBe('the "best" case');
  });

  it("takes the first object carrying a map when the reply repeats itself", () => {
    const reply = '{"map":{"u":["u"]}}{"map":{"u":["b"]}}';
    expect(parse(reply).plan.map.get("u")).toEqual(["u"]);
  });

  it("tolerates a code fence and surrounding prose", () => {
    expect(parse('Here:\n```json\n{"map":{"u":["u"]}}\n```').plan.map.get("u")).toEqual(["u"]);
  });

  it("throws when the reply holds no JSON object", () => {
    expect(() => parse("no json")).toThrow(/no JSON object/);
  });

  it("throws when nothing in the reply parses", () => {
    expect(() => parse("{ not json at all }")).toThrow(/not valid JSON/);
  });

  it("reads a reply with no map as an empty plan", () => {
    const { plan } = parse('{"note":"nothing to change"}');
    expect(plan.map.size).toBe(0);
    expect(plan.exceptions).toEqual([]);
  });
});
