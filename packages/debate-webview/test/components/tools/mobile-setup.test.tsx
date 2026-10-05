import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

import MobileSetupPage from "../../../src/routes/coaching/laptopless/page"

describe("MobileSetupPage", () => {
  it("recommends the Arteck Bluetooth keyboard, not the Bnnwa model", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).toContain("Arteck Universal Backlit Bluetooth Keyboard with Touchpad")
    expect(html).not.toContain("Bnnwa")
  })

  it("links the keyboard to the correct affiliate URL", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).toContain("https://amzn.to/4z1Isay")
  })

  it("does not leak the old affiliate link from the replaced keyboard", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).not.toContain("https://amzn.to/4hgaLLt")
  })

  it("uses the provided image URL for the keyboard", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).toContain("https://i.imgur.com/EKNFuEf.jpeg")
  })

  it("references the Arteck keyboard in the pairing step, not Bnnwa", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).toContain("Arteck")
    expect(html).not.toContain("Bnnwa")
  })

  it("lists the Belkin charging station with its affiliate link and image", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).toContain("Belkin 70W GaN 7-in-1 Charging Station")
    expect(html).toContain("https://amzn.to/4xZw4ak")
    expect(html).toContain("https://m.media-amazon.com/images/I/61VAOpYG0vL._AC_SL500_.jpg")
  })

  it("lists every recommended gear item with its role", () => {
    const html = renderToStaticMarkup(<MobileSetupPage />)

    expect(html).toContain("Hands-free phone mount")
    expect(html).toContain("Bluetooth keyboard for the phone")
    expect(html).toContain("Fast-charging cables for phone &amp; keyboard")
    expect(html).toContain("Keep the phone alive all day")
    expect(html).toContain("Giant floating screen, no laptop")
    expect(html).toContain("A phone to run it on")
    expect(html).toContain("Phone service &amp; data")
  })
})
