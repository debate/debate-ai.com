/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AppFrameProvider,
  AppFrameSurface,
  useAppFrame,
} from "../../../src/components/layout/AppFrameProvider"
import { configureHost } from "../../../src/host/config"

let mockPathname = "/debate"

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: vi.fn((href: string) => {
      mockPathname = href
    }),
  }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("AppFrameProvider and AppFrameSurface", () => {
  let container: HTMLDivElement

  beforeEach(() => {
    configureHost({ framing: true })
    mockPathname = "/debate"
    container = document.createElement("div")
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
    document.body.innerHTML = ""
  })

  it("loads /debate, /cards, and /videos inside an iframe on mount", async () => {
    for (const testPath of ["/debate", "/cards", "/videos"]) {
      mockPathname = testPath
      const root = createRoot(container)
      await act(async () => {
        root.render(
          <AppFrameProvider>
            <AppFrameSurface>
              <div data-testid="regular-content">Unframed</div>
            </AppFrameSurface>
          </AppFrameProvider>,
        )
      })

      const iframes = container.querySelectorAll("iframe")
      expect(iframes.length).toBe(1)
      expect(iframes[0].getAttribute("src")).toBe(`${testPath}?embed=1`)
      expect(iframes[0].style.visibility).toBe("visible")
      expect(iframes[0].style.pointerEvents).toBe("auto")

      await act(async () => {
        root.unmount()
      })
    }
  })

  it("keeps previously loaded iframes mounted and hidden when rotating in dock", async () => {
    mockPathname = "/debate"
    let frameContext: ReturnType<typeof useAppFrame> = null

    function Controller() {
      frameContext = useAppFrame()
      return null
    }

    const root = createRoot(container)
    await act(async () => {
      root.render(
        <AppFrameProvider>
          <Controller />
          <AppFrameSurface>
            <div data-testid="regular-content">Unframed</div>
          </AppFrameSurface>
        </AppFrameProvider>,
      )
    })

    // 1. Initial /debate iframe is visible
    let iframes = container.querySelectorAll("iframe")
    expect(iframes.length).toBe(1)
    expect(iframes[0].getAttribute("src")).toBe("/debate?embed=1")
    expect(iframes[0].style.visibility).toBe("visible")

    // 2. Rotate to /cards via dock openInFrame
    await act(async () => {
      frameContext?.openInFrame("/cards")
    })

    iframes = container.querySelectorAll("iframe")
    expect(iframes.length).toBe(2)
    // /debate is hidden, not destroyed
    expect(iframes[0].getAttribute("src")).toBe("/debate?embed=1")
    expect(iframes[0].style.visibility).toBe("hidden")
    expect(iframes[0].style.pointerEvents).toBe("none")
    expect(iframes[0].getAttribute("aria-hidden")).toBe("true")
    expect(iframes[0].getAttribute("tabindex")).toBe("-1")

    // /cards is active and visible
    expect(iframes[1].getAttribute("src")).toBe("/cards?embed=1")
    expect(iframes[1].style.visibility).toBe("visible")
    expect(iframes[1].style.pointerEvents).toBe("auto")
    expect(iframes[1].getAttribute("aria-hidden")).toBeNull()

    // 3. Rotate to /videos via dock openInFrame
    await act(async () => {
      frameContext?.openInFrame("/videos")
    })

    iframes = container.querySelectorAll("iframe")
    expect(iframes.length).toBe(3)
    // Both /debate and /cards are hidden in the pool
    expect(iframes[0].getAttribute("src")).toBe("/debate?embed=1")
    expect(iframes[0].style.visibility).toBe("hidden")
    expect(iframes[1].getAttribute("src")).toBe("/cards?embed=1")
    expect(iframes[1].style.visibility).toBe("hidden")

    // /videos is visible
    expect(iframes[2].getAttribute("src")).toBe("/videos?embed=1")
    expect(iframes[2].style.visibility).toBe("visible")

    // 4. Rotate back to /debate: resumes fast without reloading or reordering
    await act(async () => {
      frameContext?.openInFrame("/debate")
    })

    iframes = container.querySelectorAll("iframe")
    expect(iframes.length).toBe(3)
    // Order in DOM is preserved (avoiding iframe reloads)
    expect(iframes[0].getAttribute("src")).toBe("/debate?embed=1")
    expect(iframes[0].style.visibility).toBe("visible")
    expect(iframes[0].style.pointerEvents).toBe("auto")

    expect(iframes[1].getAttribute("src")).toBe("/cards?embed=1")
    expect(iframes[1].style.visibility).toBe("hidden")

    expect(iframes[2].getAttribute("src")).toBe("/videos?embed=1")
    expect(iframes[2].style.visibility).toBe("hidden")

    await act(async () => {
      root.unmount()
    })
  })

  it("preloads dock destinations into the hidden frame stack on preloadFrame", async () => {
    mockPathname = "/debate"
    let frameContext: ReturnType<typeof useAppFrame> = null

    function Controller() {
      frameContext = useAppFrame()
      return null
    }

    const root = createRoot(container)
    await act(async () => {
      root.render(
        <AppFrameProvider>
          <Controller />
          <AppFrameSurface>
            <div data-testid="regular-content">Unframed</div>
          </AppFrameSurface>
        </AppFrameProvider>,
      )
    })

    // Preload /cards before clicking
    await act(async () => {
      frameContext?.preloadFrame("/cards")
    })

    const iframes = container.querySelectorAll("iframe")
    expect(iframes.length).toBe(2)
    // /debate is visible, /cards is mounted hidden ready for instant switch
    expect(iframes[0].getAttribute("src")).toBe("/debate?embed=1")
    expect(iframes[0].style.visibility).toBe("visible")
    expect(iframes[1].getAttribute("src")).toBe("/cards?embed=1")
    expect(iframes[1].style.visibility).toBe("hidden")

    await act(async () => {
      root.unmount()
    })
  })

  it("mounts only the frame that is needed, never every dock destination up front", async () => {
    vi.useFakeTimers()
    try {
      mockPathname = "/debate"
      const root = createRoot(container)
      await act(async () => {
        root.render(
          <AppFrameProvider>
            <AppFrameSurface>
              <div data-testid="regular-content">Unframed</div>
            </AppFrameSurface>
          </AppFrameProvider>,
        )
      })

      // Long past any idle-time preload: still just the page on screen.
      await act(async () => {
        vi.advanceTimersByTime(10_000)
      })

      const iframes = container.querySelectorAll("iframe")
      expect(iframes.length).toBe(1)
      expect(iframes[0].getAttribute("src")).toBe("/debate?embed=1")

      await act(async () => {
        root.unmount()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps the frames mounted (hidden) while a non-dock route is shown", async () => {
    mockPathname = "/debate"
    const root = createRoot(container)
    // A fresh element each render, so the provider re-reads the mocked path.
    const tree = () => (
      <AppFrameProvider>
        <AppFrameSurface>
          <div data-testid="regular-content">Unframed</div>
        </AppFrameSurface>
      </AppFrameProvider>
    )
    await act(async () => {
      root.render(tree())
    })
    const debateFrame = container.querySelector("iframe")
    expect(debateFrame).not.toBeNull()

    mockPathname = "/settings"
    await act(async () => {
      root.render(tree())
    })

    expect(container.querySelector("[data-testid='regular-content']")).not.toBeNull()
    // Same element, not a remount: its document was never discarded.
    expect(container.querySelector("iframe")).toBe(debateFrame)
    expect(debateFrame!.style.visibility).toBe("hidden")
    expect(debateFrame!.parentElement!.getAttribute("aria-hidden")).toBe("true")

    mockPathname = "/debate"
    await act(async () => {
      root.render(tree())
    })
    expect(container.querySelector("[data-testid='regular-content']")).toBeNull()
    expect(container.querySelector("iframe")).toBe(debateFrame)
    expect(debateFrame!.style.visibility).toBe("visible")

    await act(async () => {
      root.unmount()
    })
  })
})
