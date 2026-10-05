import { describe, it, expect, vi } from "vitest"
import { saveToolNow } from "../../../src/lib/tools/tool-save-now"

const flushed = (collection: string, pushed = 0, deleted = 0, error?: string) => ({
  collection,
  pushed,
  deleted,
  error,
})

describe("saveToolNow", () => {
  it("sums pushed and deleted records across the tool's collections", async () => {
    const flush = vi.fn(async (key: string) => flushed(key, key === "a" ? 2 : 1, key === "b" ? 3 : 0))
    expect(await saveToolNow(["a", "b"], flush)).toEqual({ ok: true, changed: 6 })
    expect(flush.mock.calls.map(([key]) => key)).toEqual(["a", "b"])
  })

  it("is a no-op success for a tool with no collections", async () => {
    const flush = vi.fn()
    expect(await saveToolNow([], flush)).toEqual({ ok: true, changed: 0 })
    expect(flush).not.toHaveBeenCalled()
  })

  it("keeps flushing after an error and reports the first one", async () => {
    const flush = vi.fn(async (key: string) =>
      key === "a" ? flushed(key, 0, 0, "Too large") : flushed(key, 1),
    )
    expect(await saveToolNow(["a", "b"], flush)).toEqual({ ok: false, changed: 1, error: "Too large" })
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it("turns a thrown flush into a failed result instead of rejecting", async () => {
    const flush = vi.fn(async (key: string) => {
      if (key === "a") throw new Error("offline")
      return flushed(key, 1)
    })
    expect(await saveToolNow(["a", "b"], flush)).toEqual({ ok: false, changed: 1, error: "offline" })
  })
})
