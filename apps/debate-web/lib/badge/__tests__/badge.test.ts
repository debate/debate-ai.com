import { describe, expect, it } from "vitest"
import { BADGE_STYLES, createBadgeSvg, escapeXml, handleBadgeRequest } from "../badge"

const get = (query: string) => handleBadgeRequest(new Request(`https://debate-ai.com/api/badge${query}`))

describe("/api/badge", () => {
  it("returns an SVG with the label and number", async () => {
    const res = get("?label=Words&number=1250")
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8")
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=3600")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox")
    const svg = await res.text()
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain('aria-label="Words: 1250"')
    expect(svg).toContain(">1250</text>")
  })

  it("accepts value as an alternative to number", async () => {
    expect(await get("?label=Downloads&value=1.2k").text()).toContain(">1.2k</text>")
  })

  it("uses the label's preset colours, case-insensitively", async () => {
    const svg = await get("?label=Cited%20By&number=108").text()
    expect(svg).toContain(BADGE_STYLES["cited by"]!.color)
    expect(svg).toContain(BADGE_STYLES["cited by"]!.colorDark)
  })

  it("lets custom hex colours override the preset", async () => {
    const svg = await get("?label=Pages&number=1&color=%23123456&colorDark=%23abc").text()
    expect(svg).toContain('stop-color="#123456"')
    expect(svg).toContain('stop-color="#abc"')
  })

  it("rejects a missing label, long params and non-hex colours", async () => {
    for (const query of ["", "?label=%20", `?label=${"x".repeat(81)}`, `?label=a&number=${"1".repeat(41)}`, "?label=a&color=red"]) {
      const res = get(query)
      expect(res.status).toBe(400)
      expect(res.headers.get("Cache-Control")).toBe("no-store")
      expect((await res.json()).error).toBeTypeOf("string")
    }
  })

  it("escapes markup in the label and value", () => {
    const svg = createBadgeSvg({ label: "<script>", value: `"&'` })
    expect(svg).not.toContain("<script>")
    expect(svg).toContain(escapeXml("<script>"))
    expect(svg).toContain("&quot;&amp;&apos;")
  })

  it("omits the value text when there is no value", () => {
    expect(createBadgeSvg({ label: "Words" }).match(/<text/g)).toHaveLength(1)
  })
})
