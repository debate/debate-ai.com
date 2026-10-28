/** @vitest-environment jsdom */
import { act } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { EditorTabStrip, type EditorTabStripProps } from "../../src/editor/EditorTabStrip"
import type { ReasonDocument } from "../../src/docs/types"
import { allByText, bodyText, button, cleanup, click, installDomShims, mount } from "../helpers/dom"

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const docs = [1, 2, 3].map(
  (id) => ({ id, title: `Doc ${id}`, content: "", format: "html", parentId: null, isFolder: false, updatedAt: 0 }) as ReasonDocument,
)

function props(overrides: Partial<EditorTabStripProps> = {}): EditorTabStripProps {
  return {
    documents: docs,
    openTabs: [1, 2, 3],
    activeId: 1,
    canReopen: false,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onCloseOthers: vi.fn(),
    onCloseToRight: vi.fn(),
    onCloseAll: vi.fn(),
    onReopen: vi.fn(),
    ...overrides,
  }
}

function tab(title: string) {
  return allByText(title, "[role=tab]")[0]!
}

function rightClick(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }))
  })
}

function menuItem(text: string) {
  const item = allByText(text, "[role=menuitem]").find((el) => el.textContent === text)
  if (!item) throw new Error(`No menu item ${text}`)
  return item
}

describe("EditorTabStrip", () => {
  it("selects and closes tabs", () => {
    const p = props()
    mount(<EditorTabStrip {...p} />)
    expect(tab("Doc 1").getAttribute("aria-selected")).toBe("true")
    click(tab("Doc 2"))
    expect(p.onSelect).toHaveBeenCalledWith(2)
    click(button("×", tab("Doc 3")))
    expect(p.onClose).toHaveBeenCalledWith(3)
    expect(p.onSelect).toHaveBeenCalledTimes(1)
  })

  it("offers close, close others, close to the right, close all and undo close on right-click", () => {
    const p = props({ canReopen: true })
    mount(<EditorTabStrip {...p} />)
    const actions: [string, () => void][] = [
      ["Close", () => expect(p.onClose).toHaveBeenCalledWith(2)],
      ["Close others", () => expect(p.onCloseOthers).toHaveBeenCalledWith(2)],
      ["Close to the right", () => expect(p.onCloseToRight).toHaveBeenCalledWith(2)],
      ["Close all", () => expect(p.onCloseAll).toHaveBeenCalled()],
      ["Undo close", () => expect(p.onReopen).toHaveBeenCalled()],
    ]
    for (const [label, check] of actions) {
      rightClick(tab("Doc 2"))
      expect(bodyText()).toContain(label)
      click(menuItem(label))
      check()
    }
  })

  it("disables what cannot apply", () => {
    mount(<EditorTabStrip {...props({ openTabs: [3], activeId: 3 })} />)
    rightClick(tab("Doc 3"))
    for (const label of ["Close others", "Close to the right", "Undo close"]) {
      expect(menuItem(label).hasAttribute("data-disabled")).toBe(true)
    }
    expect(menuItem("Close all").hasAttribute("data-disabled")).toBe(false)
  })
})
