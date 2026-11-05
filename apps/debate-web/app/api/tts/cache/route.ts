import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth/session"
import { getKokoroAudioBucket, kokoroAudioObjectKey } from "@/lib/tts/kokoro-audio-cache-store"
import {
  MAX_CACHED_AUDIO_BYTES,
  MAX_CACHED_TEXT_CHARS,
  cachedAudioProblem,
  isKokoroAudioKey,
  isKokoroVoiceId,
  kokoroAudioCacheKey,
  normalizeSpeechText,
} from "@debate-ai/editor/kokoro-cache-key"

/**
 * The shared cache of Kokoro read-aloud paragraphs
 * (`lib/tts/kokoro-audio-cache-store.ts`).
 *
 * GET ?key=<64 hex> — the paragraph's WAV, for anyone (signed in or not);
 *   404 when nobody has made it yet. Keys are content hashes, so a hit is
 *   cached by the browser for a year.
 * POST multipart { text, voice, audio } — a signed-in reader's browser
 *   stores a paragraph it just made with Kokoro. The server hashes `text`
 *   and `voice` into the key itself, checks the audio is a mono 16-bit WAV
 *   of a plausible length, and keeps the first upload for a key (later
 *   ones answer `{ stored: false }`). 401 when signed out.
 */
function unavailable() {
  return NextResponse.json(
    { error: "Read-aloud cache is not configured", details: "Bind the SPEECH_AUDIO R2 bucket in wrangler.jsonc." },
    { status: 503 },
  )
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? ""
  if (!isKokoroAudioKey(key)) return NextResponse.json({ error: "Invalid key." }, { status: 400 })
  const bucket = getKokoroAudioBucket()
  if (!bucket) return unavailable()
  const object = await bucket.get(kokoroAudioObjectKey(key))
  if (!object) {
    return NextResponse.json({ error: "Not cached." }, { status: 404, headers: { "Cache-Control": "no-store" } })
  }
  return new Response(object.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

export async function POST(request: Request) {
  const userId = await getUserId().catch(() => null)
  if (!userId) return NextResponse.json({ error: "Sign in to share read-aloud audio." }, { status: 401 })
  const bucket = getKokoroAudioBucket()
  if (!bucket) return unavailable()

  const length = Number(request.headers.get("content-length") ?? "0")
  if (length > MAX_CACHED_AUDIO_BYTES + 64 * 1024) return NextResponse.json({ error: "Audio too large." }, { status: 413 })
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 400 })
  }
  const text = normalizeSpeechText(String(form.get("text") ?? ""))
  const voice = String(form.get("voice") ?? "")
  const audio = form.get("audio")
  if (!text || text.length > MAX_CACHED_TEXT_CHARS) return NextResponse.json({ error: "Invalid text." }, { status: 400 })
  if (!isKokoroVoiceId(voice)) return NextResponse.json({ error: "Invalid voice." }, { status: 400 })
  if (!audio || typeof audio === "string") return NextResponse.json({ error: "Missing audio." }, { status: 400 })
  if (audio.size > MAX_CACHED_AUDIO_BYTES) return NextResponse.json({ error: "Audio too large." }, { status: 413 })

  const bytes = new Uint8Array(await audio.arrayBuffer())
  const problem = cachedAudioProblem(bytes, text)
  if (problem) return NextResponse.json({ error: problem }, { status: 415 })

  const key = await kokoroAudioCacheKey(text, voice)
  if (!key) return NextResponse.json({ error: "Hashing is unavailable." }, { status: 500 })
  const objectKey = kokoroAudioObjectKey(key)
  // Content-addressed and immutable: the first upload for a paragraph stays.
  if (await bucket.head(objectKey)) return NextResponse.json({ key, stored: false })
  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType: "audio/wav" },
    customMetadata: { voice, uploadedBy: userId, chars: String(text.length) },
  })
  return NextResponse.json({ key, stored: true }, { status: 201 })
}
