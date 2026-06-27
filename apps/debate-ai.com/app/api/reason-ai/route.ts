import { NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"
import { getEnv } from "@/lib/env"

/**
 * Server-side proxy for reason-editor's AI features (cite formatting,
 * OCR/PDF text repair, image alt text, the research-coach "explain").
 *
 * The CardMirror upstream this is ported from calls Anthropic directly
 * from the browser with a user-pasted API key. debate-ai.com is a
 * shared multi-tenant app, so instead the editor calls this route and
 * the server holds the one Anthropic key (ANTHROPIC_API_KEY).
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

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (!session) {
    return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 })
  }

  const apiKey = getEnv("ANTHROPIC_API_KEY")
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI features are not configured on this server." },
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

  let res: Response
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        ...(body.temperature != null ? { temperature: body.temperature } : {}),
        ...(body.system ? { system: body.system } : {}),
        messages: body.messages,
      }),
    })
  } catch (e) {
    return NextResponse.json(
      { error: `Network error contacting Anthropic: ${e instanceof Error ? e.message : String(e)}` },
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
      { error: `Anthropic API returned ${res.status}${detail ? `: ${detail}` : ""}` },
      { status: res.status >= 400 && res.status < 500 ? res.status : 502 },
    )
  }

  const json = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>
    stop_reason?: string
  }
  const text = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
  if (!text) {
    return NextResponse.json({ error: "Anthropic returned an empty response." }, { status: 502 })
  }

  return NextResponse.json({ text, stopReason: json.stop_reason })
}
