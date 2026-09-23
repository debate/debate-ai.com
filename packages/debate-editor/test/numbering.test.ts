import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import { computeNumbering, numRoleOf, toLetters } from "../src/editor/numbering";
import { schema } from "../src/schema/index";

const tag = (text: string) => schema.nodes["tag"]!.create(null, schema.text(text));
const card = (text: string, attrs: Record<string, unknown> = {}) =>
  schema.nodes["card"]!.create(attrs, [tag(text)]);
const heading = (name: "pocket" | "hat" | "block", attrs: Record<string, unknown> = {}) =>
  schema.nodes[name]!.create(attrs, schema.text(name));
const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

/** Labels in document order, "-" for an unnumbered card. */
function labels(d: PMNode): string[] {
  const { cards } = computeNumbering(d);
  const out: string[] = [];
  d.descendants((node, pos) => {
    if (node.type.name === "card" || node.type.name === "analytic_unit") {
      out.push(cards.get(pos)?.text ?? "-");
    }
    return true;
  });
  return out;
}

describe("toLetters", () => {
  it.each([
    [1, "a"],
    [2, "b"],
    [26, "z"],
    [27, "aa"],
    [28, "ab"],
    [52, "az"],
    [53, "ba"],
    [702, "zz"],
    [703, "aaa"],
  ])("%i -> %s", (n, s) => {
    expect(toLetters(n)).toBe(s);
  });

  it("falls back to 'a' for non-positive input", () => {
    expect(toLetters(0)).toBe("a");
    expect(toLetters(-3)).toBe("a");
  });
});

describe("numRoleOf", () => {
  it("reads number/sub and defaults to none", () => {
    expect(numRoleOf(card("x", { numRole: "number" }))).toBe("number");
    expect(numRoleOf(card("x", { numRole: "sub" }))).toBe("sub");
    expect(numRoleOf(card("x"))).toBe("none");
  });
});

describe("computeNumbering", () => {
  it("numbers cards and continues across skips", () => {
    const d = doc(
      card("a", { numRole: "number" }),
      card("b"),
      card("c", { numRole: "number" }),
    );
    expect(labels(d)).toEqual(["1", "-", "2"]);
  });

  it("letters subs and resets them on each new number, not on skips", () => {
    const d = doc(
      card("1", { numRole: "number" }),
      card("1a", { numRole: "sub" }),
      card("skip"),
      card("1b", { numRole: "sub" }),
      card("2", { numRole: "number" }),
      card("2a", { numRole: "sub" }),
    );
    expect(labels(d)).toEqual(["1", "a", "-", "b", "2", "a"]);
    const { cards } = computeNumbering(d);
    const kinds = [...cards.values()].map((l) => l.kind);
    expect(kinds).toEqual(["number", "sub", "sub", "number", "sub"]);
  });

  it("restarts at a card flagged numRestart", () => {
    const d = doc(
      card("a", { numRole: "number" }),
      card("b", { numRole: "number" }),
      card("c", { numRole: "number", numRestart: true }),
    );
    expect(labels(d)).toEqual(["1", "2", "1"]);
  });

  it("resets at pockets, hats, and restarting blocks", () => {
    const d = doc(
      card("a", { numRole: "number" }),
      heading("pocket"),
      card("b", { numRole: "number" }),
      card("c", { numRole: "number" }),
      heading("hat"),
      card("d", { numRole: "number" }),
      heading("block"),
      card("e", { numRole: "number" }),
    );
    expect(labels(d)).toEqual(["1", "1", "2", "1", "1"]);
  });

  it("carries the count through a block flagged to continue", () => {
    const d = doc(
      card("a", { numRole: "number" }),
      heading("block", { numRestart: false }),
      card("b", { numRole: "number" }),
    );
    expect(labels(d)).toEqual(["1", "2"]);
  });

  it("numbers cards inside a linked copy by their real positions", () => {
    const ref = schema.nodes["transclusion_ref"]!.create(null, [
      card("inner", { numRole: "number" }),
    ]);
    const d = doc(card("a", { numRole: "number" }), ref, card("b", { numRole: "number" }));
    expect(labels(d)).toEqual(["1", "2", "3"]);
  });

  it("ignores ordinary paragraphs", () => {
    const d = doc(
      schema.nodes["paragraph"]!.create(null, schema.text("p")),
      card("a", { numRole: "number" }),
    );
    expect(labels(d)).toEqual(["1"]);
  });
});
