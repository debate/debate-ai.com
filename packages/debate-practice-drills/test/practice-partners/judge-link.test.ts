import { describe, expect, it } from "vitest"
import { JUDGE_ANCHOR, PROFILE_ANCHOR, judgeLinkTarget } from "../../src/practice-partners/ui/PracticePartnersPanel"
import { SIDEBAR_TOOL_SECTIONS } from "@debate-ai/videos/src/components/navigation/sidebar-nav/sidebar-tool-sections"

describe("judge anchor on /practice/partners", () => {
  it("lands a volunteer judge on the open judge seats", () => {
    expect(judgeLinkTarget(true)).toBe(JUDGE_ANCHOR)
  })

  it("lands everyone else on the profile, where they volunteer to judge", () => {
    expect(judgeLinkTarget(false)).toBe(PROFILE_ANCHOR)
  })

  it("is not linked from any sidebar section", () => {
    // Practice tools now sit under Research, so check every section.
    const hrefs = SIDEBAR_TOOL_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.href))
    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs).not.toContain(`/practice/partners#${JUDGE_ANCHOR}`)
  })
})
