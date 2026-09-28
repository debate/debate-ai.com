/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import Image from "../../src/next/image"
import Link from "../../src/next/link"
import { usePathname, useSearchParams } from "../../src/next/navigation"
import { currentHref, navigate, resolveHref } from "../../src/host/history"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  // jsdom logs "not implemented" for scrolling; navigation scrolls to top.
  window.scrollTo = () => {}
  window.history.replaceState(null, "", "/options.html#/videos?event=ndt")
})

afterEach(() => {
  document.body.innerHTML = ""
})

describe("hash history", () => {
  it("reads and writes app paths after the #", () => {
    expect(currentHref()).toBe("/videos?event=ndt")
    navigate("/cards")
    expect(window.location.hash).toBe("#/cards")
    expect(window.location.pathname).toBe("/options.html")
  })

  it("resolves relative and query-only hrefs against the current path", () => {
    expect(resolveHref("?page=2")).toBe("/videos?page=2")
    expect(resolveHref("rank")).toBe("/rank")
  })
})

describe("next/link shim", () => {
  it("writes in-app hrefs into the fragment and leaves external ones alone", () => {
    expect(renderToStaticMarkup(<Link href="/cards">Cards</Link>)).toContain('href="#/cards"')
    expect(renderToStaticMarkup(<Link href={{ pathname: "/videos", query: { q: "k" } }}>v</Link>)).toContain('href="#/videos?q=k"')
    expect(renderToStaticMarkup(<Link href="https://example.com/x">x</Link>)).toContain('href="https://example.com/x"')
  })

  it("navigates in place on click and re-renders readers of the path", async () => {
    const container = document.createElement("div")
    document.body.append(container)
    function Where() {
      return <span data-testid="where">{usePathname()}|{useSearchParams().get("event") ?? ""}</span>
    }
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <>
          <Where />
          <Link href="/rank">Rank</Link>
        </>,
      )
    })
    expect(container.querySelector("span")?.textContent).toBe("/videos|ndt")
    await act(async () => {
      container.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
    })
    expect(window.location.hash).toBe("#/rank")
    expect(container.querySelector("span")?.textContent).toBe("/rank|")
    root.unmount()
  })
})

describe("next/image shim", () => {
  it("renders a plain img, filling its box when asked", () => {
    expect(renderToStaticMarkup(<Image src="/a.png" alt="a" width={10} height={20} />)).toMatch(/<img[^>]*src="\/a.png"[^>]*width="10"/)
    const filled = renderToStaticMarkup(<Image src={{ src: "/b.png", width: 1, height: 1 }} alt="" fill />)
    expect(filled).toContain("position:absolute")
    expect(filled).not.toContain("width=")
  })
})
