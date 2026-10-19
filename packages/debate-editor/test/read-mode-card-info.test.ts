import { describe, expect, it } from "vitest";
import { EditorState, TextSelection } from "prosemirror-state";
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "../src/schema/index";
import { readModePlugin, PMD_READ_MODE_TOGGLE } from "../src/editor/read-mode-plugin";
import { citeAuthorYear, citeReadLabel, cardHighlightInfo } from "../src/editor/card-read-info";
import { convertCardsToReadMode } from "../src/editor/convert-cards-to-read-mode";

/**
 * Read mode parses every card: whether its body is highlighted, and the
 * cite's author last name and year. It shows the tag, then "Smith 21" in
 * place of the cite, then only the highlighting — or, for a card with no
 * highlighting, only the underlined text.
 */

const t = (text: string, ...marks: string[]) =>
  schema.text(text, marks.map((m) => schema.marks[m]!.create()));

function card(cite: PMNode[], body: PMNode[]): PMNode {
  return schema.nodes.card!.create(null, [
    schema.nodes.tag!.create(null, t("Warming causes extinction")),
    schema.nodes.cite_paragraph!.create(null, cite),
    schema.nodes.card_body!.create(null, body),
  ]);
}

const SMITH_CITE = [
  t("Smith 21", "cite_mark"),
  t(" [John Smith, Professor at Harvard, 2021, \"Climate\", https://example.com]"),
];

function readModeOn(doc: PMNode) {
  const state = EditorState.create({ doc, plugins: [readModePlugin] });
  return state.apply(state.tr.setMeta(PMD_READ_MODE_TOGGLE, true));
}

/** The text read mode shows, by textblock, with cite labels inlined. */
function visibleText(doc: PMNode): string[] {
  const state = readModeOn(doc);
  const decos = readModePlugin.getState(state)!.decorations;
  const lines: string[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let line = "";
    for (const d of decos.find(pos + 1, pos + 1)) {
      const spec = d.spec as { key?: string };
      if (spec.key?.startsWith("pmd-rm-cite-label:")) line += spec.key.slice("pmd-rm-cite-label:".length);
    }
    node.forEach((child, offset) => {
      if (!child.isText) return;
      const from = pos + 1 + offset;
      const hidden = decos
        .find(from, from + child.nodeSize)
        .some((d) => d.from === from && (d as unknown as { type: { attrs: { class?: string } } }).type.attrs?.class === "pmd-rm-hide");
      if (!hidden) line += child.text;
    });
    lines.push(line);
    return false;
  });
  return lines;
}

describe("card read info", () => {
  it("parses the author last name and year from the cite", () => {
    const cite = schema.nodes.cite_paragraph!.create(null, SMITH_CITE);
    expect(citeAuthorYear(cite)).toEqual({ lastName: "Smith", year: 2021 });
    expect(citeReadLabel(cite)).toBe("Smith 21");
  });

  it("parses a cite with no cite-styled short cite", () => {
    const cite = schema.nodes.cite_paragraph!.create(null, t("John Smith, 2021, Professor at Harvard"));
    expect(citeReadLabel(cite)).toBe("Smith 21");
  });

  it("shows whatever part of the cite parsed", () => {
    const noYear = schema.nodes.cite_paragraph!.create(null, t("Mearsheimer", "cite_mark"));
    expect(citeReadLabel(noYear)).toBe("Mearsheimer");
  });

  it("detects whether the card body is highlighted", () => {
    expect(cardHighlightInfo(card(SMITH_CITE, [t("plain "), t("lit", "highlight")])).hasHighlight).toBe(true);
    expect(cardHighlightInfo(card(SMITH_CITE, [t("plain "), t("under", "underline_mark")])).hasHighlight).toBe(false);
  });
});

describe("read mode per card", () => {
  it("shows tag, author/year, then only the highlighting of a highlighted card", () => {
    const doc = schema.nodes.doc!.create(null, [
      card(SMITH_CITE, [t("skipped "), t("underlined ", "underline_mark"), t("read this", "underline_mark", "highlight")]),
    ]);
    expect(visibleText(doc)).toEqual(["Warming causes extinction", "Smith 21", "read this"]);
  });

  it("shows only the underlining of a card with no highlighting", () => {
    const doc = schema.nodes.doc!.create(null, [
      card(SMITH_CITE, [t("skipped "), t("underlined ", "underline_mark"), t("emphasized", "emphasis_mark")]),
    ]);
    expect(visibleText(doc)).toEqual(["Warming causes extinction", "Smith 21", "underlined emphasized"]);
  });

  it("falls back to the cite's marked text when nothing parses", () => {
    const doc = schema.nodes.doc!.create(null, [card([t("—", "cite_mark")], [t("lit", "highlight")])]);
    expect(visibleText(doc)).toEqual(["Warming causes extinction", "—", "lit"]);
  });

  it("Convert Cards to Read Mode writes the same result", () => {
    const doc = schema.nodes.doc!.create(null, [
      card(SMITH_CITE, [t("skipped "), t("underlined", "underline_mark")]),
    ]);
    const state = EditorState.create({ doc, selection: TextSelection.create(doc, 3) });
    let next: EditorState | null = null;
    convertCardsToReadMode(state, (tr) => {
      next = state.apply(tr);
    });
    const converted = (next as EditorState | null)!.doc.firstChild!;
    expect(converted.child(1).textContent).toBe("Smith 21");
    expect(converted.child(2).textContent).toBe("underlined");
  });
});
