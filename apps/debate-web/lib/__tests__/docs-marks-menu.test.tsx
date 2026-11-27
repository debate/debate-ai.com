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

const swoosh = vi.fn()
vi.mock("../../../../packages/debate-help-docs/components/guides/auto-highlight-swoosh", () => ({
  playAutoHighlightSwoosh: () => swoosh(),
}))

const { HIGHLIGHT_INIT_SCRIPT, MarksMenu } = await import(
  "../../../../packages/debate-help-docs/components/guides/highlight-toggle"
)
const { clearMarkHistory } = await import("../../../../packages/debate-help-docs/components/guides/mark-history")

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let toolbar: HTMLDivElement
let page: HTMLDivElement
let root: Root
const html = document.documentElement

beforeEach(() => {
  clearMarkHistory()
  localStorage.clear()
  for (const name of ["highlights", "underlines", "short-highlights", "emphasis", "minimize-unread", "auto-highlight", "auto-underline", "auto-short-highlight", "auto-emphasis", "auto-frame"])
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
  swoosh.mockReset()
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
      "Minimize unread",
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

describe("Minimize unread", () => {
  const css = readFileSync("packages/debate-help-docs/styles/docs.css", "utf8")
  const block = css.slice(css.indexOf(" * Minimize unread"))
  const rules = Array.from(block.matchAll(/\n(html\[data-debate-minimize-unread="on"\][^{]*)\{([^}]*)\}/g)).map((m) => ({
    selector: m[1].replace(/\s+/g, " ").trim(),
    body: m[2].trim(),
  }))
  const shrink = rules.find((rule) => rule.body === "font-size: 8pt;")!
  const restore = rules.find((rule) => rule.body === "font-size: var(--debate-read-size);")!
  const inner = (rule: { selector: string }) => rule.selector.replace('html[data-debate-minimize-unread="on"] ', "")

  it("is an accessible, keyboard-reachable checkbox item that starts off", () => {
    const minimize = item("Minimize unread")
    expect(minimize.tagName).toBe("BUTTON")
    expect(minimize.getAttribute("type")).toBe("button")
    expect(minimize.getAttribute("role")).toBe("menuitemcheckbox")
    expect(minimize.getAttribute("aria-checked")).toBe("false")
    expect(minimize.getAttribute("title")).toMatch(/8pt/)
    expect(html.getAttribute("data-debate-minimize-unread")).not.toBe("on")
  })

  it("switches on and off, keeps the menu open, and remembers it in this browser", () => {
    click(item("Minimize unread"))
    expect(toolbar.querySelector('[role="menu"]')).not.toBeNull()
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("on")
    expect(item("Minimize unread").getAttribute("aria-checked")).toBe("true")
    expect(localStorage.getItem("debate-docs-minimize-unread")).toBe("on")
    click(item("Minimize unread"))
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("off")
    expect(item("Minimize unread").getAttribute("aria-checked")).toBe("false")
    expect(localStorage.getItem("debate-docs-minimize-unread")).toBe("off")
  })

  it("leaves the other switches alone", () => {
    click(item("Minimize unread"))
    for (const name of ["highlights", "underlines", "short-highlights", "emphasis"]) {
      expect(html.getAttribute(`data-debate-${name}`)).toBe("on")
    }
  })

  it("restores a stored \"on\" before paint, and ignores anything else", () => {
    localStorage.setItem("debate-docs-minimize-unread", "on")
    new Function(HIGHLIGHT_INIT_SCRIPT)()
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("on")
    html.removeAttribute("data-debate-minimize-unread")
    localStorage.setItem("debate-docs-minimize-unread", "off")
    new Function(HIGHLIGHT_INIT_SCRIPT)()
    expect(html.hasAttribute("data-debate-minimize-unread")).toBe(false)
  })

  it("reads a stored \"on\" into the menu on mount", () => {
    act(() => root.unmount())
    localStorage.setItem("debate-docs-minimize-unread", "on")
    html.removeAttribute("data-debate-minimize-unread")
    new Function(HIGHLIGHT_INIT_SCRIPT)()
    root = createRoot(toolbar)
    act(() => root.render(<MarksMenu />))
    expect(item("Minimize unread").getAttribute("aria-checked")).toBe("true")
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("on")
  })

  it("stays on while marks are added, and is switched off by Reset and Remove all marks", async () => {
    click(item("Minimize unread"))
    click(item("Auto highlight"))
    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector("mark.reader-highlight")?.textContent).toBe("plan")
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("on")

    click(item("Reset to default highlighting"))
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("off")
    expect(localStorage.getItem("debate-docs-minimize-unread")).toBe("off")

    click(item("Minimize unread"))
    click(item("Remove all marks"))
    expect(html.getAttribute("data-debate-minimize-unread")).toBe("off")
    expect(item("Minimize unread").getAttribute("aria-checked")).toBe("false")
  })

  it("shrinks unmarked body text to 8pt in CSS, with marks restored to the normal size", () => {
    expect(shrink).toBeTruthy()
    expect(restore).toBeTruthy()
    expect(inner(shrink)).toMatch(/^\.synergy-slayer-doc :is\(p, li/)
    expect(inner(restore)).toBe(
      ".synergy-slayer-doc :is(p, li) :is(u, mark, strong.reader-emphasis):not(.debate-u--no-underline, .citation-card *)",
    )
    expect(rules.some((rule) => rule.body.includes("--debate-read-size: 0.9rem"))).toBe(true)
    // Not 0.7rem-style card shrinking, and not px: 8pt is the Verbatim convention.
    expect(block).not.toMatch(/font-size:\s*8px/)
  })

  it("never shrinks headings, citation lines, card headers, stats or hover cards", () => {
    const excluded = inner(shrink)
    for (const keep of ["summary *", ".citation-card *", ".debate-card .stats", ".debate-card:has(hr) > p:nth-child(-n + 2)"]) {
      expect(excluded).toContain(keep)
    }
    expect(excluded).not.toMatch(/\bh[1-6]\b/)
  })

  it("restores every kind of mark the tools produce, including auto and undone ones", async () => {
    const restores = (el: Element) => el.matches(inner(restore))
    expect(restores(page.querySelector("mark.debate-hl")!)).toBe(true)
    for (const [label, selector] of [
      ["Auto underline", "u.reader-underline"],
      ["Auto highlight", "mark.reader-highlight"],
      ["Auto short highlight", "mark.reader-highlight-short"],
      ["Auto emphasize words", "strong.reader-emphasis"],
    ] as const) {
      click(item(label))
      await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
      const made = page.querySelector(selector)!
      expect(restores(made)).toBe(true)
      click(item(label))
      click(item("Undo mark"))
      expect(page.querySelector(selector)).toBeNull()
      click(item("Redo mark"))
      expect(restores(page.querySelector(selector)!)).toBe(true)
      click(item("Undo mark"))
    }
    const unmarked = document.createElement("u")
    unmarked.className = "debate-u--no-underline"
    page.querySelector("#p")!.append(unmarked)
    expect(restores(unmarked)).toBe(false)
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

describe("Undo mark", () => {
  const ORIGINAL = '<p id="p">The plan <mark class="debate-hl">solves warming</mark> now.</p>'
  const ctrlZ = (init: KeyboardEventInit = {}) =>
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true, ...init }))
    })

  it("is disabled until a mark changes, then undoes and redoes it from the menu", async () => {
    click(trigger())
    expect(item("Undo mark").hasAttribute("disabled")).toBe(true)
    expect(item("Redo mark").hasAttribute("disabled")).toBe(true)
    click(item("Auto emphasize words"))
    await selectAndRelease(page.querySelector("#p")!.firstChild!, 4, 8)
    expect(page.querySelector("strong.reader-emphasis")?.textContent).toBe("plan")

    click(item("Undo mark"))
    expect(page.innerHTML).toBe(ORIGINAL)
    expect(item("Redo mark").hasAttribute("disabled")).toBe(false)
    click(item("Redo mark"))
    expect(page.querySelector("strong.reader-emphasis")?.textContent).toBe("plan")
  })

  it("undoes Remove all marks and Reset with Ctrl+Z, and redoes with Ctrl+Shift+Z or Ctrl+Y", () => {
    click(item("Remove all marks"))
    expect(page.querySelector("mark.debate-hl")?.classList.contains("debate-hl--no-highlight")).toBe(true)
    ctrlZ()
    expect(page.innerHTML).toBe(ORIGINAL)
    ctrlZ({ shiftKey: true })
    expect(page.querySelector("mark.debate-hl")?.classList.contains("debate-hl--no-highlight")).toBe(true)
    ctrlZ()
    ctrlZ({ key: "y" })
    expect(page.querySelector("mark.debate-hl")?.classList.contains("debate-hl--no-highlight")).toBe(true)
    ctrlZ({ key: "z", ctrlKey: false, metaKey: true })
    expect(page.innerHTML).toBe(ORIGINAL)
  })

  it("leaves Ctrl+Z to text fields", () => {
    click(item("Remove all marks"))
    const input = document.createElement("input")
    document.body.append(input)
    const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })
    act(() => {
      input.dispatchEvent(event)
    })
    expect(event.defaultPrevented).toBe(false)
    expect(page.querySelector("mark.debate-hl")?.classList.contains("debate-hl--no-highlight")).toBe(true)
  })

  it("keeps at least the last 30 changes", async () => {
    click(item("Auto highlight"))
    const text = () => page.querySelector("#p")!
    for (let i = 0; i < 35; i++) {
      const walker = document.createTreeWalker(text(), NodeFilter.SHOW_TEXT)
      const node = walker.nextNode() as Text
      await selectAndRelease(node, 0, 1)
    }
    let undone = 0
    while (document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })) === false) undone++
    expect(undone).toBeGreaterThanOrEqual(30)
  })
})

describe("Auto highlight swoosh", () => {
  it("plays when the pen cursor first appears", () => {
    click(item("Auto highlight"))
    expect(swoosh).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when the pen is already there, when turning a mode off, and for the pencil", () => {
    click(item("Auto highlight"))
    swoosh.mockClear()
    click(item("Auto short highlight"))
    click(item("Auto short highlight"))
    expect(swoosh).not.toHaveBeenCalled()
    click(item("Auto emphasize words"))
    expect(swoosh).not.toHaveBeenCalled()
    click(item("Auto emphasize words"))
    click(item("Auto underline"))
    expect(swoosh).not.toHaveBeenCalled()
  })

  it("plays again after the pen was put away", () => {
    click(item("Auto highlight"))
    click(item("Auto highlight"))
    click(item("Auto highlight"))
    expect(swoosh).toHaveBeenCalledTimes(2)
  })

  it("stays quiet on mount with an auto mode already on", () => {
    html.setAttribute("data-debate-auto-highlight", "on")
    act(() => root.render(<MarksMenu key="again" />))
    expect(swoosh).not.toHaveBeenCalled()
  })
})

describe("playAutoHighlightSwoosh", () => {
  const originalAudio = globalThis.Audio
  afterEach(() => {
    globalThis.Audio = originalAudio
  })

  it("rewinds and plays one shared, quieter-than-full-volume clip, and survives a blocked play", async () => {
    const { playAutoHighlightSwoosh } = await vi.importActual<
      typeof import("../../../../packages/debate-help-docs/components/guides/auto-highlight-swoosh")
    >("../../../../packages/debate-help-docs/components/guides/auto-highlight-swoosh")
    const play = vi.fn().mockReturnValueOnce(Promise.reject(new Error("blocked"))).mockReturnValue(Promise.resolve())
    const made: { src: string; currentTime: number; volume: number }[] = []
    globalThis.Audio = vi.fn(function (this: object, src: string) {
      Object.assign(this, { src, currentTime: 9, volume: 1, play })
      made.push(this as (typeof made)[number])
    }) as unknown as typeof Audio
    playAutoHighlightSwoosh()
    playAutoHighlightSwoosh()
    await Promise.resolve()
    expect(made).toHaveLength(1)
    expect(made[0].src).toMatch(/^data:audio\/mpeg;base64,/)
    expect(made[0].volume).toBeLessThan(1)
    expect(made[0].currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it("does nothing without audio support", async () => {
    const { playAutoHighlightSwoosh } = await vi.importActual<
      typeof import("../../../../packages/debate-help-docs/components/guides/auto-highlight-swoosh")
    >("../../../../packages/debate-help-docs/components/guides/auto-highlight-swoosh")
    // @ts-expect-error simulating a runtime without Audio
    delete globalThis.Audio
    expect(() => playAutoHighlightSwoosh()).not.toThrow()
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
