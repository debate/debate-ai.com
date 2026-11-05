/**
 * @fileoverview `/api/tts/cache`: the shared R2 cache of Kokoro read-aloud
 * paragraphs. Anyone reads by key; only signed-in users store, the server
 * derives the key from the text itself, refuses audio that isn't a plausible
 * mono 16-bit WAV, and keeps the first upload for a key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { encodePcm16Wav, kokoroAudioCacheKey } from "@debate-ai/editor/kokoro-cache-key"

let signedInAs: string | null = "user-1"
const objects = new Map<string, { bytes: Uint8Array; meta?: Record<string, string> }>()
const bucket = {
  head: async (key: string) => (objects.has(key) ? {} : null),
  get: async (key: string) => {
    const o = objects.get(key)
    return o ? { body: new Blob([o.bytes as BlobPart]).stream(), size: o.bytes.byteLength } : null
  },
  put: vi.fn(async (key: string, value: Uint8Array, options?: { customMetadata?: Record<string, string> }) => {
    objects.set(key, { bytes: value, meta: options?.customMetadata })
  }),
}

vi.mock("@/lib/auth/session", () => ({ getUserId: async () => signedInAs }))
vi.mock("@/lib/database/context", () => ({ getCloudflareContext: () => ({ env: { SPEECH_AUDIO: bucket } }) }))

const { GET, POST } = await import("@/app/api/tts/cache/route")

const wav = (seconds: number) => encodePcm16Wav(new Int16Array(Math.round(24000 * seconds)), 24000)

function upload(text: string, voice: string, audio: Uint8Array) {
  const form = new FormData()
  form.set("text", text)
  form.set("voice", voice)
  form.set("audio", new File([audio as BlobPart], "p.wav", { type: "audio/wav" }))
  return POST(new Request("https://debate-ai.com/api/tts/cache", { method: "POST", body: form }))
}

describe("/api/tts/cache", () => {
  beforeEach(() => {
    signedInAs = "user-1"
    objects.clear()
    bucket.put.mockClear()
  })

  it("stores a signed-in reader's paragraph under the hash of its text, then serves it to anyone", async () => {
    const res = await upload("Warming  causes extinction.", "af_heart", wav(1))
    expect(res.status).toBe(201)
    const { key, stored } = await res.json()
    expect(stored).toBe(true)
    expect(key).toBe(await kokoroAudioCacheKey("Warming causes extinction.", "af_heart"))
    expect([...objects.keys()]).toEqual([`tts-cache/kokoro/${key}.wav`])

    signedInAs = null
    const got = await GET(new Request(`https://debate-ai.com/api/tts/cache?key=${key}`))
    expect(got.status).toBe(200)
    expect(got.headers.get("content-type")).toBe("audio/wav")
    expect(got.headers.get("cache-control")).toContain("immutable")
    expect((await got.arrayBuffer()).byteLength).toBe(wav(1).byteLength)
  })

  it("refuses uploads from signed-out readers", async () => {
    signedInAs = null
    expect((await upload("Hi there.", "af_heart", wav(1))).status).toBe(401)
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it("refuses bad voices, non-WAV audio and audio far longer than the text", async () => {
    expect((await upload("Hi there.", "../etc", wav(1))).status).toBe(400)
    expect((await upload("Hi there.", "af_heart", new Uint8Array([1, 2, 3]))).status).toBe(415)
    expect((await upload("Hi.", "af_heart", wav(60))).status).toBe(415)
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it("keeps the first upload for a paragraph", async () => {
    await upload("Same text.", "af_heart", wav(1))
    const again = await upload("Same text.", "af_heart", wav(2))
    expect((await again.json()).stored).toBe(false)
    expect(bucket.put).toHaveBeenCalledTimes(1)
  })

  it("answers 404 for a miss and 400 for a malformed key", async () => {
    expect((await GET(new Request(`https://debate-ai.com/api/tts/cache?key=${"a".repeat(64)}`))).status).toBe(404)
    expect((await GET(new Request("https://debate-ai.com/api/tts/cache?key=../x"))).status).toBe(400)
  })
})
