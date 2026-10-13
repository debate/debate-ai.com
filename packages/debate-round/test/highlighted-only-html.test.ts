// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { highlightedOnlyHtml } from "../src/round/highlighted-only-html"

const hl = (text: string) => `<span class="pmd-highlight">${text}</span>`

describe("highlightedOnlyHtml", () => {
  it("keeps only highlighted card text, the tag and the cite", () => {
    const html = [
      `<div class="pmd-card">`,
      `<p class="pmd-tag">Tag stays</p>`,
      `<p class="pmd-cite-para"><span class="pmd-cite">Smith 15</span> long citation</p>`,
      `<p class="pmd-card-body">filler ${hl("the rise of ")}<span class="pmd-underline">${hl("China")}</span> more filler</p>`,
      `<p class="pmd-card-body">nothing highlighted here</p>`,
      `</div>`,
      `<p>plain analytic text</p>`,
    ].join("")
    const div = document.createElement("div")
    div.innerHTML = highlightedOnlyHtml(html)

    expect(div.querySelector(".pmd-tag")?.textContent).toBe("Tag stays")
    expect(div.querySelector(".pmd-cite-para")?.textContent?.trim()).toBe("Smith 15")
    const bodies = div.querySelectorAll(".pmd-card-body")
    expect(bodies).toHaveLength(1)
    expect(bodies[0].textContent?.replace(/\s+/g, " ").trim()).toBe("the rise of China")
    expect(div.textContent).toContain("plain analytic text")
    expect(div.textContent).not.toContain("filler")
  })
})
