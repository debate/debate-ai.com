/**
 * The docs' saved suggested-question answers
 * (`packages/debate-help-docs/components/guides/saved-answers.ts`) and how an
 * answer's Markdown is rendered (`answer-markdown.ts`). Lives here because
 * debate-help-docs is not a Vitest project of its own.
 */
import { describe, expect, it } from "vitest"
import { renderAnswerMarkdown } from "../../../../packages/debate-help-docs/components/guides/answer-markdown"
import {
  isSavedAnswersPage,
  normalizeQuestion,
  parseSavedAnswerWrite,
  savedAnswersPageKey,
} from "../../../../packages/debate-help-docs/components/guides/saved-answers"

describe("normalizeQuestion", () => {
  it("ignores case, spacing and closing punctuation", () => {
    expect(normalizeQuestion("  What is   Dasein? ")).toBe("what is dasein")
    expect(normalizeQuestion("What is Dasein")).toBe("what is dasein")
  })
})

describe("page keys", () => {
  it("accepts docs paths, with an optional scope", () => {
    expect(savedAnswersPageKey("/docs/learn/a/")).toBe("/docs/learn/a")
    expect(savedAnswersPageKey("/docs/learn/a", "paper")).toBe("/docs/learn/a#paper")
    expect(isSavedAnswersPage("/docs/learn/a#paper")).toBe(true)
    expect(isSavedAnswersPage("/docs")).toBe(false)
    expect(isSavedAnswersPage("/docs/../api")).toBe(false)
    expect(isSavedAnswersPage("/news")).toBe(false)
  })

  it("checks a save request", () => {
    expect(parseSavedAnswerWrite({ page: "/docs/a", question: " Why? ", answer: " ## x " })).toEqual({
      ok: true,
      value: { page: "/docs/a", question: "Why?", answer: "## x" },
    })
    expect(parseSavedAnswerWrite({ page: "/docs/a", question: "?", answer: "x" }).ok).toBe(false)
    expect(parseSavedAnswerWrite({ page: "/docs/a", question: "q", answer: "x".repeat(20_001) }).ok).toBe(false)
  })
})

describe("renderAnswerMarkdown", () => {
  it("renders headings, emphasis and lists instead of showing the raw marks", () => {
    const html = renderAnswerMarkdown("## Heidegger\n\n**Not** withdrawal:\n\n- calculative\n- contemplative")
    expect(html).toContain("<h2>Heidegger</h2>")
    expect(html).toContain("<strong>Not</strong>")
    expect(html).toContain("<li>calculative</li>")
  })

  it("never passes raw HTML or unsafe links through", () => {
    const html = renderAnswerMarkdown('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [ok](https://example.com)')
    expect(html).not.toContain("<img")
    expect(html).not.toContain("javascript:")
    expect(html).toContain('href="https://example.com"')
  })
})
