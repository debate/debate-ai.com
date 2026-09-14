/**
 * @fileoverview The AI text-repair pipeline, from the model's reply through to
 * the transaction.
 *
 * Every stage here exists because of a live failure the comments name: an
 * unescaped quote inside evidence killing a whole response, two top-level JSON
 * objects poisoning a first-to-last-brace slice, a smart quote the model failed
 * to echo verbatim, two fixes whose context windows overlapped so one was
 * dropped. Those are the cases pinned below.
 */

import { describe, expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import {
  buildRepairTransaction,
  extractJsonObjects,
  flattenSelection,
  locateFixes,
  normalizeForDiagnosis,
  parseRepairResponse,
  salvageJson,
} from "../src/editor/ai/repair-text";
import { schema } from "../src/schema/index";

const para = (value: string) =>
  schema.nodes["paragraph"]!.create(null, value ? schema.text(value) : Fragment.empty);

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

/** The whole document flattened, which is what a select-all repair sees. */
const flatten = (d: PMNode) => flattenSelection(d, 0, d.content.size);

describe("salvageJson", () => {
  it("leaves well-formed JSON untouched", () => {
    const json = '{"fixes":[{"find":"a","replace":"b"}]}';
    expect(salvageJson(json)).toBe(json);
  });

  it("escapes an interior quote, the slip debate evidence provokes", () => {
    const broken = '{"find":"the "best" case"}';
    expect(JSON.parse(salvageJson(broken))).toEqual({ find: 'the "best" case' });
  });

  it("keeps a closing quote that is followed by a structural character", () => {
    for (const json of [
      '{"a":"x"}',
      '{"a":"x","b":"y"}',
      '["x","y"]',
      '{"a" : "x"}',
    ]) {
      expect(JSON.parse(salvageJson(json))).toEqual(JSON.parse(json));
    }
  });

  it("keeps a closing quote separated from its structural character by whitespace", () => {
    expect(JSON.parse(salvageJson('{"a":"x"   ,"b":"y"}'))).toEqual({ a: "x", b: "y" });
  });

  it("leaves an already-escaped quote alone", () => {
    const json = '{"find":"the \\"best\\" case"}';
    expect(JSON.parse(salvageJson(json))).toEqual({ find: 'the "best" case' });
  });

  it("escapes a literal newline inside a string", () => {
    expect(JSON.parse(salvageJson('{"find":"one\ntwo"}'))).toEqual({ find: "one\ntwo" });
  });

  it("drops a carriage return rather than escaping it", () => {
    expect(JSON.parse(salvageJson('{"find":"one\r\ntwo"}'))).toEqual({ find: "one\ntwo" });
  });

  it("leaves an escaped backslash before a quote intact", () => {
    const json = '{"find":"back\\\\"}';
    expect(JSON.parse(salvageJson(json))).toEqual({ find: "back\\" });
  });
});

describe("extractJsonObjects", () => {
  it("returns the one object in a plain reply", () => {
    expect(extractJsonObjects('{"a":1}')).toEqual(['{"a":1}']);
  });

  it("returns each top-level object separately", () => {
    expect(extractJsonObjects('{"a":1}{"b":2}')).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("skips the prose between objects", () => {
    expect(extractJsonObjects('Here you go: {"a":1} and also {"b":2}. Done.')).toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  it("keeps a nested object inside its parent rather than splitting it out", () => {
    expect(extractJsonObjects('{"a":{"b":1}}')).toEqual(['{"a":{"b":1}}']);
  });

  it("does not miscount a brace inside a string value", () => {
    expect(extractJsonObjects('{"a":"} not the end"}')).toEqual(['{"a":"} not the end"}']);
  });

  it("does not miscount an escaped quote inside a string value", () => {
    const s = '{"a":"say \\" then }"}';
    expect(extractJsonObjects(s)).toEqual([s]);
  });

  it("returns nothing for a reply with no object at all", () => {
    expect(extractJsonObjects("no json here")).toEqual([]);
  });

  it("ignores an unclosed object", () => {
    expect(extractJsonObjects('{"a":1')).toEqual([]);
  });
});

describe("parseRepairResponse", () => {
  const fixes = (text: string) => parseRepairResponse(text);

  it("reads the fixes out of a plain reply", () => {
    expect(fixes('{"fixes":[{"find":"teh","replace":"the"}]}')).toEqual([
      { find: "teh", replace: "the" },
    ]);
  });

  it("tolerates a code fence and surrounding prose", () => {
    const reply = 'Sure!\n```json\n{"fixes":[{"find":"teh","replace":"the"}]}\n```\nHope that helps.';
    expect(fixes(reply)).toEqual([{ find: "teh", replace: "the" }]);
  });

  it("salvages a reply whose evidence quote was left unescaped", () => {
    const reply = '{"fixes":[{"find":"the "best" case","replace":"the best case"}]}';
    expect(fixes(reply)).toEqual([{ find: 'the "best" case', replace: "the best case" }]);
  });

  it("merges the fixes of two top-level objects, which slicing alone poisons", () => {
    const reply = '{"fixes":[{"find":"a","replace":"b"}]}{"fixes":[{"find":"c","replace":"d"}]}';
    expect(fixes(reply)).toEqual([
      { find: "a", replace: "b" },
      { find: "c", replace: "d" },
    ]);
  });

  it("keeps the fixes of the objects it can parse when one chunk is junk", () => {
    const reply = '{"fixes":[{"find":"a","replace":"b"}]}{"fixes":[oops]}';
    expect(fixes(reply)).toEqual([{ find: "a", replace: "b" }]);
  });

  it("returns no fixes when the object carries none", () => {
    expect(fixes('{"fixes":[]}')).toEqual([]);
    expect(fixes('{"note":"nothing to fix"}')).toEqual([]);
  });

  it("drops a malformed entry rather than the whole reply", () => {
    const reply =
      '{"fixes":[{"find":"a","replace":"b"},{"find":123},{"replace":"c"},{"find":"","replace":"x"}]}';
    expect(fixes(reply)).toEqual([{ find: "a", replace: "b" }]);
  });

  it("drops a fix that changes nothing", () => {
    expect(fixes('{"fixes":[{"find":"same","replace":"same"}]}')).toEqual([]);
  });

  it("throws when the reply holds no JSON object at all", () => {
    expect(() => fixes("I could not find anything to fix.")).toThrow(/no JSON object/);
    expect(() => fixes("")).toThrow(/no JSON object/);
  });

  it("throws when nothing in the reply parses", () => {
    expect(() => fixes("{ this is not json at all }")).toThrow(/not valid JSON/);
  });
});

describe("flattenSelection", () => {
  it("flattens one paragraph to its text", () => {
    expect(flatten(doc(para("warming is real"))).text).toBe("warming is real");
  });

  it("separates blocks with a newline, so the model reads the boundary", () => {
    expect(flatten(doc(para("one"), para("two"))).text).toBe("one\ntwo");
  });

  it("maps each character back to the position before it", () => {
    const d = doc(para("abc"));
    const flat = flatten(d);
    expect(d.textBetween(flat.pos[0]!, flat.pos[0]! + 1)).toBe("a");
    expect(d.textBetween(flat.pos[2]!, flat.pos[2]! + 1)).toBe("c");
  });

  it("flattens only the range it was given", () => {
    const d = doc(para("abcdef"));
    expect(flattenSelection(d, 2, 5).text).toBe("bcd");
  });

  it("is empty for an empty document", () => {
    expect(flatten(doc(para(""))).text).toBe("");
  });

  it("joins the runs of one paragraph without a boundary between them", () => {
    const bold = schema.marks["bold"]!.create();
    const p = schema.nodes["paragraph"]!.create(
      null,
      Fragment.fromArray([schema.text("plain "), schema.text("bold", [bold])]),
    );
    expect(flatten(doc(p)).text).toBe("plain bold");
  });
});

describe("locateFixes", () => {
  const locate = (text: string, fixes: { find: string; replace: string }[]) =>
    locateFixes(flatten(doc(para(text))), fixes);

  it("places a verbatim fix", () => {
    const { located, skipped } = locate("teh cat", [{ find: "teh", replace: "the" }]);
    expect(skipped).toBe(0);
    expect(located).toHaveLength(1);
  });

  it("narrows a fix to its differing middle, not the agreeing context", () => {
    const d = doc(para("the teh cat"));
    const { located } = locateFixes(flatten(d), [
      { find: "the teh cat", replace: "the the cat" },
    ]);
    // Only the differing middle is edited: the agreeing "the " prefix and
    // " cat" suffix are left alone.
    expect(located[0]!.to - located[0]!.from).toBe(2);
    expect(located[0]!.replace).toBe("he");
  });

  it("lets two fixes whose context windows overlap coexist", () => {
    const { located, skipped } = locate("self- help and self- harm", [
      { find: "self- help", replace: "self-help" },
      { find: "self- harm", replace: "self-harm" },
    ]);
    expect(skipped).toBe(0);
    expect(located).toHaveLength(2);
  });

  it("searches forward from the previous match, so repeats map in order", () => {
    const { located } = locate("teh a teh b", [
      { find: "teh a", replace: "the a" },
      { find: "teh b", replace: "the b" },
    ]);
    expect(located).toHaveLength(2);
    expect(located[0]!.from).toBeLessThan(located[1]!.from);
  });

  it("falls back to a global search for a fix listed out of order", () => {
    const { located, skipped } = locate("alpha beta", [
      { find: "beta", replace: "gamma" },
      { find: "alpha", replace: "delta" },
    ]);
    expect(skipped).toBe(0);
    expect(located).toHaveLength(2);
  });

  it("places a fix the model echoed with a straight quote for a smart one", () => {
    const { located, skipped, notFound } = locate("the “best” case", [
      { find: 'the "best" case', replace: "the best case" },
    ]);
    expect(notFound).toEqual([]);
    expect(skipped).toBe(0);
    expect(located).toHaveLength(1);
  });

  it("places a fix the model echoed with a hyphen for an em dash", () => {
    const { skipped, located } = locate("warming — real", [
      { find: "warming - real", replace: "warming, real" },
    ]);
    expect(skipped).toBe(0);
    expect(located).toHaveLength(1);
  });

  it("places a fix whose context the model misquoted the case of", () => {
    const { skipped, located } = locate("In much of the world", [
      { find: "in much of the world", replace: "in much of the region" },
    ]);
    expect(skipped).toBe(0);
    expect(located).toHaveLength(1);
  });

  it("places a fix across a ligature the extractor left in", () => {
    const { skipped } = locate("the eﬀect", [
      { find: "the effect", replace: "the affect" },
    ]);
    expect(skipped).toBe(0);
  });

  it("places a fix across a non-breaking space", () => {
    const { skipped } = locate("warming is real", [
      { find: "warming is real", replace: "warming is true" },
    ]);
    expect(skipped).toBe(0);
  });

  it("reports a fix whose text the model invented", () => {
    const { located, skipped, notFound } = locate("warming is real", [
      { find: "cooling is real", replace: "cooling is true" },
    ]);
    expect(located).toEqual([]);
    expect(skipped).toBe(1);
    expect(notFound).toHaveLength(1);
  });

  it("drops an exact duplicate silently rather than counting it a failure", () => {
    const { located, skipped } = locate("teh cat", [
      { find: "teh", replace: "the" },
      { find: "teh", replace: "the" },
    ]);
    expect(located).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  it("reports a genuinely overlapping pair as skipped", () => {
    const { located, skipped, overlapped } = locate("aaa bbb ccc", [
      { find: "aaa bbb", replace: "xxx yyy" },
      { find: "bbb ccc", replace: "yyy zzz" },
    ]);
    expect(located).toHaveLength(1);
    expect(skipped).toBe(1);
    expect(overlapped).toHaveLength(1);
  });

  it("returns the fixes in document order", () => {
    const { located } = locate("zzz aaa", [
      { find: "aaa", replace: "bbb" },
      { find: "zzz", replace: "yyy" },
    ]);
    expect(located[0]!.from).toBeLessThan(located[1]!.from);
  });

  it("places nothing for no fixes", () => {
    expect(locate("warming", [])).toEqual({
      located: [],
      skipped: 0,
      notFound: [],
      overlapped: [],
    });
  });
});

describe("buildRepairTransaction", () => {
  const state = (text: string) => EditorState.create({ doc: doc(para(text)) });

  it("applies a single replacement", () => {
    const s = state("teh cat");
    const { located } = locateFixes(flatten(s.doc), [{ find: "teh", replace: "the" }]);
    const { tr } = buildRepairTransaction(s, located);
    expect(s.apply(tr).doc.textContent).toBe("the cat");
  });

  it("applies several fixes without the earlier ones shifting the later", () => {
    const s = state("teh cat sat on teh mat");
    const { located } = locateFixes(flatten(s.doc), [
      { find: "teh cat", replace: "the cat" },
      { find: "teh mat", replace: "the mat" },
    ]);
    const { tr } = buildRepairTransaction(s, located);
    expect(s.apply(tr).doc.textContent).toBe("the cat sat on the mat");
  });

  it("applies a pure deletion without throwing on an empty text node", () => {
    const s = state("the  double space");
    const { located } = locateFixes(flatten(s.doc), [
      { find: "the  double", replace: "the double" },
    ]);
    const { tr } = buildRepairTransaction(s, located);
    expect(s.apply(tr).doc.textContent).toBe("the double space");
  });

  it("applies an insertion", () => {
    const s = state("selfhelp");
    const { located } = locateFixes(flatten(s.doc), [
      { find: "selfhelp", replace: "self-help" },
    ]);
    const { tr } = buildRepairTransaction(s, located);
    expect(s.apply(tr).doc.textContent).toBe("self-help");
  });

  it("reports where each replacement landed, for the highlight that follows", () => {
    const s = state("teh cat");
    const { located } = locateFixes(flatten(s.doc), [{ find: "teh cat", replace: "the cat" }]);
    const { tr, ranges } = buildRepairTransaction(s, located);
    const after = s.apply(tr);
    expect(ranges).toHaveLength(1);
    // The reported range covers exactly the text that was written, which is
    // where the highlight animation has to land.
    expect(after.doc.textBetween(ranges[0]!.from, ranges[0]!.to)).toBe(located[0]!.replace);
    expect(after.doc.textContent).toBe("the cat");
  });

  it("builds an empty transaction for no fixes", () => {
    const s = state("warming");
    const { tr, ranges } = buildRepairTransaction(s, []);
    expect(ranges).toEqual([]);
    expect(s.apply(tr).doc.textContent).toBe("warming");
  });

  it("joins two blocks when a fix spans the boundary, as hyphenation needs", () => {
    const s = EditorState.create({ doc: doc(para("hyphen-"), para("ation")) });
    const { located } = locateFixes(flattenSelection(s.doc, 0, s.doc.content.size), [
      { find: "hyphen-\nation", replace: "hyphenation" },
    ]);
    expect(located).toHaveLength(1);
    const { tr } = buildRepairTransaction(s, located);
    expect(s.apply(tr).doc.textContent).toBe("hyphenation");
  });
});

describe("normalizeForDiagnosis", () => {
  it("folds smart quotes to their ASCII forms", () => {
    expect(normalizeForDiagnosis("‘a’ “b”")).toBe("'a' \"b\"");
  });

  it("folds the dashes a model fails to echo", () => {
    expect(normalizeForDiagnosis("a—b")).toBe("a--b");
    expect(normalizeForDiagnosis("a–b")).toBe("a--b");
  });

  it("folds a non-breaking space to a plain one", () => {
    expect(normalizeForDiagnosis("a b")).toBe("a b");
  });

  it("drops the invisible glyphs entirely", () => {
    expect(normalizeForDiagnosis("a­b​c﻿d¶")).toBe("abcd");
  });

  it("lowercases, so a case difference is not read as a mismatch", () => {
    expect(normalizeForDiagnosis("Warming")).toBe("warming");
  });

  it("leaves plain text alone but for its case", () => {
    expect(normalizeForDiagnosis("warming is real")).toBe("warming is real");
  });
});
