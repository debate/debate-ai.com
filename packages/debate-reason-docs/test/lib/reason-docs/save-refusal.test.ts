import { describe, expect, it } from "vitest"

import { isRefusedMove, saveRefusalMessage } from "../../../src/lib/reason-docs/save-refusal"

describe("save refusal", () => {
  it("treats a dropped parentId as a move to undo, null included", () => {
    expect(isRefusedMove({ id: 1, patch: { parentId: null }, status: 400 })).toBe(true)
    expect(isRefusedMove({ id: 1, patch: { content: "x" }, status: 400 })).toBe(false)
  })

  it("explains a refused move with the server's reason", () => {
    expect(saveRefusalMessage({ id: 1, patch: { parentId: 2 }, status: 400, error: "That folder no longer exists" })).toBe(
      "That move wasn't saved: That folder no longer exists. The file is back where it was.",
    )
    expect(saveRefusalMessage({ id: 1, patch: { parentId: 2 }, status: 400 })).toBe(
      "That move wasn't saved, so the file is back where it was.",
    )
  })

  it("explains a missing or foreign file and any other refusal", () => {
    expect(saveRefusalMessage({ id: 1, patch: { content: "x" }, status: 404 })).toBe(
      "A change wasn't saved because the file no longer exists.",
    )
    expect(saveRefusalMessage({ id: 1, patch: { title: "x" }, status: 403 })).toBe(
      "A change wasn't saved because the file isn't yours.",
    )
    expect(saveRefusalMessage({ id: 1, patch: { title: 5 as unknown as string }, status: 400, error: "\"title\" must be a string." })).toBe(
      "A change wasn't saved: \"title\" must be a string.",
    )
    expect(saveRefusalMessage({ id: 1, patch: { content: "x" }, status: 400 })).toBe(
      "A change wasn't saved because the server refused it.",
    )
  })
})
