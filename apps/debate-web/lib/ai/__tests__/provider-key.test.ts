import { afterEach, describe, expect, it, vi } from "vitest"
import { ownThenSharedKeys } from "../provider-key"

const withKey = (key?: string) =>
  new Request("http://localhost/api/admin/videos/watch-ai", key ? { headers: { "x-user-ai-key": key } } : {})

afterEach(() => vi.unstubAllEnvs())

describe("ownThenSharedKeys", () => {
  it("puts the admin's own key ahead of the site's shared keys", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-site")
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-site")
    expect(ownThenSharedKeys(withKey("sk-or-v1-mine"))).toEqual([
      { provider: "openrouter", key: "sk-or-v1-mine", own: true },
      { provider: "openrouter", key: "sk-or-site", own: false },
      { provider: "anthropic", key: "sk-ant-site", own: false },
    ])
  })

  it("falls back to the shared keys when the admin has none", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-site")
    vi.stubEnv("ANTHROPIC_API_KEY", "")
    expect(ownThenSharedKeys(withKey())).toEqual([{ provider: "openrouter", key: "sk-or-site", own: false }])
  })

  it("keeps only the asked-for provider", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-site")
    expect(ownThenSharedKeys(withKey("sk-ant-mine"), "openrouter")).toEqual([])
    expect(ownThenSharedKeys(withKey("sk-or-v1-mine"), "openrouter")).toEqual([
      { provider: "openrouter", key: "sk-or-v1-mine", own: true },
    ])
  })
})
