/**
 * @vitest-environment jsdom
 *
 * @fileoverview `storedContentToHtml` (aliased for the Topic Starter catalogue
 * as `topicStarterHtml`) turns a stored row's `content`/`format` into HTML —
 * previously only fed to the editor's `content` prop, where a bug would just
 * be a rendering glitch. `downloadTopicDocument`
 * (`components/reason-docs/ReasonDocsProvider.tsx`) now also feeds its output
 * into `htmlToDocxBytes` for the Topic Starter Tree's "Download as .docx" row
 * action, where the same bug would produce a broken or silently wrong file
 * download instead. This file is the coverage that gap needed and didn't
 * have — see `stored-cmir-download.test.ts` for the sibling `htmlToDocxBytes`/
 * `docxDownloadFilename` coverage `downloadTopicDocument` also relies on.
 */

import { describe, expect, it } from "vitest"
import { schema, serializeNative, cmirToBase64 } from "debate-editor/engine"
import { storedContentToHtml } from "../stored-cmir"
import { topicStarterHtml } from "../../topic-starters/content"

/** A real one-paragraph `.cmir`, base64-encoded the way a row stores it. */
function sampleCmir(text: string): string {
  const doc = schema.nodes["doc"]!.create(null, [
    schema.nodes["paragraph"]!.create(null, [schema.text(text)]),
  ])
  return cmirToBase64(serializeNative(doc))
}

describe("storedContentToHtml", () => {
  it("passes a legacy HTML row through untouched", () => {
    expect(storedContentToHtml({ content: "<p>Deterrence fails</p>", format: "html" })).toBe(
      "<p>Deterrence fails</p>",
    )
  })

  it("parses a .cmir row and serializes it back to HTML", () => {
    const html = storedContentToHtml({ content: sampleCmir("Deterrence fails"), format: "cmir" })
    expect(html).toContain("Deterrence fails")
    expect(html).toMatch(/<p[^>]*>/)
  })

  it("sniffs a .cmir row that arrives without its format column", () => {
    const html = storedContentToHtml({ content: sampleCmir("Warming is real") })
    expect(html).toContain("Warming is real")
  })

  it("treats an absent content column as an empty document", () => {
    expect(storedContentToHtml({})).toBe("")
  })

  it("shows a notice rather than throwing on a .cmir that will not parse", () => {
    const html = storedContentToHtml({ content: "not actually gzipped base64", format: "cmir" })
    expect(html).toContain("could not be opened")
  })

  it("escapes the parse error message rather than injecting it as markup", () => {
    // The error text is whatever the gunzip/parse layer throws, not
    // attacker-controlled, but the row's title/content is user-supplied
    // upstream — this pins that a `<`/`>`/`&` in that text can't break out of
    // the wrapping <p>.
    const html = storedContentToHtml({ content: "<script>bad</script>", format: "cmir" })
    expect(html).not.toContain("<script>bad</script>")
    expect(html).toContain("could not be opened")
  })
})

describe("topicStarterHtml", () => {
  it("is the same conversion storedContentToHtml runs, for the Topic Starter catalogue's own rows", () => {
    const cmir = sampleCmir("Nuclear deterrence fails")
    expect(topicStarterHtml({ content: cmir, format: "cmir" })).toBe(
      storedContentToHtml({ content: cmir, format: "cmir" }),
    )
  })
})
