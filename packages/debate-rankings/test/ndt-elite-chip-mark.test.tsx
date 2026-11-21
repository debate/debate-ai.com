/**
 * @fileoverview Pins the Top 10 chip mark: a school's logo alone, or its
 * short name when it has no logo or school logos are switched off.
 */

// @vitest-environment jsdom

import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it } from "vitest"
import { setSchoolArtSetting } from "../src/leaderboard/lib/school-art-settings"
import { EliteChipMark } from "../src/leaderboard/profile/NdtEliteSchoolsChart"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ""
})

function render(name: string) {
  const host = document.createElement("div")
  document.body.append(host)
  act(() => createRoot(host).render(createElement(EliteChipMark, { name })))
  return host
}

describe("EliteChipMark", () => {
  it("shows only the logo for a school that has one", () => {
    const host = render("Northwestern University")
    expect(host.querySelector("img, svg")).not.toBeNull()
    expect(host.textContent).toBe("")
  })

  it("falls back to the short name with logos off or no logo", () => {
    act(() => setSchoolArtSetting("logos", false))
    expect(render("University of Kansas").textContent).toBe("Kansas")
    act(() => setSchoolArtSetting("logos", true))
    expect(render("Nowhere State College").textContent).toBe("Nowhere State")
  })
})
