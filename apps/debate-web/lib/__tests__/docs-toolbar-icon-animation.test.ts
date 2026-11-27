// @vitest-environment jsdom
/**
 * The docs toolbar's random icon animation
 * (`packages/debate-help-docs/lib/toolbar-icon-animation.ts`): hovering or
 * focusing a button plays the sidebar's animation on its icon, clicking it
 * plays one every time, and an open menu inside the item never does.
 *
 * Lives here because debate-help-docs is not a Vitest project of its own.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const play = vi.fn()
vi.mock("@debate-ai/videos/sidebar-icon-hover", () => ({
  playRandomIconAnimation: (...args: unknown[]) => play(...args),
}))

import {
  attachToolbarIconAnimation,
  toolbarIconFor,
} from "../../../../packages/debate-help-docs/lib/toolbar-icon-animation"

let root: HTMLElement
let detach: () => void

beforeEach(() => {
  play.mockReset()
  root = document.createElement("div")
  root.innerHTML = `
    <span data-toolbar-item="Info">
      <div><button id="info"><svg id="info-icon"></svg><span>Info</span></button>
      <div role="dialog"><button id="inside"><svg id="inside-icon"></svg></button><p id="text">stats</p></div></div>
    </span>
    <span data-toolbar-item="Nav"><button id="nav"><svg id="nav-icon"></svg><span>Navigation</span></button></span>
    <button id="stray"><svg></svg></button>`
  document.body.append(root)
  detach = attachToolbarIconAnimation(root)
})

afterEach(() => {
  detach()
  root.remove()
})

const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!

describe("docs toolbar icon animation", () => {
  it("finds the icon of the toolbar button under the pointer, and only that button's", () => {
    expect(toolbarIconFor($("info").querySelector("span"), root)?.icon).toBe($("info-icon"))
    expect(toolbarIconFor($("nav"), root)?.icon).toBe($("nav-icon"))
    expect(toolbarIconFor($("inside"), root)).toBeNull()
    expect(toolbarIconFor($("text"), root)).toBeNull()
    expect(toolbarIconFor($("stray"), root)).toBeNull()
  })

  it("plays on hover and on focus, but not when moving inside one button", () => {
    $("info").dispatchEvent(new MouseEvent("pointerover", { bubbles: true }))
    expect(play).toHaveBeenLastCalledWith($("info-icon"))
    $("nav").dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
    expect(play).toHaveBeenLastCalledWith($("nav-icon"))
    play.mockClear()
    $("info").querySelector("span")!.dispatchEvent(
      new MouseEvent("pointerover", { bubbles: true, relatedTarget: $("info-icon") }),
    )
    expect(play).not.toHaveBeenCalled()
  })

  it("plays on every click, past the 3 second throttle", () => {
    $("nav").click()
    expect(play).toHaveBeenCalledWith($("nav-icon"), { force: true })
    $("inside").click()
    $("stray").click()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it("stops once detached", () => {
    detach()
    $("nav").click()
    expect(play).not.toHaveBeenCalled()
  })
})
