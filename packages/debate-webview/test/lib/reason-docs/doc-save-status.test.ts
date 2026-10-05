import { describe, it, expect } from "vitest"
import { describeDocSaveStatus } from "../../../src/lib/reason-docs/doc-save-status"

const idle = { isTopicDocument: false, saving: false, unsaved: false, saveFailed: false }

describe("describeDocSaveStatus", () => {
  it("reads as saved when nothing is pending", () => {
    expect(describeDocSaveStatus(idle)).toMatchObject({ state: "saved", label: "Saved to your account" })
  })

  it("reads as unsaved while an edit is queued", () => {
    expect(describeDocSaveStatus({ ...idle, unsaved: true }).state).toBe("unsaved")
  })

  it("reads as saving while a request is in flight, even with more edits queued", () => {
    expect(describeDocSaveStatus({ ...idle, saving: true, unsaved: true }).state).toBe("saving")
  })

  it("reports a failed save above every other state", () => {
    expect(describeDocSaveStatus({ ...idle, saving: true, unsaved: true, saveFailed: true }).state).toBe("failed")
  })

  it("labels a topic starter as public regardless of save flags", () => {
    expect(describeDocSaveStatus({ ...idle, isTopicDocument: true, saveFailed: true })).toMatchObject({
      state: "public",
      label: "Public topic starter",
    })
  })
})
