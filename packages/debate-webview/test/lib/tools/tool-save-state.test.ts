import { describe, it, expect } from "vitest"
import { describeToolSaveState } from "../../../src/lib/tools/tool-save-state"

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
