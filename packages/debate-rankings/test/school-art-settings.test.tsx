/**
 * @fileoverview Pins the Settings → Preferences switches for school mascots
 * and logos: on by default, "0" in localStorage turns one off, listeners hear
 * changes, and a team label falls back to the plain school name while logos
 * are off.
 */

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { createRoot } from "react-dom/client"
import { act } from "react"
import {
  SCHOOL_ART_KEYS,
  readSchoolArtSetting,
  setSchoolArtSetting,
  subscribeSchoolArtSettings,
} from "../src/leaderboard/lib/school-art-settings"
import { TeamLabel } from "../src/leaderboard/team-label/TeamLabel"
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ""
})

describe("school art settings", () => {
  it("shows mascots and logos by default", () => {
    expect(readSchoolArtSetting("mascots")).toBe(true)
    expect(readSchoolArtSetting("logos")).toBe(true)
  })

  it("stores each switch under its own key and notifies listeners", () => {
    const onChange = vi.fn()
    const stop = subscribeSchoolArtSettings(onChange)
    setSchoolArtSetting("mascots", false)
    expect(localStorage.getItem(SCHOOL_ART_KEYS.mascots)).toBe("0")
    expect(readSchoolArtSetting("mascots")).toBe(false)
    expect(readSchoolArtSetting("logos")).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    stop()
    setSchoolArtSetting("mascots", true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(readSchoolArtSetting("mascots")).toBe(true)
  })

  it("draws a team label's school as plain text while logos are off", () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => root.render(createElement(TeamLabel, { school: "Emory", debaters: "Le & Luo" })))
    expect(host.querySelector("img, svg")).not.toBeNull()
    act(() => setSchoolArtSetting("logos", false))
    expect(host.querySelector("img, svg")).toBeNull()
    expect(host.textContent).toContain("Emory")
    act(() => root.unmount())
  })
})
