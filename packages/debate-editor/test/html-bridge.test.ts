/**
 * @fileoverview HTML <-> CardMirror-doc bridge.
 *
 * For the web hosts (the `/reason-editor` route, Flow's speech-doc panels)
 * this HTML string IS the stored document: it is what `onChange` hands back
 * and what a later `content` prop loads. So a node the round trip drops isn't
 * a rendering glitch — it is deleted from the saved file the next time the
 * document is written, and a parse that silently yields nothing empties the
 * file outright. Both are pinned here.
 */

import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import { docToHtml, htmlToDoc, isBlankDoc, parseHtml } from "../src/react/html-bridge";
import { schema } from "../src/schema/index";

const textBlock = (name: string, value: string) =>
  schema.nodes[name]!.createChecked(null, value ? schema.text(value) : Fragment.empty);
const doc = (...blocks: PMNode[]) =>
  schema.nodes["doc"]!.createChecked(null, Fragment.fromArray(blocks));

/** Structure + text, the shape a round trip has to preserve. */
function outline(node: PMNode): string {
  const lines: string[] = [];
  const walk = (n: PMNode, depth: number): void => {
    lines.push(`${"  ".repeat(depth)}${n.type.name}${n.isText ? `:${n.text}` : ""}`);
    n.forEach((child) => walk(child, depth + 1));
  };
  walk(node, 0);
  return lines.join("\n");
}

/** A card-shaped document — the structure a debate file is actually made of. */
function cardDoc(): PMNode {
  return doc(
    textBlock("pocket", "Economy"),
    schema.nodes["card"]!.createChecked(
      null,
      Fragment.fromArray([
        textBlock("tag", "Warming is real"),
        textBlock("cite_paragraph", "Smith 24"),
        schema.nodes["card_body"]!.createChecked(
          null,
          Fragment.fromArray([
            schema.text("Temperatures ", [schema.marks["bold"]!.create()]),
            schema.text("rose", [schema.marks["highlight"]!.create()]),
          ]),
        ),
      ]),
    ),
    schema.nodes["analytic_unit"]!.createChecked(
      null,
      Fragment.fromArray([textBlock("analytic", "So the impact turns"), textBlock("card_body", "…")]),
    ),
  );
}

describe("docToHtml / htmlToDoc", () => {
  it("round trips a card document's structure and marks", () => {
    const source = cardDoc();
    expect(outline(htmlToDoc(docToHtml(source)))).toBe(outline(source));
  });

  it("round trips a footnote instead of dropping it", () => {
    // A footnote ref serializes to an EMPTY `<sup>` carrying its text in
    // `data-content`. ProseMirror collects mark rules before node rules, so
    // at equal priority the generic `superscript` mark rule (`{ tag: 'sup' }`)
    // matched first and the footnote came back as a superscript mark on no
    // text — i.e. gone, silently, from every saved copy after the first load.
    const source = doc(
      schema.nodes["paragraph"]!.createChecked(
        null,
        Fragment.fromArray([
          schema.text("cited"),
          schema.nodes["footnote"]!.createChecked({
            kind: "footnote",
            content: [[{ text: "Smith, 2024, p. 12" }]],
          }),
        ]),
      ),
    );

    const back = htmlToDoc(docToHtml(source));
    expect(outline(back)).toBe(outline(source));
    const footnote = back.firstChild!.child(1);
    expect(footnote.type.name).toBe("footnote");
    expect(footnote.attrs["content"]).toEqual([[{ text: "Smith, 2024, p. 12" }]]);
  });

  it("still parses ordinary superscript text as a superscript mark", () => {
    const back = htmlToDoc("<p>E = mc<sup>2</sup></p>");
    expect(back.textContent).toBe("E = mc2");
    expect(back.firstChild!.lastChild!.marks[0]!.type.name).toBe("superscript");
  });
});

describe("parseHtml", () => {
  it("reports empty input as a legitimately empty document", () => {
    for (const html of ["", "   ", "<p></p>"]) {
      const parsed = parseHtml(html);
      expect(parsed.ok).toBe(true);
      expect(isBlankDoc(parsed.doc)).toBe(true);
    }
  });

  it("reports content that did not survive parsing", () => {
    // Text nested only inside markup ProseMirror is told to skip: the parse
    // succeeds and returns an empty doc, which — reported as an edit — is how
    // a loaded file used to be saved back as nothing.
    const parsed = parseHtml("<style>.card { color: red }</style>");
    expect(parsed.ok).toBe(false);
    expect(isBlankDoc(parsed.doc)).toBe(true);
  });

  it("accepts content that parses to something a reader can see", () => {
    expect(parseHtml("<p>real text</p>").ok).toBe(true);
    const parsed = parseHtml('<p><img data-pmd-image src="data:image/png;base64,iVBORw0KGgo=" /></p>');
    expect(parsed.ok).toBe(true);
    expect(isBlankDoc(parsed.doc)).toBe(false);
  });
});

describe("isBlankDoc", () => {
  it("counts an image-only document as non-blank", () => {
    const withImage = doc(
      schema.nodes["paragraph"]!.createChecked(
        null,
        Fragment.fromArray([schema.nodes["image"]!.createChecked({ data: "iVBORw0KGgo=" })]),
      ),
    );
    expect(isBlankDoc(withImage)).toBe(false);
  });

  it("counts whitespace-only text as blank", () => {
    expect(isBlankDoc(doc(textBlock("paragraph", "   ")))).toBe(true);
  });
});
