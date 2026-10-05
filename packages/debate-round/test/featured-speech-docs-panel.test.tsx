// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { FeaturedSpeechDocsPanel } from "../src/panels/FeaturedSpeechDocsPanel"
import { featuredSpeechDocsTabs } from "../src/panels/featuredSpeechDocsTabs"
import { featuredRoundForVideo } from "../src/round/featured-rounds"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("featured round video links", () => {
  it("ties NDT 2015 Finals to its library video", () => {
    expect(featuredRoundForVideo("zoKowWVQ1wE")?.key).toBe("ndt-2015-finals")
    expect(featuredRoundForVideo("other")).toBeUndefined()
    expect(featuredRoundForVideo(null)).toBeUndefined()
  })

  it("adds a Speech docs tab only for that video", () => {
    expect(featuredSpeechDocsTabs("zoKowWVQ1wE").map((tab) => tab.label)).toEqual(["Speech docs"])
    expect(featuredSpeechDocsTabs("other")).toEqual([])
  })
})

describe("FeaturedSpeechDocsPanel", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const id = new URL(url, "https://x").searchParams.get("path")
        return {
          ok: true,
          status: 200,
          json: async () => ({ item: { content: `<p>doc ${id}</p>`, format: "html" } }),
        } as Response
      }),
    )
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  const speechButton = (name: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === name)!

  it("flips through the speeches, with the 2AR listed but disabled", async () => {
    await act(async () => {
      root.render(createElement(FeaturedSpeechDocsPanel, { featuredKey: "ndt-2015-finals" }))
    })
    await vi.waitFor(() => expect(container.textContent).toContain("doc 48"))

    expect(Array.from(container.querySelectorAll('[role="tab"]')).map((b) => b.textContent)).toEqual([
      "1AC", "1NC", "2AC", "2NC", "1NR", "1AR", "2NR", "2AR",
    ])
    expect(speechButton("2AR").disabled).toBe(true)
    expect(container.querySelector('a[href="/debate/2015-ndt/northwestern-mv-michigan-ap"]')).not.toBeNull()

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next speech"]')!.click())
    expect(container.textContent).toContain("doc 46")

    act(() => speechButton("2NR").click())
    expect(container.textContent).toContain("doc 44")
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next speech"]')!.disabled).toBe(true)
  })
})
