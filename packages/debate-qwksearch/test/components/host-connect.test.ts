import { afterEach, describe, expect, it, vi } from "vitest"
import { getHostConnectQwkSearch, setHostConnectQwkSearch } from "../src/components/host-connect"

describe("host-connect", () => {
  afterEach(() => {
    setHostConnectQwkSearch(undefined)
  })

  it("starts with no host connect function", () => {
    expect(getHostConnectQwkSearch()).toBeUndefined()
  })

  it("registers a host connect function", () => {
    const fn = vi.fn()
    setHostConnectQwkSearch(fn)
    expect(getHostConnectQwkSearch()).toBe(fn)
  })

  it("clears the host connect function when called with undefined", () => {
    const fn = vi.fn()
    setHostConnectQwkSearch(fn)
    expect(getHostConnectQwkSearch()).toBe(fn)
    setHostConnectQwkSearch(undefined)
    expect(getHostConnectQwkSearch()).toBeUndefined()
  })
})