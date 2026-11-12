import { describe, expect, it } from "vitest"
import { SESSION_REPLAY_OPTIONS } from "../replay-config"

describe("Session Replay options", () => {
  it("blocks the card editor, whose snapshot is over Amplitude's event size limit", () => {
    expect(SESSION_REPLAY_OPTIONS.privacyConfig.blockSelector).toContain(".dec-cardmirror-root")
  })

  it("keeps recording every session", () => {
    expect(SESSION_REPLAY_OPTIONS.sampleRate).toBe(1)
  })
})
