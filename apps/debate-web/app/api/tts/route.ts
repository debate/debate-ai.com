import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import { getCloudflareContext } from "@/lib/database/context"
import { qwksearchOrigin } from "@debate-ai/qwksearch/lib/connect"
import { loadConnection } from "@/lib/qwksearch/store"
import {
  CLOUDFLARE_TTS_MODEL,
  auraSpeaker,
  backendOrder,
  cloudflareRunUrl,
  isAudioContentType,
  parseTtsRequest,
  qwksearchVoiceBody,
  type TtsBackend,
  type TtsRequest,
} from "@debate-ai/webview/lib/tts/voice"

/**
 * POST { text, provider?: "kokoro" | "deepgram", voice?, route?: "auto" |
 * "cloudflare" | "qwksearch" } → the spoken text as audio bytes, for the card
 * editor's Read aloud button. See `packages/debate-webview/src/lib/tts/voice.ts` for the backends and
 * their order.
 *
 * Errors are JSON `{ error, backend? }`: `429` when QwkSearch's guest limit
 * (10 a day) is spent, so the client can retry straight from the browser on
 * the visitor's own guest allowance; `503` when no backend could answer. The
 * client falls back to the browser's built-in speech on either.
 *
 * Cloudflare runs on this site's account, so it serves signed-in users only.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }
  const parsed = parseTtsRequest(body)
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const session = await getSession().catch(() => null)
  const userId = session?.user?.id ?? null
  let rateLimited = false
  let lastError = "Text-to-speech is unavailable."

  for (const backend of backendOrder(parsed.provider, parsed.route)) {
    try {
      const res =
        backend === "cloudflare" ? (userId ? await speakCloudflare(parsed) : null) : await speakQwkSearch(parsed, userId)
      if (!res) continue
      if (res.status === 429) {
        rateLimited = true
        lastError = "QwkSearch's daily text-to-speech limit is used up."
        continue
      }
      if (res.ok && isAudioContentType(res.headers.get("content-type"))) return audioResponse(res, backend)
      lastError = `${backend} answered ${res.status}.`
    } catch (error) {
      console.warn(`[tts] ${backend} failed:`, error)
      lastError = `${backend} is unreachable.`
    }
  }

  return NextResponse.json({ error: lastError }, { status: rateLimited ? 429 : 503 })
}

function audioResponse(res: Response, backend: TtsBackend): Response {
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
      "X-TTS-Backend": backend,
    },
  })
}

/** QwkSearch, as the user's linked account when there is one, else as a guest. */
async function speakQwkSearch(req: TtsRequest, userId: string | null): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "audio/*" }
  if (userId) {
    const connection = await loadConnection(userId).catch(() => null)
    if (connection?.apiKey) headers["X-API-Key"] = connection.apiKey
  }
  return fetch(new URL("/api/agent/voice", qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN"))), {
    method: "POST",
    headers,
    body: qwksearchVoiceBody(req),
  })
}

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

/** Workers AI Aura through the `AI` binding, else the REST API; null when neither is configured. */
async function speakCloudflare(req: TtsRequest): Promise<Response | null> {
  const input = { text: req.text, speaker: auraSpeaker(req.voice) }
  const ai = getCloudflareContext()?.env?.AI as AiBinding | undefined
  if (ai && typeof ai.run === "function") {
    const out = await ai.run(CLOUDFLARE_TTS_MODEL, input)
    return new Response(toAudioBody(out), { headers: { "Content-Type": "audio/mpeg" } })
  }
  const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID")
  const token = getEnv("CLOUDFLARE_AI_API_TOKEN")
  if (!accountId || !token) return null
  return fetch(cloudflareRunUrl(accountId), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
}

/** The binding answers a stream or bytes; some TTS models answer `{ audio: base64 }`. */
function toAudioBody(out: unknown): BodyInit {
  if (out instanceof ReadableStream || out instanceof ArrayBuffer || out instanceof Uint8Array) return out as BodyInit
  const audio = (out as { audio?: unknown } | null)?.audio
  if (typeof audio === "string") return Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
  throw new Error("Workers AI returned no audio.")
}
