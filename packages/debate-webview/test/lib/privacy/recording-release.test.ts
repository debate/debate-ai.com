import { describe, expect, it } from "vitest"
import {
  DEFAULT_RECORDING_PRIVACY,
  RECORDING_RELEASE_VERSION,
  firstNameAndInitial,
  includeVideo,
  mayPublishRecording,
  parseRecordingPrivacy,
  publicCreditName,
  validateDeletionRequest,
  validateRecordingPrivacyPatch,
} from "../../../src/lib/privacy/recording-release"

describe("recording release", () => {
  it("defaults to unpublished and anonymous, including for bad stored values", () => {
    expect(parseRecordingPrivacy(null)).toEqual(DEFAULT_RECORDING_PRIVACY)
    expect(parseRecordingPrivacy("{not json")).toEqual(DEFAULT_RECORDING_PRIVACY)
    expect(parseRecordingPrivacy({ release: "everything", credit: "famous" })).toEqual(DEFAULT_RECORDING_PRIVACY)
    expect(mayPublishRecording(DEFAULT_RECORDING_PRIVACY)).toBe(false)
  })

  it("stamps agreement, and clears it on withdrawal", () => {
    const now = new Date("2026-10-14T00:00:00Z")
    const { value, errors } = validateRecordingPrivacyPatch({ release: "released" }, DEFAULT_RECORDING_PRIVACY, now)
    expect(errors).toEqual([])
    expect(value.releaseVersion).toBe(RECORDING_RELEASE_VERSION)
    expect(value.releasedAt).toBe(now.toISOString())
    expect(mayPublishRecording(value)).toBe(true)
    const withdrawn = validateRecordingPrivacyPatch({ release: "not-released" }, value).value
    expect(withdrawn.releaseVersion).toBeNull()
    expect(mayPublishRecording(withdrawn)).toBe(false)
  })

  it("does not count agreement to older release wording", () => {
    expect(mayPublishRecording({ ...DEFAULT_RECORDING_PRIVACY, release: "released", releaseVersion: 0 })).toBe(false)
  })

  it("refuses unknown values and a username credit without a username", () => {
    expect(validateRecordingPrivacyPatch({ media: "hologram" }, DEFAULT_RECORDING_PRIVACY).errors).toHaveLength(1)
    expect(validateRecordingPrivacyPatch({ credit: "username" }, DEFAULT_RECORDING_PRIVACY).errors).toHaveLength(1)
    expect(validateRecordingPrivacyPatch({ username: "<script>" }, DEFAULT_RECORDING_PRIVACY).errors).toHaveLength(1)
    expect(validateRecordingPrivacyPatch({ credit: "username", username: "ada_l" }, DEFAULT_RECORDING_PRIVACY).errors).toEqual([])
  })

  it("drops the video for audio-only", () => {
    expect(includeVideo(DEFAULT_RECORDING_PRIVACY)).toBe(true)
    expect(includeVideo({ ...DEFAULT_RECORDING_PRIVACY, media: "audio-only" })).toBe(false)
  })

  it("credits by the chosen name, falling back to anonymous", () => {
    const account = { name: "Ada  Byron Lovelace" }
    const p = DEFAULT_RECORDING_PRIVACY
    expect(publicCreditName(p, account)).toBe("Anonymous contributor")
    expect(publicCreditName({ ...p, credit: "username", username: "ada" }, account)).toBe("ada")
    expect(publicCreditName({ ...p, credit: "username", username: "" }, account)).toBe("Anonymous contributor")
    expect(publicCreditName({ ...p, credit: "real-name", realNameFormat: "full" }, account)).toBe("Ada  Byron Lovelace")
    expect(publicCreditName({ ...p, credit: "real-name", realNameFormat: "first-initial" }, account)).toBe("Ada L.")
    expect(publicCreditName({ ...p, credit: "real-name" }, { name: "" })).toBe("Anonymous contributor")
    expect(firstNameAndInitial("Cher")).toBe("Cher")
  })

  it("validates deletion requests", () => {
    expect(validateDeletionRequest({ scope: "all" }).value).toEqual({ scope: "all", categories: [], details: "" })
    expect(validateDeletionRequest({ scope: "part" }).errors).toHaveLength(1)
    expect(validateDeletionRequest({ scope: "part", details: "  my video  " }).value?.details).toBe("my video")
    expect(validateDeletionRequest({ scope: "part", categories: ["recordings", "secrets"] }).errors).toHaveLength(1)
    expect(validateDeletionRequest({ scope: "part", categories: ["recordings"] }).value?.categories).toEqual(["recordings"])
    expect(validateDeletionRequest({ scope: "some" }).errors).toHaveLength(1)
  })
})
