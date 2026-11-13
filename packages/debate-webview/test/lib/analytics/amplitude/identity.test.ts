import { describe, expect, it, vi } from "vitest"
import {
  USER_IDENTIFIED_EVENT,
  clearSignedInUser,
  identifySignedInUser,
  syncAmplitudeIdentity,
  type AmplitudeIdentityClient,
} from "../../../../src/lib/analytics/amplitude/identity"

function fakeClient(initialUserId?: string) {
  let userId = initialUserId
  const client = {
    getUserId: vi.fn(() => userId),
    setUserId: vi.fn((id: string | undefined) => {
      userId = id
    }),
    track: vi.fn(),
    reset: vi.fn(() => {
      userId = undefined
    }),
  } satisfies AmplitudeIdentityClient
  return client
}

describe("identifySignedInUser", () => {
  it("sets the user id and sends a verification event", () => {
    const client = fakeClient()
    identifySignedInUser(client, { id: "abc123def456" })
    expect(client.setUserId).toHaveBeenCalledWith("abc123def456")
    expect(client.track).toHaveBeenCalledWith(USER_IDENTIFIED_EVENT)
  })

  it("stringifies numeric ids", () => {
    const client = fakeClient()
    identifySignedInUser(client, { id: 123456 })
    expect(client.setUserId).toHaveBeenCalledWith("123456")
  })

  it("does nothing when Amplitude already holds the same id (restored session)", () => {
    const client = fakeClient("abc123def456")
    identifySignedInUser(client, { id: "abc123def456" })
    expect(client.setUserId).not.toHaveBeenCalled()
    expect(client.track).not.toHaveBeenCalled()
  })

  it("switches to a different user", () => {
    const client = fakeClient("old-user-id")
    identifySignedInUser(client, { id: "new-user-id" })
    expect(client.setUserId).toHaveBeenCalledWith("new-user-id")
  })

  it("throws without a stable id", () => {
    const client = fakeClient()
    expect(() => identifySignedInUser(client, { id: null })).toThrow(/stable application user ID/)
    expect(() => identifySignedInUser(client, {})).toThrow()
    expect(client.setUserId).not.toHaveBeenCalled()
  })
})

describe("clearSignedInUser", () => {
  it("resets an identified visitor", () => {
    const client = fakeClient("abc123def456")
    clearSignedInUser(client)
    expect(client.reset).toHaveBeenCalledTimes(1)
  })

  it("leaves a never-identified visitor's device id alone", () => {
    const client = fakeClient()
    clearSignedInUser(client)
    expect(client.reset).not.toHaveBeenCalled()
  })
})

describe("syncAmplitudeIdentity", () => {
  it("identifies a real signed-in user", () => {
    const client = fakeClient()
    syncAmplitudeIdentity(client, { id: "abc123def456", isAnonymous: false })
    expect(client.getUserId()).toBe("abc123def456")
  })

  it("does not identify anonymous guest sessions", () => {
    const client = fakeClient()
    syncAmplitudeIdentity(client, { id: "guest-session-id", isAnonymous: true })
    expect(client.setUserId).not.toHaveBeenCalled()
  })

  it("resets on sign-out", () => {
    const client = fakeClient("abc123def456")
    syncAmplitudeIdentity(client, null)
    expect(client.reset).toHaveBeenCalledTimes(1)
    expect(client.getUserId()).toBeUndefined()
  })
})
