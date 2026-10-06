import { describe, it, expect } from "vitest"
import { describeSaveNowButton, describeToolSaveState } from "../../../src/lib/tools/tool-save-state"

describe("describeToolSaveState", () => {
  it("shows nothing for a tool with no synced collection", () => {
    expect(describeToolSaveState(true, [])).toBeNull()
    expect(describeToolSaveState(false, [])).toBeNull()
  })

  it("reads 'local' when signed out, whatever the statuses", () => {
    expect(describeToolSaveState(false, ["synced"])?.state).toBe("local")
  })

  it("reads 'saved' only when every collection is synced", () => {
    expect(describeToolSaveState(true, ["synced", "synced"])?.state).toBe("saved")
  })

  it("lets pending win over unknown and synced", () => {
    expect(describeToolSaveState(true, ["synced", "unknown", "pending"])?.state).toBe("saving")
  })

  it("reads 'checking' while a collection has no baseline", () => {
    expect(describeToolSaveState(true, ["synced", "unknown"])?.state).toBe("checking")
  })
})

describe("describeSaveNowButton", () => {
  it("hides for synced, checking and signed-out tools with no error", () => {
    for (const state of ["saved", "checking", "local"] as const) {
      expect(describeSaveNowButton(state, false, null)).toBeNull()
    }
  })

  it("offers 'Save now' while a save is pending", () => {
    expect(describeSaveNowButton("saving", false, null)?.label).toBe("Save now")
  })

  it("shows 'Saving…' while the flush is in flight", () => {
    expect(describeSaveNowButton("saving", true, null)?.label).toBe("Saving…")
  })

  it("offers 'Retry save' with the error after a failure, even once the state reads saved", () => {
    const button = describeSaveNowButton("saved", false, "Network down")
    expect(button?.label).toBe("Retry save")
    expect(button?.title).toContain("Network down")
  })
})
