/**
 * @fileoverview Headless `.docx` → `.cmir` conversion.
 *
 * This is what a server route runs on an uploaded file, so the contract
 * tested here is the one that matters there: a `.docx` in, a real `.cmir`
 * out (parseable by the same reader the desktop app opens files with), the
 * document's card structure intact, and a stored string that can be told
 * apart from the HTML rows imported before this format carried.
 */

import { describe, expect, it } from "vitest";
import { Fragment, type Node as PMNode } from "prosemirror-model";

import { toDocx } from "../src/export/index";
import {
  base64ToCmir,
  cmirToBase64,
  docxToCmir,
  looksLikeCmirBase64,
} from "../src/native/convert";
import { parseNative } from "../src/native/index";
import { schema } from "../src/schema/index";

const textBlock = (name: string, value: string) =>
  schema.nodes[name]!.create(null, value ? schema.text(value) : Fragment.empty);

const doc = (...blocks: PMNode[]) => schema.nodes["doc"]!.create(null, Fragment.fromArray(blocks));

/** A card-shaped document: a tag over a cite over body text, the structure
 *  the HTML importer this replaces flattened to `<p>`. */
function sampleDoc(): PMNode {
  return doc(
    textBlock("pocket", "Economy"),
    schema.nodes["card"]!.create(
      null,
      Fragment.fromArray([
        textBlock("tag", "Warming is real"),
        textBlock("cite_paragraph", "Smith 24"),
        textBlock("card_body", "Temperatures rose."),
      ]),
    ),
  );
}

async function sampleDocx(): Promise<Uint8Array> {
  return toDocx(sampleDoc());
}

describe("docxToCmir", () => {
  it("produces bytes the native reader parses back", async () => {
    const { bytes } = await docxToCmir(await sampleDocx());

    // gzip magic — a .cmir written by any other path looks the same.
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);

    const parsed = parseNative(bytes);
    expect(parsed.doc.type.name).toBe("doc");
    expect(parsed.meta.formatVersion).toBe(1);
  });

  it("keeps the document's card structure, not just its text", async () => {
    const { doc: imported } = await docxToCmir(await sampleDocx());

    const names: string[] = [];
    imported.descendants((node) => {
      names.push(node.type.name);
      return true;
    });
    expect(names).toContain("card");
    expect(names).toContain("tag");
    expect(imported.textContent).toContain("Warming is real");
    expect(imported.textContent).toContain("Temperatures rose.");
  });

  it("records the app version it was told to write", async () => {
    const { bytes } = await docxToCmir(await sampleDocx(), { appVersion: "debate-ai.com" });
    expect(parseNative(bytes).meta.createdBy).toBe("debate-ai.com");
  });

  it("refuses bytes that are not a .docx", async () => {
    await expect(docxToCmir(new TextEncoder().encode("not a zip"))).rejects.toThrow();
  });
});

describe("base64 storage", () => {
  it("round-trips the bytes unchanged", async () => {
    const { bytes } = await docxToCmir(await sampleDocx());
    expect(Array.from(base64ToCmir(cmirToBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("recognizes a stored .cmir", async () => {
    const { bytes } = await docxToCmir(await sampleDocx());
    expect(looksLikeCmirBase64(cmirToBase64(bytes))).toBe(true);
  });

  it("rejects the HTML that older imports stored", () => {
    expect(looksLikeCmirBase64("<h1>Warming is real</h1><p>Smith 24</p>")).toBe(false);
    expect(looksLikeCmirBase64("  <p>leading whitespace</p>")).toBe(false);
    expect(looksLikeCmirBase64("")).toBe(false);
  });

  it("recognizes a stored .cmir far longer than the head it decodes", async () => {
    // The sniff only decodes the start of the string. Inflating that slice
    // would fail on any file big enough to be truncated by it, so a document
    // whose base64 dwarfs the head has to be recognized just the same.
    const long = doc(
      ...Array.from({ length: 500 }, (_, index) =>
        textBlock("paragraph", `Card ${index}: escalation is uncontrollable.`),
      ),
    );
    const { bytes } = await docxToCmir(await toDocx(long));
    const stored = cmirToBase64(bytes);
    expect(stored.length).toBeGreaterThan(2000);
    expect(looksLikeCmirBase64(stored)).toBe(true);
  });

  it("recognizes an uncompressed file written before .cmir was gzipped", () => {
    const legacy = JSON.stringify({
      format: "cardmirror-doc",
      formatVersion: 1,
      createdBy: "CardMirror",
      createdAt: new Date().toISOString(),
      doc: {},
    });
    expect(looksLikeCmirBase64(cmirToBase64(new TextEncoder().encode(legacy)))).toBe(true);
  });

  it("rejects base64 of something that is not a CardMirror file", () => {
    expect(looksLikeCmirBase64(cmirToBase64(new TextEncoder().encode("plain text")))).toBe(false);
  });
});
