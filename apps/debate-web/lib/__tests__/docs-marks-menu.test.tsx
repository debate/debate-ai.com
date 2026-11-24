// @vitest-environment jsdom
/**
 * The Synergy Slayer marking tools
 * (`packages/debate-help-docs/components/guides/highlight-toggle.tsx`): the
 * Marks menu's separate Highlighting / Underlining switches, the auto
 * highlight / underline modes that toggle each selection, and AI marks.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
vi.mock("../../../../packages/debate-help-docs/components/guides/docs-ai", () => ({
  generateWithSite: (...args: unknown[]) => generate(...args),
  readableText: (root: Element | null) => root?.textContent ?? "",
}))

const { AutoMarkButton, HIGHLIGHT_INIT_SCRIPT, MarksMenu } = await import(
  "../../../../packages/debate-help-docs/components/guides/highlight-toggle"
)

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let toolbar: HTMLDivElement
let page: HTMLDivElement
let root: Root
const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  for (const name of ["highlights", "underlines", "auto-highlight", "auto-underline"]) html.removeAttribute(`data-debate-${name}`)
  page = document.createElement("div")
  page.className = "synergy-slayer-doc"
  page.innerHTML = '<p id="p">The plan <mark class="debate-hl">solves warming</mark> now.</p>'
  toolbar = document.createElement("div")
  document.body.append(toolbar, page)
  root = createRoot(toolbar)
  act(() =>
    root.render(
      <>
        <MarksMenu />
        <AutoMarkButton kind="highlight" />
        <AutoMarkButton kind="underline" />
      </>,
    ),
  )
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ""
  generate.mockReset()
})

const button = (text: string) =>
  Array.from(toolbar.querySelectorAll("button")).find((b) => b.textContent?.includes(text))!
const click = (el: Element) => act(() => (el as HTMLElement).click())

async function selectAndRelease(node: Node, start: number, end: number) {
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  await act(() => new Promise((resolve) => setTimeout(resolve, 5)))
}

describe("Marks menu", () => {
  it("switches highlighting and underlining separately and remembers them", () => {
    click(button("Marks"))
    const item = (label: string) =>
      Array.from(toolbar.querySelectorAll('[role="menuitemcheckbox"]')).find((el) => el.textContent?.includes(label))!
    expect(item("Highlighting").getAttribute("aria-checked")).toBe("true")
    click(item("Underlining"))
    expect(html.getAttribute("data-debate-underlines")).toBe("off")
    expect(html.getAttribute("data-debate-highlights")).toBe("on")
    expect(localStorage.getItem("debate-docs-underlines")).toBe("off")
    click(item("Highlighting"))
    expect(localStorage.getItem("debate-docs-highlights")).toBe("off")
  })

  it("restores both stored choices before paint", () => {
    localStorage.setItem("debate-docs-highlights", "off")
    localStorage.setItem("debate-docs-underlines", "off")
    html.removeAttribute("data-debate-highlights")
    html.removeAttribute("data-debate-underlines")
    new Function(HIGHLIGHT_INIT_SCRIPT)()
    expect(html.getAttribute("data-debate-highlights")).toBe("off")
    expect(html.getAttribute("data-debate-underlines")).toBe("off")
  })

  it("AI highlight & underline marks the quoted phrases", async () => {
    generate.mockResolvedValue('{"underline":["The plan"],"highlight":["plan"]}')
    click(button("Marks"))
    await act(async () => {
      button("AI highlight").click()
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(page.querySelector("u.reader-underline")?.textContent).toBe("The plan")
    expect(page.querySelector("u.reader-underline mark.reader-highlight")?.textContent).toBe("plan")
    expect(button("AI marks added")).toBeTruthy()

    click(button("AI marks added"))
    click(button("Clear my marks"))
    expect(page.querySelector(".reader-underline, .reader-highlight")).toBeNull()
  })
})

describe("Auto highlight / underline", () => {
  it("does nothing to a selection while off", async () => {
    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector(".reader-highlight")).toBeNull()
  })

  it("highlights a selection at once, and unhighlights it when selected again", async () => {
    click(button("Auto highlight"))
    expect(button("Auto highlight").getAttribute("aria-pressed")).toBe("true")
    expect(html.getAttribute("data-debate-auto-highlight")).toBe("on")

    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector("mark.reader-highlight")?.textContent).toBe("plan")
    expect(window.getSelection()!.isCollapsed).toBe(true)

    await selectAndRelease(page.querySelector("mark.reader-highlight")!.firstChild!, 0, 4)
    expect(page.querySelector("mark.reader-highlight")).toBeNull()
    expect(page.textContent).toBe("The plan solves warming now.")
  })

  it("takes the underline off an authored mark but keeps its highlight", async () => {
    click(button("Auto underline"))
    await selectAndRelease(page.querySelector("mark.debate-hl")!.firstChild!, 0, 6)
    const off = page.querySelector("mark.debate-hl--no-underline")
    expect(off?.textContent).toBe("solves")
    expect(off?.classList.contains("debate-hl--no-highlight")).toBe(false)
  })

  it("turning a mode on shows its kind again", () => {
    html.setAttribute("data-debate-highlights", "off")
    click(button("Auto highlight"))
    expect(html.getAttribute("data-debate-highlights")).toBe("on")
  })
})
