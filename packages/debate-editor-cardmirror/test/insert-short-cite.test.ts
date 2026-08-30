import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import { schema } from "../src/schema/index";
import {
  buildInsertShortCiteTransaction,
  parseCiteYearInput,
} from "../src/editor/insert-short-cite";

function stateWithSelection(text: string, from: number, to = from): EditorState {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text(text))]);
  return EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
}

describe("parseCiteYearInput", () => {
  it("parses a plain year to a number", () => {
    expect(parseCiteYearInput("24")).toBe(24);
  });

  it("returns ND for a blank input", () => {
    expect(parseCiteYearInput("")).toBe("ND");
    expect(parseCiteYearInput("   ")).toBe("ND");
  });

  it("returns ND for non-numeric input", () => {
    expect(parseCiteYearInput("nd")).toBe("ND");
    expect(parseCiteYearInput("twenty-four")).toBe("ND");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseCiteYearInput("  2024  ")).toBe(2024);
  });
});

describe("buildInsertShortCiteTransaction", () => {
  it("inserts a formatted short cite tag at a collapsed cursor", () => {
    // "Hello world" — cursor after "Hello " (position 7, one past "Hello ").
    const state = stateWithSelection("Hello world", 7);
    const tr = buildInsertShortCiteTransaction(state, "Smith", 24);
    expect(tr).not.toBeNull();

    const doc = tr!.doc;
    expect(doc.textContent).toBe("Hello Smith 24world");
  });

  it("marks the inserted tag with cite_mark", () => {
    const state = stateWithSelection("Hello world", 7);
    const tr = buildInsertShortCiteTransaction(state, "Smith", 24)!;
    const citeType = schema.marks["cite_mark"]!;

    let sawCiteMark = false;
    tr.doc.nodesBetween(7, 7 + "Smith 24".length, (node) => {
      if (node.isText) {
        expect(citeType.isInSet(node.marks)).toBeTruthy();
        sawCiteMark = true;
      }
      return true;
    });
    expect(sawCiteMark).toBe(true);
  });

  it("replaces a non-collapsed selection instead of inserting alongside it", () => {
    // Select "world" (positions 7-12) and replace it with the cite tag.
    const state = stateWithSelection("Hello world", 7, 12);
    const tr = buildInsertShortCiteTransaction(state, "Jones", 2024)!;
    expect(tr.doc.textContent).toBe("Hello Jones 24");
  });

  it("formats ND when the year is the ND sentinel", () => {
    const state = stateWithSelection("Hello world", 0);
    const tr = buildInsertShortCiteTransaction(state, "Smith", "ND")!;
    expect(tr.doc.textContent.startsWith("Smith ND")).toBe(true);
  });

  it("formats ND when the year is null", () => {
    const state = stateWithSelection("Hello world", 0);
    const tr = buildInsertShortCiteTransaction(state, "Smith", null)!;
    expect(tr.doc.textContent.startsWith("Smith ND")).toBe(true);
  });

  it("returns null when there is no author", () => {
    const state = stateWithSelection("Hello world", 0);
    expect(buildInsertShortCiteTransaction(state, "", 24)).toBeNull();
    expect(buildInsertShortCiteTransaction(state, "   ", 24)).toBeNull();
  });
});
