import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("grab-url", () => ({ default: vi.fn() }))

import grab from "grab-url"
import { getTournamentNames } from "../lib/sync-debate-rankings/sync-tournaments"

const grabMock = vi.mocked(grab)

describe("sync-tournaments", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("extracts unique tournament names and skips navigation links", async () => {
    const html = `
      <a href="/index.mhtml?tourn_id=1">Capital City Invitational</a>
      <a href="/index.mhtml?tourn_id=2">Capital City Invitational</a>
      <a href="/index.mhtml?tourn_id=3">Home</a>
      <a href="/index.mhtml?tourn_id=4">Midwest Clash</a>
      <a href="/index.mhtml?tourn_id=5">About</a>
    `

    grabMock.mockResolvedValue({
      error: false,
      text: async () => html,
    } as never)

    const names = await getTournamentNames()
    expect(names).toEqual(["Capital City Invitational", "Midwest Clash"])
  })
})
