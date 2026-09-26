import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"
import { getEnv } from "@/lib/env"

/**
 * General-purpose server-side proxy for this app's Anthropic-backed AI
 * features. Originally built for reason-editor's AI features (cite
 * formatting, OCR/PDF text repair, image alt text, the research-coach
 * "explain"), it's a plain `{ system?, messages, maxTokens?, temperature? }`
 * passthrough to the Anthropic Messages API, so any package in this repo
 * can reuse it rather than standing up its own proxy route — e.g.
 * debate-card-search's LLM Card Scoring AI assessment.
 *
 * The CardMirror upstream reason-editor was ported from calls Anthropic
 * directly from the browser with a user-pasted API key. debate-ai.com is a
 * shared multi-tenant app, so instead callers hit this route and the
 * server holds the one Anthropic key (ANTHROPIC_API_KEY).
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-6"
const ANTHROPIC_VERSION = "2023-06-01"
const MAX_TOKENS_CAP = 16384
const MAX_REQUEST_CHARS = 400_000

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }

interface AnthropicMessage {
  role: "user" | "assistant"
  content: string | AnthropicContentBlock[]
}

interface ReasonAiRequestBody {
  system?: string
  messages?: AnthropicMessage[]
  maxTokens?: number
  temperature?: number
}

function requestSize(messages: AnthropicMessage[], system?: string): number {
  let size = system?.length ?? 0
  for (const m of messages) {
    if (typeof m.content === "string") {
      size += m.content.length
    } else {
      for (const block of m.content) {
        size += block.type === "text" ? block.text.length : block.source.data.length
      }
    }
  }
  return size
}

/** An Anthropic Messages turn in OpenAI Chat Completions shape. */
function toChatCompletionsMessage(m: AnthropicMessage) {
  if (typeof m.content === "string") return m
  return {
    role: m.role,
    content: m.content.map((block) =>
      block.type === "text"
        ? { type: "text", text: block.text }
        : {
            type: "image_url",
            image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
          },
    ),
  }
}

export async function POST(request: Request) {
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 })
  }

const apiKey = getEnv("ANTHROPIC_API_KEY")
  const openrouterKey = getEnv("OPENROUTER_API_KEY")
  if (!apiKey && !openrouterKey) {
    return NextResponse.json(
      { error: "AI features are not configured on the server." },
      { status: 503 },
    )
  }

  let body: ReasonAiRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "`messages` must be a non-empty array." }, { status: 400 })
  }
  if (requestSize(body.messages, body.system) > MAX_REQUEST_CHARS) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 })
  }

  const maxTokens = Math.min(body.maxTokens ?? 1024, MAX_TOKENS_CAP)

  const useOpenRouter = Boolean(openrouterKey)
  const endpoint = useOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.anthropic.com/v1/messages"
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (useOpenRouter) {
    headers.authorization = `Bearer ${openrouterKey}`
    headers["HTTP-Referer"] = "https://debate-ai.com"
    headers["X-Title"] = "Debate AI"
  } else {
    headers["x-api-key"] = apiKey!
    headers["anthropic-version"] = ANTHROPIC_VERSION
  }

  let res: Response
  try {
    const bodyJson: Record<string, unknown> = {
      max_tokens: maxTokens,
      messages: body.messages,
    }
    if (useOpenRouter) {
      bodyJson.model = "anthropic/claude-sonnet-4.6"
      // Chat Completions has no top-level `system` (OpenRouter silently drops
      // it, so every caller's instructions were lost): it goes in as the
      // first message, and Anthropic content blocks become OpenAI parts.
      bodyJson.messages = [
        ...(body.system ? [{ role: "system", content: body.system }] : []),
        ...body.messages.map(toChatCompletionsMessage),
      ]
      if (body.temperature != null) bodyJson.temperature = body.temperature
    } else {
      bodyJson.model = ANTHROPIC_MODEL
      if (body.temperature != null) bodyJson.temperature = body.temperature
      if (body.system) bodyJson.system = body.system
    }
    res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(bodyJson) })
  } catch (e) {
    return NextResponse.json(
      { error: `Network error contacting AI provider: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    )
  }

  if (!res.ok) {
    let detail = ""
    try {
      const payload = (await res.json()) as { error?: { message?: string } }
      detail = payload?.error?.message ?? ""
    } catch {
      // Body wasn't JSON.
    }
    return NextResponse.json(
      { error: `AI API returned ${res.status}${detail ? `: ${detail}` : ""}` },
      { status: res.status >= 400 && res.status < 500 ? res.status : 502 },
    )
  }

  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>
    choices?: Array<{ message?: { content?: string } }>
    stop_reason?: string
  }
  let text: string
  if (json.choices?.[0]?.message?.content) {
    text = json.choices[0].message.content
  } else {
    text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
  }
  if (!text) {
    return NextResponse.json({ error: "AI API returned an empty response." }, { status: 502 })
  }

  return NextResponse.json({ text, stopReason: json.stop_reason })
}
