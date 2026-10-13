/**
 * @fileoverview Model text-to-speech for the card editor's Read aloud button
 * (packages/debate-editor `card-tts-client.ts` → `/api/tts`).
 *
 * Two backends, both optional:
 *
 * - **QwkSearch** — `POST {QWKSEARCH_ORIGIN}/api/agent/voice` with
 *   `{ text, provider: "kokoro" | "deepgram", voice? }`, answering
 *   `audio/wav`. A signed-in user who linked QwkSearch (settings → Research)
 *   calls it with their own key (`X-API-Key`); everyone else is a QwkSearch
 *   guest, limited to 10 a day (a `429`).
 * - **Cloudflare Workers AI** — Deepgram Aura (`@cf/deepgram/aura-1`), run
 *   through the Worker's `AI` binding when one is bound, else through the
 *   Cloudflare REST API when `CLOUDFLARE_ACCOUNT_ID` and
 *   `CLOUDFLARE_AI_API_TOKEN` are set. Workers AI has no Kokoro model, so
 *   Aura stands in for either provider there.
 *
 * Order (`backendOrder`): Kokoro prefers QwkSearch and falls back to
 * Cloudflare; Deepgram prefers Cloudflare and falls back to QwkSearch; the
 * client can pin one with `route`. Everything here is pure so it can be
 * tested without the Worker.
 */

export type TtsProvider = "kokoro" | "deepgram"
export type TtsRoute = "auto" | "cloudflare" | "qwksearch"
export type TtsBackend = "cloudflare" | "qwksearch"

export const TTS_PROVIDERS: readonly TtsProvider[] = ["kokoro", "deepgram"]
export const TTS_ROUTES: readonly TtsRoute[] = ["auto", "cloudflare", "qwksearch"]

/** Longest text spoken in one request; a card's highlighted text fits easily. */
export const MAX_TTS_CHARS = 5000

/** Workers AI's Deepgram Aura model. */
export const CLOUDFLARE_TTS_MODEL = "@cf/deepgram/aura-1"
/** Aura's speakers; a voice outside this list falls back to the default. */
export const AURA_SPEAKERS = [
  "angus",
  "asteria",
  "arcas",
  "orion",
  "orpheus",
  "athena",
  "luna",
  "zeus",
  "perseus",
  "helios",
  "hera",
  "stella",
] as const
export const DEFAULT_AURA_SPEAKER = "asteria"

export interface TtsRequest {
  text: string
  provider: TtsProvider
  voice: string
  route: TtsRoute
}

/** Validates a `/api/tts` body; returns an error message instead when it is unusable. */
export function parseTtsRequest(body: unknown): TtsRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "Expected a JSON body." }
  const raw = body as Record<string, unknown>
  const text = typeof raw.text === "string" ? raw.text.replace(/\s+/g, " ").trim() : ""
  if (!text) return { error: "Nothing to read." }
  const provider = TTS_PROVIDERS.includes(raw.provider as TtsProvider) ? (raw.provider as TtsProvider) : "kokoro"
  const route = TTS_ROUTES.includes(raw.route as TtsRoute) ? (raw.route as TtsRoute) : "auto"
  const voice = typeof raw.voice === "string" ? raw.voice.trim().slice(0, 64) : ""
  return { text: text.slice(0, MAX_TTS_CHARS), provider, voice, route }
}

/** Which backends to try, in order, for a request. */
export function backendOrder(provider: TtsProvider, route: TtsRoute): TtsBackend[] {
  if (route === "cloudflare") return ["cloudflare"]
  if (route === "qwksearch") return ["qwksearch"]
  return provider === "deepgram" ? ["cloudflare", "qwksearch"] : ["qwksearch", "cloudflare"]
}

/**
 * The Aura speaker for a requested voice: an Aura name as is, a Deepgram
 * model id (`aura-luna-en`) by its middle part, anything else (a Kokoro
 * voice such as `af_heart`) the default speaker.
 */
export function auraSpeaker(voice: string): string {
  const name = voice.toLowerCase().replace(/^aura-(?:2-)?/, "").replace(/-en$/, "")
  return (AURA_SPEAKERS as readonly string[]).includes(name) ? name : DEFAULT_AURA_SPEAKER
}

/** The JSON body QwkSearch's `/api/agent/voice` takes. */
export function qwksearchVoiceBody(req: TtsRequest): string {
  const body: Record<string, string> = { text: req.text, provider: req.provider }
  if (req.voice) body.voice = req.voice
  return JSON.stringify(body)
}

/** The Cloudflare REST endpoint that runs `model` on `accountId`. */
export function cloudflareRunUrl(accountId: string, model = CLOUDFLARE_TTS_MODEL): string {
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`
}

/** True when bytes look like audio rather than a JSON error body. */
export function isAudioContentType(contentType: string | null): boolean {
  return !!contentType && /^audio\//i.test(contentType.trim())
}
