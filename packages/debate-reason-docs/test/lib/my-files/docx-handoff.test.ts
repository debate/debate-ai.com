import { describe, expect, it, vi } from "vitest"
import {
  DOCX_HANDOFF_MESSAGE,
  docxNameFromUrl,
  ensureDocxName,
  fetchDocx,
  findImportedFolder,
  parseDocxImportParams,
  takeDocxFromExtension,
} from "../../../src/lib/my-files/docx-handoff"

describe("my-files/docx-handoff", () => {
  it("reads the receiver's query string", () => {
    const params = parseDocxImportParams(
      "handoff=abc-12345678&url=https%3A%2F%2Fx.org%2Ff%2FNeg%2520K.docx&name=Neg%20K.docx",
    )
    expect(params).toEqual({ handoff: "abc-12345678", url: "https://x.org/f/Neg%20K.docx", name: "Neg K.docx" })
  })

  it("drops a non-web url and a malformed handoff, and names the file from the link", () => {
    expect(parseDocxImportParams("url=javascript%3Aalert(1)&handoff=../x").url).toBeNull()
    expect(parseDocxImportParams("handoff=../x").handoff).toBeNull()
    expect(parseDocxImportParams("url=https%3A%2F%2Fx.org%2Fa%2F1AC.docx").name).toBe("1AC.docx")
    expect(docxNameFromUrl(null)).toBe("Imported.docx")
    expect(ensureDocxName("Brief")).toBe("Brief.docx")
  })

  it("finds the top-level Imported folder only", () => {
    expect(
      findImportedFolder([
        { id: 1, title: "Imported", parentId: 9, isFolder: true },
        { id: 2, title: "Imported", parentId: null, isFolder: false },
        { id: 3, title: "Imported", parentId: null, isFolder: true },
      ]),
    ).toBe(3)
    expect(findImportedFolder([])).toBeNull()
  })

  it("takes the parked file from the extension", async () => {
    const sendMessage = vi.fn((_id: string, message: unknown, callback: (response: unknown) => void) => {
      expect(message).toEqual({ type: DOCX_HANDOFF_MESSAGE, op: "take", id: "handoff-1" })
      callback({ ok: true, name: "Case.docx", base64: btoa("PK\u0003\u0004") })
    })
    const result = await takeDocxFromExtension("ext", "handoff-1", "x.docx", { sendMessage })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.name).toBe("Case.docx")
      expect(new Uint8Array(await result.file.arrayBuffer())[0]).toBe(0x50)
    }
  })

  it("reports an extension that is missing, refuses, or never answers", async () => {
    expect((await takeDocxFromExtension("ext", "h", "x", { sendMessage: null })).ok).toBe(false)
    const refuses = await takeDocxFromExtension("ext", "h", "x", {
      sendMessage: (_i, _m, cb) => cb({ ok: false, error: "gone" }),
    })
    expect(refuses).toEqual({ ok: false, error: "gone" })
    const silent = await takeDocxFromExtension("ext", "h", "x", { sendMessage: () => {}, timeoutMs: 5 })
    expect(silent.ok).toBe(false)
  })

  it("falls back to fetching the link", async () => {
    const ok = await fetchDocx("https://x.org/a.docx", "a.docx", (async () => new Response("PK")) as typeof fetch)
    expect(ok.ok && ok.file.name).toBe("a.docx")
    const blocked = await fetchDocx("https://x.org/a.docx", "a.docx", (async () => {
      throw new TypeError("cors")
    }) as typeof fetch)
    expect(blocked.ok).toBe(false)
    const missing = await fetchDocx("https://x.org/a.docx", "a.docx", (async () =>
      new Response("", { status: 404 })) as typeof fetch)
    expect(missing).toEqual({ ok: false, error: "The file's site answered 404." })
  })
})
