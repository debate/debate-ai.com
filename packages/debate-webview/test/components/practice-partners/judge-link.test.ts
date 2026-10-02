import { describe, expect, it } from "vitest"
import { JUDGE_ANCHOR, PROFILE_ANCHOR, judgeLinkTarget } from "../../../src/components/practice-partners/PracticePartnersPanel"
import { SIDEBAR_TOOL_SECTIONS } from "@debate/videos/src/components/category-gallery/sidebar-tool-sections"

describe("Judge Practice Rounds link", () => {
  it("lands a volunteer judge on the open judge seats", () => {
    expect(judgeLinkTarget(true)).toBe(JUDGE_ANCHOR)
  })

  it("lands everyone else on the profile, where they volunteer to judge", () => {
    expect(judgeLinkTarget(false)).toBe(PROFILE_ANCHOR)
  })

  it("is in the sidebar's Practice section, pointing at that anchor", () => {
    const practice = SIDEBAR_TOOL_SECTIONS.find((section) => section.id === "practice")
    expect(practice?.tools.map((tool) => tool.href)).toContain(`/practice/partners#${JUDGE_ANCHOR}`)
  })
})
