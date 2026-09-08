/**
 * @fileoverview Foreign clipboard HTML → CardMirror structure.
 *
 * The contract that matters most is the refusal: the conversion has to EARN
 * ITS KEEP, returning null when it finds no debate structure at all, so a
 * false-positive dialect match degrades to today's ordinary paste rather than
 * to mangled output. Every "no structure" case below is that guarantee.
 *
 * Beyond it, the module has two classification layers — Word's style names,
 * and the ecosystem's visual conventions when names are absent — and both are
 * exercised, since haku's classless output reaches only the second.
 */

import { describe, expect, it } from "vitest";
import type { Node as PMNode } from "prosemirror-model";

import { convertHakuHtml, convertWordHtml } from "../src/import/html-paste";

/** Every block type in the converted doc, in document order. */
function types(doc: PMNode): string[] {
  const out: string[] = [];
  doc.descendants((node) => {
    if (!node.isText) out.push(node.type.name);
    return true;
  });
  return out;
}

/** Word wraps its clipboard HTML in a head style block plus a body. */
const wordHtml = (body: string, styleBlock = "") =>
  `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><style>${styleBlock}</style></head><body>${body}</body></html>`;

const WORD_STYLE_DICT = `
p.Heading4, li.Heading4, div.Heading4 {mso-style-name:"heading 4";}
span.Style13ptBold {mso-style-name:"Style 13 pt Bold\\,Cite";}
span.StyleUnderline {mso-style-name:"Style Underline";}
`;

describe("convertWordHtml refusals", () => {
  it("refuses plain prose, which the default paste handles better", () => {
    expect(convertWordHtml(wordHtml("<p>Just a sentence of prose.</p>"))).toBeNull();
  });

  it("refuses several plain paragraphs", () => {
    expect(
      convertWordHtml(wordHtml("<p>One paragraph.</p><p>And another.</p>")),
    ).toBeNull();
  });

  it("refuses an empty body", () => {
    expect(convertWordHtml(wordHtml(""))).toBeNull();
    expect(convertWordHtml(wordHtml("<p></p>"))).toBeNull();
  });

  it("refuses html carrying nothing but whitespace", () => {
    expect(convertWordHtml(wordHtml("<p>   </p><p>&nbsp;</p>"))).toBeNull();
  });

  it("refuses text that is merely bold, with no structure behind it", () => {
    expect(convertWordHtml(wordHtml("<p><b>Bold but not a tag</b></p>"))).toBeNull();
  });

  it("refuses html that is not html at all rather than throwing", () => {
    expect(() => convertWordHtml("not <<< html")).not.toThrow();
    expect(convertWordHtml("")).toBeNull();
  });
});

describe("convertWordHtml by style name", () => {
  it("reads a Heading 4 paragraph as a card's tag", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p class="Heading4">Warming is real</p><p>Body text of the card.</p>`,
        WORD_STYLE_DICT,
      ),
    );
    expect(doc).not.toBeNull();
    expect(types(doc!)).toContain("card");
    expect(types(doc!)).toContain("tag");
    expect(doc!.textContent).toContain("Warming is real");
  });

  it("keeps the body text under the tag it followed", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p class="Heading4">Warming is real</p><p>Body text of the card.</p>`,
        WORD_STYLE_DICT,
      ),
    )!;
    expect(doc.textContent).toContain("Body text of the card.");
    expect(types(doc)).toContain("card_body");
  });

  it("reads a cite run's style as the cite mark", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p class="Heading4">Tag</p><p><span class="Style13ptBold">Lovelace 24</span> the rest</p>`,
        WORD_STYLE_DICT,
      ),
    );
    expect(doc).not.toBeNull();
    expect(doc!.textContent).toContain("Lovelace 24");
  });

  it("reads an underline run's style as the underline mark", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p class="Heading4">Tag</p><p>plain <span class="StyleUnderline">underlined</span></p>`,
        WORD_STYLE_DICT,
      ),
    )!;
    let sawUnderline = false;
    doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === "underline_mark")) {
        sawUnderline = true;
      }
      return true;
    });
    expect(sawUnderline).toBe(true);
  });

  it("hands back a document that passes its own schema check", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p class="Heading4">Warming is real</p><p>Body.</p><p class="Heading4">Second tag</p>`,
        WORD_STYLE_DICT,
      ),
    )!;
    expect(() => doc.check()).not.toThrow();
  });

  it("keeps two tags as two cards", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p class="Heading4">First</p><p>a</p><p class="Heading4">Second</p><p>b</p>`,
        WORD_STYLE_DICT,
      ),
    )!;
    expect(types(doc).filter((t) => t === "card")).toHaveLength(2);
  });

  it("drops the empty paragraphs at the edges of a copy", () => {
    const doc = convertWordHtml(
      wordHtml(
        `<p>&nbsp;</p><p class="Heading4">Tag</p><p>body</p><p>&nbsp;</p>`,
        WORD_STYLE_DICT,
      ),
    )!;
    expect(doc.firstChild!.type.name).toBe("card");
    expect(doc.lastChild!.textContent).not.toBe("");
  });
});

describe("convertWordHtml by visual convention", () => {
  // Word spells <w:outlineLvl> as mso-outline-level (one higher), and the
  // importer promotes only when the run's size and weight agree with it —
  // the guard that keeps a merely-large line from becoming a heading.
  const outlined = (level: number, pt: number, text: string, extra = "") =>
    `<p style="mso-outline-level:${level};font-size:${pt}.0pt${extra}"><b style="font-size:${pt}.0pt">${text}</b></p>`;

  it("promotes a bold 13pt outline-4 line to a tag", () => {
    const doc = convertWordHtml(
      wordHtml(`${outlined(4, 13, "Warming is real")}<p style="font-size:11.0pt">Body text here.</p>`),
    );
    expect(doc).not.toBeNull();
    expect(types(doc!)).toContain("tag");
  });

  it("promotes a bold 26pt outline-1 line to the outermost heading", () => {
    const doc = convertWordHtml(
      wordHtml(`${outlined(1, 26, "Pocket")}${outlined(4, 13, "Tag")}<p>body</p>`),
    );
    expect(doc).not.toBeNull();
    expect(types(doc!)).toContain("pocket");
  });

  it("promotes a bold 22pt outline-2 line to the middle heading", () => {
    const doc = convertWordHtml(
      wordHtml(`${outlined(2, 22, "Hat")}${outlined(4, 13, "Tag")}<p>body</p>`),
    );
    expect(doc).not.toBeNull();
    expect(types(doc!)).toContain("hat");
  });

  it("refuses to promote an outline level whose size does not agree with it", () => {
    // Outline 1 without the 26pt bold run stays a paragraph, so the paste
    // finds no structure at all rather than inventing a pocket.
    expect(
      convertWordHtml(wordHtml(`${outlined(1, 11, "Not really a pocket")}<p>body</p>`)),
    ).toBeNull();
  });

  it("reads a plain underline as the underline mark", () => {
    const doc = convertWordHtml(
      wordHtml(`${outlined(4, 13, "Tag")}<p>plain <u>underlined</u> text</p>`),
    )!;
    let sawUnderline = false;
    doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === "underline_mark")) {
        sawUnderline = true;
      }
      return true;
    });
    expect(sawUnderline).toBe(true);
  });

  it("keeps the text of a converted paste intact", () => {
    const doc = convertWordHtml(
      wordHtml(`${outlined(4, 13, "Warming is real")}<p>First body line. Second sentence.</p>`),
    )!;
    expect(doc.textContent).toContain("Warming is real");
    expect(doc.textContent).toContain("First body line. Second sentence.");
  });

  it("hands back a document that passes its own schema check", () => {
    const doc = convertWordHtml(
      wordHtml(`${outlined(1, 26, "Pocket")}${outlined(4, 13, "Tag")}<p>body</p>`),
    )!;
    expect(() => doc.check()).not.toThrow();
  });
});

describe("convertHakuHtml", () => {
  const haku = (body: string) => `<html><body>${body}</body></html>`;

  it("refuses classless prose with no structure, as the Word path does", () => {
    expect(convertHakuHtml(haku("<p>Just prose.</p>"))).toBeNull();
    expect(convertHakuHtml(haku(""))).toBeNull();
  });

  it("reads haku's inline-styled tag through the visual rules", () => {
    const doc = convertHakuHtml(
      haku(`<h4 style="font-size:13pt;font-weight:bold">Warming is real</h4><p>Body.</p>`),
    );
    expect(doc).not.toBeNull();
    expect(types(doc!)).toContain("tag");
  });

  it("hands back a document that passes its own schema check", () => {
    const doc = convertHakuHtml(
      haku(`<h4 style="font-size:13pt;font-weight:bold">Tag</h4><p>Body <u>underlined</u>.</p>`),
    )!;
    expect(() => doc.check()).not.toThrow();
  });

  it("keeps the text of a converted paste intact", () => {
    const doc = convertHakuHtml(
      haku(`<h4 style="font-size:13pt;font-weight:bold">Tag text</h4><p>Body text.</p>`),
    )!;
    expect(doc.textContent).toContain("Tag text");
    expect(doc.textContent).toContain("Body text.");
  });

  it("survives html that is not html rather than throwing", () => {
    expect(() => convertHakuHtml("not <<< html")).not.toThrow();
  });
});
