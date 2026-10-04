// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import {
  HIGHLIGHT_ATTRIBUTE,
  clearHighlights,
  collectHighlights,
  highlightRange,
  highlightSelection,
  removeHighlightAt,
} from "../src/lib/article-highlight"

let container: HTMLElement

beforeEach(() => {
  document.body.innerHTML = `<div id="article"><p id="one">Deterrence has held for decades.</p><p id="two">Proliferation <em>risks</em> remain high.</p></div><p id="outside">Not the article.</p>`
  container = document.getElementById("article")!
})

/** The first text node of the element with `id`. */
function textOf(id: string): Text {
  const walker = document.createTreeWalker(document.getElementById(id)!, NodeFilter.SHOW_TEXT)
  return walker.nextNode() as Text
}

describe("highlightRange", () => {
  it("wraps exactly the selected part of one paragraph", () => {
    const range = document.createRange()
    range.setStart(textOf("one"), 15) // "held"
    range.setEnd(textOf("one"), 19)

    expect(highlightRange(container, range)).toBe("held")
    const marks = document.getElementById("one")!.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe("held")
    expect(document.getElementById("one")!.textContent).toBe("Deterrence has held for decades.")
  })

  it("marks each text run of a selection across paragraphs, keeping the blocks", () => {
    const range = document.createRange()
    range.setStart(textOf("one"), 24) // "decades."
    range.setEnd(document.getElementById("two")!.querySelector("em")!.firstChild!, 5) // through "risks"

    expect(highlightRange(container, range)).toBe("decades. Proliferation risks")
    expect(container.querySelectorAll("p")).toHaveLength(2)
    expect(container.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)).toHaveLength(3)
    expect(document.getElementById("two")!.textContent).toBe("Proliferation risks remain high.")
  })
})

describe("highlightSelection", () => {
  it("ignores a selection outside the article", () => {
    const range = document.createRange()
    range.selectNodeContents(document.getElementById("outside")!)
    window.getSelection()!.addRange(range)

    expect(highlightSelection(container)).toBe("")
    expect(document.querySelectorAll("mark")).toHaveLength(0)
  })

  it("highlights the current selection and clears it", () => {
    const range = document.createRange()
    range.setStart(textOf("one"), 0)
    range.setEnd(textOf("one"), 10)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)

    expect(highlightSelection(container)).toBe("Deterrence")
    expect(window.getSelection()!.rangeCount).toBe(0)
  })
})

describe("clearHighlights", () => {
  it("restores the original text and structure", () => {
    const original = container.innerHTML
    const range = document.createRange()
    range.setStart(textOf("one"), 5)
    range.setEnd(document.getElementById("two")!.lastChild!, 4)
    highlightRange(container, range)
    expect(container.innerHTML).not.toBe(original)

    clearHighlights(container)
    expect(container.innerHTML).toBe(original)
  })

  it("leaves marks the article itself carries", () => {
    container.innerHTML = `<p>An <mark>original</mark> mark.</p>`
    clearHighlights(container)
    expect(container.querySelectorAll("mark")).toHaveLength(1)
  })
})

describe("toggling highlights off", () => {
  /** Highlights `[start, end)` of paragraph one's text. */
  function mark(start: number, end: number) {
    const range = document.createRange()
    range.setStart(textOf("one"), start)
    range.setEnd(textOf("one"), end)
    return highlightRange(container, range)
  }

  it("removes just the tapped passage, leaving the others", () => {
    mark(0, 10) // "Deterrence"
    const second = document.getElementById("one")!.querySelectorAll("mark")
    expect(second).toHaveLength(1)
    const tail = document.createTreeWalker(document.getElementById("one")!, NodeFilter.SHOW_TEXT)
    tail.nextNode()
    tail.nextNode() // " has held for decades." after the first mark
    const range = document.createRange()
    range.setStart(tail.currentNode, 5)
    range.setEnd(tail.currentNode, 9) // "held"
    highlightRange(container, range)

    expect(collectHighlights(container)).toEqual(["Deterrence", "held"])
    expect(removeHighlightAt(container, container.querySelector("mark"))).toBe(true)
    expect(collectHighlights(container)).toEqual(["held"])
    expect(document.getElementById("one")!.textContent).toBe("Deterrence has held for decades.")
  })

  it("removes every run of a multi-paragraph passage at once", () => {
    const range = document.createRange()
    range.setStart(textOf("one"), 24)
    range.setEnd(document.getElementById("two")!.querySelector("em")!.firstChild!, 5)
    highlightRange(container, range)

    expect(removeHighlightAt(container, container.querySelectorAll("mark")[1])).toBe(true)
    expect(container.querySelectorAll(`mark[${HIGHLIGHT_ATTRIBUTE}]`)).toHaveLength(0)
    expect(collectHighlights(container)).toEqual([])
  })

  it("ignores taps outside a highlight", () => {
    mark(0, 10)
    expect(removeHighlightAt(container, document.getElementById("two"))).toBe(false)
    expect(collectHighlights(container)).toEqual(["Deterrence"])
  })
})
