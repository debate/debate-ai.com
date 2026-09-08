import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildShortcutsReferencePdf } from "../src/editor/reference-pdf-export";
import type { ShortcutsReferenceGroup } from "../src/editor/reference-export";

describe("buildShortcutsReferencePdf", () => {
  it("returns bytes starting with the PDF magic header", async () => {
    const groups: ShortcutsReferenceGroup[] = [
      {
        title: "Format",
        rows: [{ label: "Apply Cite style", keyText: "F8" }],
      },
    ];
    const bytes = await buildShortcutsReferencePdf(groups);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("round-trips through PDFDocument.load as a single page for a short reference", async () => {
    const groups: ShortcutsReferenceGroup[] = [
      { title: "Card", rows: [{ label: "Condense", keyText: "F3" }] },
    ];
    const bytes = await buildShortcutsReferencePdf(groups);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("does not fail on a group whose every command is filtered out (empty rows)", async () => {
    const groups: ShortcutsReferenceGroup[] = [
      { title: "Empty section", rows: [] },
      { title: "Real section", rows: [{ label: "Do thing", keyText: "F1" }] },
    ];
    await expect(buildShortcutsReferencePdf(groups)).resolves.toBeInstanceOf(
      Uint8Array,
    );
  });

  it("renders a title-only page for an empty group list", async () => {
    const bytes = await buildShortcutsReferencePdf([
      { title: "Nothing", rows: [] },
    ]);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("paginates onto a second page once rows overflow one page", async () => {
    const manyRows = Array.from({ length: 120 }, (_, i) => ({
      label: `Command number ${i}`,
      keyText: `Ctrl+${i}`,
    }));
    const groups: ShortcutsReferenceGroup[] = [
      { title: "Overflow", rows: manyRows },
    ];
    const bytes = await buildShortcutsReferencePdf(groups);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
  });
});
