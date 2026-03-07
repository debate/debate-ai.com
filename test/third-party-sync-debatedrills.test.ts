import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("grab-url", () => ({ default: vi.fn() }))

import grab from "grab-url"
import { getDatasets, scrapeDivision } from "../lib/third-party-sync/sync-rankings-debatedrills"

const grabMock = vi.mocked(grab)

describe("sync-rankings-debatedrills", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("builds URLs that include the previous academic year", () => {
    const datasets = getDatasets("2023")
    expect(datasets[0].url).toContain("2022-2023")
    expect(datasets[1].division).toBe("VLD")
  })

})
