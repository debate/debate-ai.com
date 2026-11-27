// @vitest-environment jsdom
/**
 * The Synergy Slayer marking tools
 * (`packages/debate-help-docs/components/guides/highlight-toggle.tsx`): the
 * Marks menu's separate Underlining / Highlighting / Short highlighting /
 * Emphasizing words
 * switches, the auto modes inside it that toggle each selection, AI marks and
 * Reset to default highlighting and Remove all marks.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
vi.mock("../../../../packages/debate-help-docs/components/guides/docs-ai", () => ({
  generateWithSite: (...args: unknown[]) => generate(...args),
  readableText: (root: Element | null) => root?.textContent ?? "",
}))

const { HIGHLIGHT_INIT_SCRIPT, MarksMenu } = await import(
  "../../../../packages/debate-help-docs/components/guides/highlight-toggle"
)

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let toolbar: HTMLDivElement
let page: HTMLDivElement
let root: Root
const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  for (const name of ["highlights", "underlines", "short-highlights", "emphasis", "auto-highlight", "auto-underline", "auto-short-highlight", "auto-emphasis", "auto-frame"])
    html.removeAttribute(`data-debate-${name}`)
  page = document.createElement("div")
  page.className = "synergy-slayer-doc"
  page.innerHTML = '<p id="p">The plan <mark class="debate-hl">solves warming</mark> now.</p>'
  toolbar = document.createElement("div")
  document.body.append(toolbar, page)
  root = createRoot(toolbar)
  act(() => root.render(<MarksMenu />))
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ""
  generate.mockReset()
})

const button = (text: string) =>
  Array.from(toolbar.querySelectorAll("button")).find((b) => b.textContent?.includes(text))!
const click = (el: Element) => act(() => (el as HTMLElement).click())
const trigger = () => toolbar.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
/** A menu item by its exact label, opening the menu first if needed. */
function item(label: string) {
  if (!toolbar.querySelector('[role="menu"]')) click(trigger())
  return Array.from(toolbar.querySelectorAll<HTMLElement>('[role="menu"] button')).find(
    (el) => el.querySelector("span")?.textContent === label || el.textContent?.trim() === label,
  )!
}

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
  it("lists underlining, then highlighting, then short highlighting", () => {
    click(trigger())
    const labels = Array.from(toolbar.querySelectorAll('[role="menuitemcheckbox"] span:first-of-type')).map((el) => el.textContent)
    expect(labels).toEqual([
      "Underlining",
      "Highlighting",
      "Short highlighting",
      "Emphasizing words",
      "Auto underline",
      "Auto highlight",
      "Auto short highlight",
      "Auto emphasize words",
    ])
  })

  it("switches each kind separately and remembers them", () => {
    expect(item("Highlighting").getAttribute("aria-checked")).toBe("true")
    click(item("Underlining"))
    expect(html.getAttribute("data-debate-underlines")).toBe("off")
    expect(html.getAttribute("data-debate-highlights")).toBe("on")
    expect(localStorage.getItem("debate-docs-underlines")).toBe("off")
    click(item("Highlighting"))
    expect(localStorage.getItem("debate-docs-highlights")).toBe("off")
    click(item("Short highlighting"))
    expect(html.getAttribute("data-debate-short-highlights")).toBe("off")
    expect(localStorage.getItem("debate-docs-short-highlights")).toBe("off")
    click(item("Emphasizing words"))
    expect(html.getAttribute("data-debate-emphasis")).toBe("off")
    expect(localStorage.getItem("debate-docs-emphasis")).toBe("off")
  })

  it("restores both stored choices before paint", () => {
    localStorage.setItem("debate-docs-highlights", "off")
    localStorage.setItem("debate-docs-underlines", "off")
    localStorage.setItem("debate-docs-short-highlights", "off")
    html.removeAttribute("data-debate-highlights")
    html.removeAttribute("data-debate-underlines")
    html.removeAttribute("data-debate-short-highlights")
    new Function(HIGHLIGHT_INIT_SCRIPT)()
    expect(html.getAttribute("data-debate-highlights")).toBe("off")
    expect(html.getAttribute("data-debate-underlines")).toBe("off")
    expect(html.getAttribute("data-debate-short-highlights")).toBe("off")
  })

  it("AI highlight & underline marks the quoted phrases", async () => {
    generate.mockResolvedValue('{"underline":["The plan"],"highlight":["plan"]}')
    click(trigger())
    await act(async () => {
      button("AI highlight").click()
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(page.querySelector("u.reader-underline")?.textContent).toBe("The plan")
    expect(page.querySelector("u.reader-underline mark.reader-highlight")?.textContent).toBe("plan")
    expect(button("AI marks added")).toBeTruthy()

    click(item("Reset to default highlighting"))
    expect(page.querySelector(".reader-underline, .reader-highlight")).toBeNull()
    expect(page.querySelector("mark.debate-hl")?.textContent).toBe("solves warming")
  })
})

describe("Remove all marks", () => {
  it("switches off the page's own marks, and Reset brings the page's back", () => {
    click(item("Remove all marks"))
    const authored = page.querySelector("mark.debate-hl")!
    expect(authored.classList.contains("debate-hl--no-highlight")).toBe(true)
    expect(authored.classList.contains("debate-hl--no-underline")).toBe(true)
    expect(page.querySelector(".reader-underline, .reader-highlight")).toBeNull()
    expect(button("All marks removed")).toBeTruthy()

    click(trigger())
    click(item("Reset to default highlighting"))
    expect(page.querySelector("mark.debate-hl")!.className).toBe("debate-hl")
  })
})

describe("Auto modes in the Marks menu", () => {
  it("does nothing to a selection while off", async () => {
    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector(".reader-highlight")).toBeNull()
  })

  it("highlights a selection at once, and unhighlights it when selected again", async () => {
    click(item("Auto highlight"))
    expect(item("Auto highlight").getAttribute("aria-checked")).toBe("true")
    expect(html.getAttribute("data-debate-auto-highlight")).toBe("on")
    expect(trigger().textContent).toContain("Auto highlight")

    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector("mark.reader-highlight")?.textContent).toBe("plan")
    expect(window.getSelection()!.isCollapsed).toBe(true)

    await selectAndRelease(page.querySelector("mark.reader-highlight")!.firstChild!, 0, 4)
    expect(page.querySelector("mark.reader-highlight")).toBeNull()
    expect(page.textContent).toBe("The plan solves warming now.")
  })

  it("takes the underline off an authored mark but keeps its highlight", async () => {
    click(item("Auto underline"))
    await selectAndRelease(page.querySelector("mark.debate-hl")!.firstChild!, 0, 6)
    const off = page.querySelector("mark.debate-hl--no-underline")
    expect(off?.textContent).toBe("solves")
    expect(off?.classList.contains("debate-hl--no-highlight")).toBe(false)
  })

  it("turning a mode on shows its kind again", () => {
    html.setAttribute("data-debate-highlights", "off")
    click(item("Auto highlight"))
    expect(html.getAttribute("data-debate-highlights")).toBe("on")
  })

  it("long and short auto highlighting are either-or, long by default", () => {
    click(item("Auto highlight"))
    click(item("Auto short highlight"))
    expect(html.getAttribute("data-debate-auto-short-highlight")).toBe("on")
    expect(html.getAttribute("data-debate-auto-highlight")).toBe("off")
    click(item("Auto underline"))
    expect(html.getAttribute("data-debate-auto-underline")).toBe("on")
    expect(html.getAttribute("data-debate-auto-short-highlight")).toBe("on")
  })

  it("emphasizes a selection with a bold box, and Reset drops it", async () => {
    click(item("Auto emphasize words"))
    expect(html.getAttribute("data-debate-auto-emphasis")).toBe("on")
    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector("strong.reader-emphasis")?.textContent).toBe("plan")
    click(item("Reset to default highlighting"))
    expect(page.querySelector(".reader-emphasis")).toBeNull()
    expect(page.textContent).toBe("The plan solves warming now.")
  })

  it("short-highlights a selection over the page's highlight, and Reset drops it", async () => {
    click(item("Auto short highlight"))
    await selectAndRelease(page.querySelector("mark.debate-hl")!.firstChild!, 0, 6)
    expect(page.querySelector("mark.debate-hl mark.reader-highlight-short")?.textContent).toBe("solves")
    click(item("Reset to default highlighting"))
    expect(page.querySelector(".reader-highlight-short")).toBeNull()
    expect(page.querySelector("mark.debate-hl")?.textContent).toBe("solves warming")
  })
})

describe("Auto mode cursors", () => {
  const frame = () => html.getAttribute("data-debate-auto-frame")
  const cursor = () => html.getAttribute("data-debate-auto-cursor")

  afterEach(() => vi.useRealTimers())

  it("is a pen for auto highlight and short highlight, animated at the .ani's rate", () => {
    vi.useFakeTimers()
    expect(cursor()).toBeNull()
    click(item("Auto highlight"))
    expect([cursor(), frame()]).toEqual(["pen", "0"])
    act(() => vi.advanceTimersByTime(67))
    expect(frame()).toBe("1")
    act(() => vi.advanceTimersByTime(67 * 3))
    expect(frame()).toBe("0")
    click(item("Auto short highlight"))
    expect(cursor()).toBe("pen")
    click(item("Auto short highlight"))
    expect([cursor(), frame()]).toEqual([null, null])
    act(() => vi.advanceTimersByTime(500))
    expect(frame()).toBeNull()
  })

  it("is a pencil for auto underline, which wins over the pen and keeps the file's frame lengths", () => {
    vi.useFakeTimers()
    click(item("Auto underline"))
    expect([cursor(), frame()]).toEqual(["pencil", "0"])
    act(() => vi.advanceTimersByTime(50))
    expect(frame()).toBe("1")
    act(() => vi.advanceTimersByTime(50 * 8))
    expect(frame()).toBe("9")
    act(() => vi.advanceTimersByTime(99))
    expect(frame()).toBe("9")
    act(() => vi.advanceTimersByTime(1))
    expect(frame()).toBe("10")
    click(item("Auto highlight"))
    expect(cursor()).toBe("pencil")
    click(item("Auto underline"))
    expect(cursor()).toBe("pen")
    click(item("Auto highlight"))
    expect(cursor()).toBeNull()
  })

  it("auto emphasize alone keeps the normal cursor, and unmounting clears it", () => {
    click(item("Auto emphasize words"))
    expect(cursor()).toBeNull()
    click(item("Auto underline"))
    expect(cursor()).toBe("pencil")
    act(() => root.unmount())
    expect(cursor()).toBeNull()
    root = createRoot(toolbar)
  })

  it("has every frame of both .ani files inlined, as 32x32 cursors with the tip as hotspot", () => {
    const css = readFileSync("packages/debate-help-docs/styles/docs.css", "utf8")
    const frames = new Map<string, Buffer>()
    for (const m of css.matchAll(/((?:html\[data-debate-auto-cursor="(\w+)"\]\[data-debate-auto-frame="(\d+)"\] \.synergy-slayer-doc,?\s*)+)\{\s*cursor: url\("data:image\/x-icon;base64,([^"]+)"\) 0 0, text;/g)) {
      for (const sel of m[1].matchAll(/cursor="(\w+)"\]\[data-debate-auto-frame="(\d+)"/g))
        frames.set(`${sel[1]}-${sel[2]}`, Buffer.from(m[4], "base64"))
    }
    expect([...frames.keys()].filter((k) => k.startsWith("pen-")).length).toBe(4)
    expect([...frames.keys()].filter((k) => k.startsWith("pencil-")).length).toBe(12)
    for (const cur of frames.values()) {
      expect([cur.readUInt16LE(2), cur.readUInt16LE(4), cur[6], cur[7], cur.readUInt16LE(10), cur.readUInt16LE(12)]).toEqual([2, 1, 32, 32, 0, 0])
    }
  })
})
