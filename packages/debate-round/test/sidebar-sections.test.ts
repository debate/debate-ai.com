// @vitest-environment jsdom
/**
 * @fileoverview Tests for the round sidebar's section toggles: parsing the
 * stored choice and saving it.
 */

import { afterEach, describe, expect, it } from "vitest"

import {
  DEFAULT_SIDEBAR_SECTIONS,
  parseSidebarSections,
  readSidebarSections,
  SIDEBAR_SECTIONS_STORAGE_KEY,
  writeSidebarSections,
} from "../src/utils/sidebar-sections"

afterEach(() => localStorage.clear())

describe("sidebar sections", () => {
  it("shows every section by default", () => {
    expect(parseSidebarSections(null)).toEqual(DEFAULT_SIDEBAR_SECTIONS)
    expect(Object.values(DEFAULT_SIDEBAR_SECTIONS).every(Boolean)).toBe(true)
  })

  it("keeps stored booleans and ignores anything else", () => {
    expect(parseSidebarSections('{"timer":false,"cameras":"no","bogus":false}')).toEqual({
      ...DEFAULT_SIDEBAR_SECTIONS,
      timer: false,
    })
    expect(parseSidebarSections("not json")).toEqual(DEFAULT_SIDEBAR_SECTIONS)
  })

  it("round-trips through localStorage", () => {
    writeSidebarSections({ ...DEFAULT_SIDEBAR_SECTIONS, tabs: false })
    expect(JSON.parse(localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY)!).tabs).toBe(false)
    expect(readSidebarSections().tabs).toBe(false)
  })
})
