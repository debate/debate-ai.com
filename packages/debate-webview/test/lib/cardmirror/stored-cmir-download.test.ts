/**
 * @vitest-environment jsdom
 *
 * @fileoverview Downloading a document as `.docx` without opening it in
 * CardMirror first (the "Download as .docx" row in `FileTree`'s menu).
 *
 * `htmlToDocxBytes` goes through `htmlToDoc`, which needs a real `document`
 * to parse HTML into a ProseMirror doc — everything else in this file's
 * project runs under Node, so this one test file opts into jsdom rather than
 * the whole project paying for a DOM on every unrelated `lib/` test.
 */

import { describe, expect, it } from "vitest"
import { looksLikeNative } from "debate-editor/engine"
import { docxDownloadFilename, htmlToDocxBytes } from "../../../src/lib/cardmirror/stored-cmir"

describe("htmlToDocxBytes", () => {
  it("converts a document's HTML into a real .docx zip", async () => {
    const bytes = await htmlToDocxBytes("<p>Deterrence fails</p>")
    // A .docx is a zip; "PK" is the local-file-header magic every zip starts
    // with. Not a .cmir — this is the format a reader can open in Word.
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(looksLikeNative(bytes)).toBe(false)
  })

  it("never throws on empty content — a blank document is a legitimate download", async () => {
    const bytes = await htmlToDocxBytes("")
    expect(bytes.length).toBeGreaterThan(0)
  })

  it("never throws on unparsable content, falling back to a blank document", async () => {
    const bytes = await htmlToDocxBytes("<not-a-real-tag>&&&</not-a-real-tag>")
    expect(bytes.length).toBeGreaterThan(0)
  })
})

describe("docxDownloadFilename", () => {
  it("appends .docx to a title with no recognized extension", () => {
    expect(docxDownloadFilename("Notes")).toBe("Notes.docx")
  })

  it("strips an uploaded file's extension rather than doubling it up", () => {
    expect(docxDownloadFilename("Brief.cmir")).toBe("Brief.docx")
    expect(docxDownloadFilename("1AC Warming.docx")).toBe("1AC Warming.docx")
    expect(docxDownloadFilename("Notes.txt")).toBe("Notes.docx")
  })

  it("leaves a title that merely contains a dot alone", () => {
    // ".2" isn't one of the extensions the upload path recognizes, so it's
    // part of the name, not something to strip.
    expect(docxDownloadFilename("Notes v1.2")).toBe("Notes v1.2.docx")
  })

  it("falls back to Untitled for an empty or extension-only title", () => {
    expect(docxDownloadFilename("")).toBe("Untitled.docx")
    expect(docxDownloadFilename(".cmir")).toBe("Untitled.docx")
  })

  it("replaces path separators so the name can't be read as a directory", () => {
    expect(docxDownloadFilename("impacts/warming 1ac")).toBe("impacts-warming 1ac.docx")
    expect(docxDownloadFilename("a\\b")).toBe("a-b.docx")
  })
})
