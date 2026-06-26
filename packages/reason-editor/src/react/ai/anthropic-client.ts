/**
 * Anthropic client for reason-editor's AI features.
 *
 * Adapted from CardMirror's `ai/anthropic.ts`. CardMirror calls the
 * Anthropic API directly from the browser with a user-pasted API key;
 * debate-ai.com is a shared multi-tenant app, so this version posts to
 * the host's server-side proxy route instead (default `/api/reason-ai`,
 * overridable via `configureReasonAi`), which holds the one Anthropic
 * key server-side.
 */

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        /** MIME type of the inlined bytes — Anthropic's vision API
         *  supports `image/png`, `image/jpeg`, `image/gif`, `image/webp`. */
        media_type: string;
        /** Raw base64 (no `data:` prefix). */
        data: string;
      };
    };

/** Raster formats the vision API accepts. SVG / EMF / TIFF aren't
 *  supported; callers should filter and fall back gracefully. */
export const VISION_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicRequest {
  /** System prompt. */
  system?: string;
  messages: AnthropicMessage[];
  /** Max tokens to generate. Defaults to a sane chat-reply size. */
  maxTokens?: number;
  /** Sampling temperature. Omit to use Anthropic's default. */
  temperature?: number;
}

export interface AnthropicReply {
  text: string;
  /** `'max_tokens'` means the output was truncated by the token limit. */
  stopReason?: string;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly kind: "auth" | "rate-limit" | "server" | "network" | "parse" | "config",
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

let endpoint = "/api/reason-ai";

/** Override the proxy endpoint the AI features POST to. Hosts only need
 *  this if `/api/reason-ai` isn't where they mounted the proxy route. */
export function configureReasonAi(opts: { endpoint?: string }): void {
  if (opts.endpoint) endpoint = opts.endpoint;
}

export async function callAnthropic(req: AnthropicRequest): Promise<AnthropicReply> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch (e) {
    throw new AnthropicError(
      `Network error reaching AI proxy: ${e instanceof Error ? e.message : String(e)}`,
      null,
      "network",
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const payload = (await res.json()) as { error?: string };
      detail = payload?.error ?? "";
    } catch {
      // Body wasn't JSON.
    }
    const kind: AnthropicError["kind"] =
      res.status === 401 ? "auth" : res.status === 429 ? "rate-limit" : res.status === 503 ? "config" : "server";
    throw new AnthropicError(detail || `AI request failed (${res.status}).`, res.status, kind);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new AnthropicError(
      `Failed to parse AI response: ${e instanceof Error ? e.message : String(e)}`,
      res.status,
      "parse",
    );
  }

  const { text, stopReason } = json as { text?: string; stopReason?: string };
  if (!text) {
    throw new AnthropicError("AI returned an empty response.", res.status, "parse");
  }
  return { text, stopReason };
}
