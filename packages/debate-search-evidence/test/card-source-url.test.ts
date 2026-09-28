import { describe, expect, it } from "vitest"

import { findCardSourceUrl, findUrlInText, normalizeSourceUrl } from "../src/lib/card-source-url"

describe("normalizeSourceUrl", () => {
  it("keeps an article URL", () => {
    expect(normalizeSourceUrl("https://www.foreignaffairs.com/articles/deterrence")).toBe(
      "https://www.foreignaffairs.com/articles/deterrence",
    )
  })

  it("adds a scheme to a www. link", () => {
    expect(normalizeSourceUrl("www.brookings.edu/research/x")).toBe("https://www.brookings.edu/research/x")
  })

  it("trims the punctuation a citation puts after a link", () => {
    expect(normalizeSourceUrl("https://example.com/a/b.html).")).toBe("https://example.com/a/b.html")
    expect(normalizeSourceUrl("https://example.com/a/b,")).toBe("https://example.com/a/b")
  })

  it("decodes an escaped ampersand from markup", () => {
    expect(normalizeSourceUrl("https://example.com/story?id=1&amp;page=2")).toBe("https://example.com/story?id=1&page=2")
  })

  it("rejects links that are not an article page", () => {
    expect(normalizeSourceUrl("https://www.nytimes.com")).toBeNull()
    expect(normalizeSourceUrl("https://www.nytimes.com/")).toBeNull()
    expect(normalizeSourceUrl("mailto:someone@example.com")).toBeNull()
    expect(normalizeSourceUrl("/relative/path")).toBeNull()
    expect(normalizeSourceUrl("https://localhost/x")).toBeNull()
  })

  it("keeps a homepage URL that carries a query", () => {
    expect(normalizeSourceUrl("https://example.com/?p=123")).toBe("https://example.com/?p=123")
  })
})

describe("findUrlInText", () => {
  it("finds a URL written out in a Verbatim citation", () => {
    const cite =
      "Chilton 18 — Kevin Chilton, USAF, Retired. “Defending the Record on U.S. Nuclear Deterrence,” Strategic Studies Quarterly, https://www.airuniversity.af.edu/SSQ/Display/Article/1537658/, accessed 7-12-24"
    expect(findUrlInText(cite)).toBe("https://www.airuniversity.af.edu/SSQ/Display/Article/1537658/")
  })

  it("prefers a linked href over URLs in the text", () => {
    const html = `<p>See www.other.org/page and <a href="https://example.com/source">the source</a></p>`
    expect(findUrlInText(html)).toBe("https://example.com/source")
  })

  it("skips a bare domain and keeps looking", () => {
    expect(findUrlInText("Published by www.rand.org at https://www.rand.org/pubs/reports/RR123.html")).toBe(
      "https://www.rand.org/pubs/reports/RR123.html",
    )
  })

  it("returns null when there is no URL", () => {
    expect(findUrlInText("Smith 24, Professor of Economics at Yale")).toBeNull()
    expect(findUrlInText(undefined)).toBeNull()
    expect(findUrlInText("")).toBeNull()
  })
})

describe("findCardSourceUrl", () => {
  it("reads the citation before the body", () => {
    expect(
      findCardSourceUrl({
        cite: "Smith 24, https://example.com/cite-link",
        html: `<p>The study at https://example.com/quoted-in-body found…</p>`,
      }),
    ).toBe("https://example.com/cite-link")
  })

  it("falls back to the card body when the citation has no link", () => {
    expect(
      findCardSourceUrl({
        cite: "Smith 24",
        html: `<p><a href="https://example.com/from-body">Smith 24</a></p><p>Text.</p>`,
      }),
    ).toBe("https://example.com/from-body")
  })

  it("returns null for a card with no source link", () => {
    expect(findCardSourceUrl({ cite: "Smith 24", html: "<p>Text.</p>" })).toBeNull()
  })
})
