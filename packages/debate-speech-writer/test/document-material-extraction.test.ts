import { describe, expect, it } from "vitest";
import {
  detectDocumentKind,
  extractMaterialTextFromDocument,
} from "../src/coach/document-material-extraction";

describe("detectDocumentKind", () => {
  it("detects plain-text extensions", () => {
    expect(detectDocumentKind("notes.txt")).toBe("text");
    expect(detectDocumentKind("outline.md")).toBe("text");
    expect(detectDocumentKind("outline.markdown")).toBe("text");
  });

  it("detects a .docx extension", () => {
    expect(detectDocumentKind("Lecture.docx")).toBe("docx");
  });

  it("is case-insensitive", () => {
    expect(detectDocumentKind("Lecture.DOCX")).toBe("docx");
    expect(detectDocumentKind("Notes.TXT")).toBe("text");
  });

  it("returns null for an unsupported or missing extension", () => {
    expect(detectDocumentKind("recording.mp4")).toBeNull();
    expect(detectDocumentKind("no-extension")).toBeNull();
    expect(detectDocumentKind("scan.pdf")).toBeNull();
  });
});

describe("extractMaterialTextFromDocument", () => {
  it("returns a string text file's content, whitespace-normalized", async () => {
    const text = await extractMaterialTextFromDocument({
      fileName: "notes.txt",
      content: "  Topicality   is\n\na voting issue.  ",
    });
    expect(text).toBe("Topicality is a voting issue.");
  });

  it("reads a Blob text file's content", async () => {
    const blob = new Blob(["Stay respectful during cross-ex."], { type: "text/plain" });
    const text = await extractMaterialTextFromDocument({ fileName: "etiquette.md", content: blob });
    expect(text).toBe("Stay respectful during cross-ex.");
  });

  it("throws for an empty text file", async () => {
    await expect(
      extractMaterialTextFromDocument({ fileName: "empty.txt", content: "   " }),
    ).rejects.toThrow('No readable text found in "empty.txt".');
  });

  it("throws for an unsupported extension", async () => {
    await expect(
      extractMaterialTextFromDocument({ fileName: "recording.mp4", content: "" }),
    ).rejects.toThrow('Unsupported file type: "recording.mp4". Upload a .docx, .txt, or .md file.');
  });

  it("extracts a .docx file's text through convertDocxToHTML, whitespace-normalized", async () => {
    const convertDocx = async (
      _content: unknown,
      opts?: { plainTextOnly?: boolean },
    ): Promise<string> => {
      expect(opts).toEqual({ plainTextOnly: true });
      return "  A disad needs   a clear\nlink chain.  ";
    };

    const text = await extractMaterialTextFromDocument(
      { fileName: "Disad-Links.docx", content: new ArrayBuffer(0) },
      { convertDocx },
    );
    expect(text).toBe("A disad needs a clear link chain.");
  });

  it("throws when a .docx file yields no readable text", async () => {
    const convertDocx = async (): Promise<string> => "   ";

    await expect(
      extractMaterialTextFromDocument(
        { fileName: "Blank.docx", content: new ArrayBuffer(0) },
        { convertDocx },
      ),
    ).rejects.toThrow('No readable text found in "Blank.docx".');
  });
});
