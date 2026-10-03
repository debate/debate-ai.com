import { describe, expect, it } from "vitest"
import { mobileSidebarKind } from "../../src/lib/mobile-sidebar"

describe("mobileSidebarKind", () => {
  it("varies the drawer with the view in the centre", () => {
    expect(mobileSidebarKind("/debate")).toBe("own")
    expect(mobileSidebarKind("/debate/some-tournament")).toBe("own")
    expect(mobileSidebarKind("/research/cards")).toBe("cards")
    expect(mobileSidebarKind("/reason-editor")).toBe("editor")
    expect(mobileSidebarKind("/videos")).toBe("videos")
    expect(mobileSidebarKind("/lectures")).toBe("videos")
    expect(mobileSidebarKind("/coaching")).toBe("tools")
    expect(mobileSidebarKind(null)).toBe("tools")
  })
})
