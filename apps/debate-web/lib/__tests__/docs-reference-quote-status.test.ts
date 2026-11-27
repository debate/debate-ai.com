/**
 * @fileoverview Pins the card-text status icons on the journal References
 * pages (`packages/debate-help-docs/lib/reference-quote-status.ts`): how an
 * entry's quote is classified, that the rehype plugin puts the icon on each
 * entry's summary line, and the checks on a suggested text
 * (`lib/reference-suggestions.ts`).
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, describe, expect, it } from "vitest"
import { parseReferences } from "../../../../packages/debate-help-docs/lib/mdx/citation-cards"
import {
  QUOTE_STATUS_COMPONENT,
  rehypeCitationCards,
} from "../../../../packages/debate-help-docs/lib/mdx/rehype-citation-cards"
import {
  canSuggestText,
  referenceQuoteStatus,
} from "../../../../packages/debate-help-docs/lib/reference-quote-status"
import {
  MAX_SUGGESTION_TEXT_LENGTH,
  parseReferenceSuggestion,
  splitReferenceHref,
} from "../../../../packages/debate-help-docs/lib/reference-suggestions"

const card = (quote: string) =>
  `<div class="debate-card"><p>Description</p><p><em>Qualification</em></p><hr /><p>${quote}</p></div>`

describe("referenceQuoteStatus", () => {
  it("is underlined when the quote has underlined text", () => {
    expect(referenceQuoteStatus(card("<u><mark>Change</mark></u> comes from power."))).toBe("underlined")
    expect(referenceQuoteStatus(card("<u>Change</u> comes from power. […] <u>More.</u>"))).toBe("underlined")
  })

  it("is full when the quote is plain text", () => {
    expect(referenceQuoteStatus(card("Change comes from power and always has."))).toBe("full")
  })

  it("is ellipses when the quote holds only gap markers", () => {
    for (const marker of ["...", "…", "[…]", "[...]", "(...)", "[…] […] ...", "<u>[…]</u>"]) {
      expect(referenceQuoteStatus(card(marker))).toBe("ellipses")
    }
  })

  it("is not ellipses when real words sit between gaps", () => {
    expect(referenceQuoteStatus(card("[…] power […]"))).toBe("full")
  })

  it("is missing when the card has no rule, no card, or an empty quote", () => {
    expect(referenceQuoteStatus('<div class="debate-card"><p>Only a description.</p></div>')).toBe("missing")
    expect(referenceQuoteStatus("")).toBe("missing")
    expect(referenceQuoteStatus(undefined)).toBe("missing")
    expect(referenceQuoteStatus(card(""))).toBe("missing")
    expect(referenceQuoteStatus(card("&nbsp; <u> </u>"))).toBe("missing")
  })

  it("ignores underlining that is only in the description above the rule", () => {
    expect(referenceQuoteStatus('<div><p><u>Description</u></p><hr /><p>Plain quote text here.</p></div>')).toBe("full")
  })

  it("lets readers suggest text only where it is missing or only ellipses", () => {
    expect(canSuggestText("missing")).toBe(true)
    expect(canSuggestText("ellipses")).toBe(true)
    expect(canSuggestText("full")).toBe(false)
    expect(canSuggestText("underlined")).toBe(false)
  })

  it("classifies every entry of the shipped References pages", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packages/debate-help-docs/content/docs/journal")
    const tally: Record<string, number> = {}
    for (const dir of readdirSync(root)) {
      let source: string
      try {
        source = readFileSync(join(root, dir, "references.mdx"), "utf8")
      } catch {
        continue
      }
      for (const entry of parseReferences(source)) {
        const status = referenceQuoteStatus(entry.cardHtml)
        tally[status] = (tally[status] ?? 0) + 1
        // An entry with a quote that has underlining must never read as missing.
        if (entry.cardHtml.includes("<hr") && /<u[\s>]/.test(entry.cardHtml.split(/<hr\s*\/?>/)[1] ?? "")) {
          expect(["underlined", "ellipses"]).toContain(status)
        }
      }
    }
    expect(tally.underlined).toBeGreaterThan(100)
    expect(tally.missing).toBeGreaterThan(0)
  })
})

describe("rehypeCitationCards on a References page", () => {
  const root = mkdtempSync(join(tmpdir(), "reference-status-"))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  const dir = join(root, "content/docs/journal/synergy-slayer-critiques")
  mkdirSync(dir, { recursive: true })
  const file = join(dir, "references.mdx")
  writeFileSync(
    file,
    [
      "---",
      "title: References",
      "---",
      "",
      `1. <details><summary>Doe, Jane. 2020. <em>Full Book</em>.</summary><div className="debate-card"><p>Desc</p><hr /><p><u>Quoted words that are read aloud.</u></p></div></details>`,
      `2. <details><summary>Roe, Rick. 2021. <em>Lost Book</em>.</summary><div className="debate-card"><p>Desc only</p></div></details>`,
      "3. Poe, Edgar. *Plain Entry*. 2022.",
    ].join("\n"),
  )

  const element = (tagName: string, children: unknown[] = []) => ({ type: "element", tagName, properties: {}, children })
  const jsx = (name: string, children: unknown[] = []) => ({ type: "mdxJsxTextElement", name, attributes: [], children })
  const text = (value: string) => ({ type: "text", value })
  const tree = () => ({
    type: "root",
    children: [
      element("ol", [
        element("li", [jsx("details", [jsx("summary", [text("Doe")]), jsx("div")])]),
        element("li", [jsx("details", [jsx("summary", [text("Roe")]), jsx("div")])]),
        element("li", [text("Poe")]),
      ]),
    ],
  })

  type Node = { name?: string; tagName?: string; attributes?: { name: string; value: string }[]; children?: Node[]; properties?: Record<string, unknown> }
  const attr = (node: Node, name: string) => node.attributes?.find((a) => a.name === name)?.value

  it("puts the status icon last on each entry's summary line, or on a plain entry's item", () => {
    const t = tree()
    rehypeCitationCards()(t as never, { path: file })
    const items = (t.children[0] as Node).children!
    expect(items.map((li) => li.properties?.id)).toEqual(["ref-doe-2020", "ref-roe-2021", "ref-poe-2022"])

    const summaries = items.slice(0, 2).map((li) => li.children![0]!.children![0]!)
    const icons = summaries.map((summary) => summary.children![summary.children!.length - 1]!)
    for (const icon of icons) expect(icon.name).toBe(QUOTE_STATUS_COMPONENT)
    expect(icons.map((icon) => attr(icon, "status"))).toEqual(["underlined", "missing"])
    expect(attr(icons[1]!, "href")).toBe("/docs/journal/synergy-slayer-critiques/references#ref-roe-2021")
    expect(attr(icons[1]!, "title")).toBe("Roe, Rick. 2021. Lost Book.")

    const plain = items[2]!.children![items[2]!.children!.length - 1]!
    expect(plain.name).toBe(QUOTE_STATUS_COMPONENT)
    expect(attr(plain, "status")).toBe("missing")
  })
})

describe("splitReferenceHref", () => {
  it("reads a docs page and its entry anchor", () => {
    expect(splitReferenceHref("/docs/journal/x/references#ref-doe-2020")).toEqual({
      page: "/docs/journal/x/references",
      refId: "ref-doe-2020",
    })
  })

  it("refuses anything that is not a docs reference link", () => {
    for (const href of [
      "/docs/journal/x/references",
      "https://evil.example/docs/x#ref-a-1",
      "/docs/x/references#intro",
      "/other/x#ref-a-1",
      "/docs/../etc#ref-a-1",
    ]) {
      expect(splitReferenceHref(href)).toBeUndefined()
    }
  })
})

describe("parseReferenceSuggestion", () => {
  const TEXT = "Change comes from power, and power comes from organized people acting together over time."
  const valid = { page: "/docs/journal/x/references", refId: "ref-doe-2020", text: TEXT }

  it("accepts and cleans a suggestion", () => {
    const parsed = parseReferenceSuggestion({
      ...valid,
      page: "/docs/journal/x/references/",
      text: `  ${TEXT}\r\n\u0000\u200B  `,
      title: "Doe, Jane.   2020.",
    })
    expect(parsed).toEqual({
      ok: true,
      value: {
        page: "/docs/journal/x/references",
        refId: "ref-doe-2020",
        title: "Doe, Jane. 2020.",
        text: TEXT,
      },
    })
  })

  it("ignores the retired name and note fields", () => {
    expect(parseReferenceSuggestion({ ...valid, name: "Sam", note: "n".repeat(5000) })).toEqual({
      ok: true,
      value: { page: valid.page, refId: valid.refId, title: "", text: TEXT },
    })
  })

  it("rejects a body that is not an object, or a reference it cannot identify", () => {
    for (const body of [null, "text", [], 5]) expect(parseReferenceSuggestion(body).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, page: "https://evil.example/docs/x" }).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, page: "/admin" }).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, refId: "intro" }).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, refId: "ref-" + "a".repeat(200) }).ok).toBe(false)
  })

  it("enforces the text limits", () => {
    expect(parseReferenceSuggestion({ ...valid, text: "" }).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, text: "Too short to be a card." }).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, text: "word ".repeat(MAX_SUGGESTION_TEXT_LENGTH) }).ok).toBe(false)
    expect(parseReferenceSuggestion({ ...valid, text: 42 }).ok).toBe(false)
  })

  it("turns away link spam", () => {
    const spam = `${TEXT} http://a.example http://b.example http://c.example http://d.example`
    expect(parseReferenceSuggestion({ ...valid, text: spam }).ok).toBe(false)
  })

  it("flags a filled honeypot", () => {
    expect(parseReferenceSuggestion({ ...valid, website: "http://spam.example" })).toMatchObject({ ok: false, honeypot: true })
    expect(parseReferenceSuggestion({ ...valid, website: "  " }).ok).toBe(true)
  })
})
