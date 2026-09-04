/**
 * @fileoverview Text-generation clients — the port of Go
 * `backend/services/gemini.go` (`initGemini`, `generateModelText`,
 * `cleanModelOutput`) and `backend/services/ai.go` (the OpenAI chat helper).
 *
 * The Go server held one process-global `genai.Client`. Here the backend
 * takes a `ModelClient` instead, so the host app decides which provider and
 * key to use — and so tests can pass a stub with no network. Anthropic,
 * Gemini and OpenAI implementations are all provided; all three are plain
 * `fetch` calls with no SDK, which keeps the package usable from a
 * Cloudflare Worker as well as from Node.
 *
 * @module backend/model-client
 */

/** Generates one completion for one prompt. The seam the whole backend uses. */
export interface ModelClient {
  generateText(prompt: string, signal?: AbortSignal): Promise<string>
}

/**
 * Strip the markdown code fence a model often wraps JSON in. Ported verbatim
 * from Go `cleanModelOutput`, which trimmed ```json / ```JSON / ``` markers.
 */
export function cleanModelOutput(text: string): string {
  let cleaned = text.trim()
  for (const prefix of ["```json", "```JSON", "```"]) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length)
      break
    }
  }
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
  return cleaned.trim()
}

/** Default model per provider — the successors of Go's `gemini-3.6-flash`. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

export interface AnthropicClientOptions {
  apiKey: string
  model?: string
  maxTokens?: number
  baseUrl?: string
}

/**
 * Anthropic Messages API client — the provider debate-ai.com already holds a
 * key for (`ANTHROPIC_API_KEY`), so it is the default the Next.js routes wire
 * in. The Go server's Gemini safety-setting overrides have no Anthropic
 * equivalent and are simply dropped.
 */
export function createAnthropicModelClient(options: AnthropicClientOptions): ModelClient {
  const {
    apiKey,
    model = DEFAULT_ANTHROPIC_MODEL,
    maxTokens = 2048,
    baseUrl = "https://api.anthropic.com/v1/messages",
  } = options

  return {
    async generateText(prompt, signal) {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
        signal,
      })
      if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
      }
      const data = (await response.json()) as {
        content?: { type: string; text?: string }[]
      }
      const text = (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("")
      return cleanModelOutput(text)
    },
  }
}

export interface GeminiClientOptions {
  apiKey: string
  model?: string
  baseUrl?: string
}

/**
 * Google Gemini client, matching what the Go server actually ran — including
 * the four `BLOCK_NONE` safety settings from `generateModelText`, since a
 * debate bot arguing a hard stance otherwise trips the harassment filter.
 */
export function createGeminiModelClient(options: GeminiClientOptions): ModelClient {
  const {
    apiKey,
    model = DEFAULT_GEMINI_MODEL,
    baseUrl = "https://generativelanguage.googleapis.com/v1beta/models",
  } = options

  return {
    async generateText(prompt, signal) {
      const response = await fetch(`${baseUrl}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
        signal,
      })
      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}: ${await response.text()}`)
      }
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
      return cleanModelOutput(text)
    },
  }
}

export interface OpenAiClientOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  /** Prepended as a system message, as the Go `developerPrompt` was. */
  systemPrompt?: string
}

/**
 * OpenAI chat-completions client — the port of Go `services.ChatGPT.Chat`,
 * whose `developer`-role message becomes a `system` message here.
 */
export function createOpenAiModelClient(options: OpenAiClientOptions): ModelClient {
  const {
    apiKey,
    model = DEFAULT_OPENAI_MODEL,
    baseUrl = "https://api.openai.com/v1/chat/completions",
    systemPrompt,
  } = options

  return {
    async generateText(prompt, signal) {
      const messages = systemPrompt
        ? [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ]
        : [{ role: "user", content: prompt }]
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages }),
        signal,
      })
      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`)
      }
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      return cleanModelOutput(data.choices?.[0]?.message?.content ?? "")
    },
  }
}

/** A fixed-response client, for tests and for local runs without a key. */
export function createStaticModelClient(reply: string | ((prompt: string) => string)): ModelClient {
  return {
    async generateText(prompt) {
      return typeof reply === "function" ? reply(prompt) : reply
    },
  }
}
