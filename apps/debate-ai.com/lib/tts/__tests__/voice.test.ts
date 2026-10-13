import { describe, expect, it } from "vitest"
import {
  DEFAULT_AURA_SPEAKER,
  MAX_TTS_CHARS,
  auraSpeaker,
  backendOrder,
  cloudflareRunUrl,
  isAudioContentType,
  parseTtsRequest,
  qwksearchVoiceBody,
} from "../voice"

describe("parseTtsRequest", () => {
  it("defaults to Kokoro on the auto route and collapses whitespace", () => {
    expect(parseTtsRequest({ text: "  Smith  24.\n Warming " })).toEqual({
      text: "Smith 24. Warming",
      provider: "kokoro",
      voice: "",
      route: "auto",
    })
  })

  it("keeps a known provider, voice and route and caps the text", () => {
    const req = parseTtsRequest({ text: "a".repeat(MAX_TTS_CHARS + 50), provider: "deepgram", voice: "aura-luna-en", route: "cloudflare" })
    expect(req).toMatchObject({ provider: "deepgram", voice: "aura-luna-en", route: "cloudflare" })
    expect("text" in req && req.text.length).toBe(MAX_TTS_CHARS)
  })

  it("refuses empty text and non-objects", () => {
    expect(parseTtsRequest({ text: "   " })).toEqual({ error: "Nothing to read." })
    expect(parseTtsRequest(null)).toHaveProperty("error")
  })

  it("replaces an unknown provider or route with the defaults", () => {
    expect(parseTtsRequest({ text: "x", provider: "whisper", route: "elsewhere" })).toMatchObject({
      provider: "kokoro",
      route: "auto",
    })
  })
})

describe("backendOrder", () => {
  it("prefers QwkSearch for Kokoro and Cloudflare for Deepgram", () => {
    expect(backendOrder("kokoro", "auto")).toEqual(["qwksearch", "cloudflare"])
    expect(backendOrder("deepgram", "auto")).toEqual(["cloudflare", "qwksearch"])
  })

  it("pins one backend when the route names it", () => {
    expect(backendOrder("kokoro", "cloudflare")).toEqual(["cloudflare"])
    expect(backendOrder("deepgram", "qwksearch")).toEqual(["qwksearch"])
  })
})

describe("auraSpeaker", () => {
  it("maps Aura names and Deepgram model ids, else the default", () => {
    expect(auraSpeaker("orion")).toBe("orion")
    expect(auraSpeaker("aura-luna-en")).toBe("luna")
    expect(auraSpeaker("af_heart")).toBe(DEFAULT_AURA_SPEAKER)
    expect(auraSpeaker("")).toBe(DEFAULT_AURA_SPEAKER)
  })
})

describe("request helpers", () => {
  it("builds QwkSearch's body without an empty voice", () => {
    expect(JSON.parse(qwksearchVoiceBody({ text: "hi", provider: "kokoro", voice: "", route: "auto" }))).toEqual({
      text: "hi",
      provider: "kokoro",
    })
    expect(JSON.parse(qwksearchVoiceBody({ text: "hi", provider: "deepgram", voice: "v", route: "auto" }))).toEqual({
      text: "hi",
      provider: "deepgram",
      voice: "v",
    })
  })

  it("builds the Cloudflare REST URL", () => {
    expect(cloudflareRunUrl("acc123")).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/deepgram/aura-1")
  })

  it("recognises audio content types only", () => {
    expect(isAudioContentType("audio/wav")).toBe(true)
    expect(isAudioContentType("audio/mpeg; charset=binary")).toBe(true)
    expect(isAudioContentType("application/json")).toBe(false)
    expect(isAudioContentType(null)).toBe(false)
  })
})
