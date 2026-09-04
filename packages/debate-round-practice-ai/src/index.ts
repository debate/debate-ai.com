/**
 * @fileoverview Practice vs AI — a full timed debate round against an AI
 * opponent, ported from the Go `arguehub` server and its Vite/React client
 * into Node/TypeScript and Next.js.
 *
 * Three surfaces, all exported from here:
 *
 * - `./backend` — the port of the Go vs-bot server: the 13 bot personalities
 *   from `services/personalities.go`, prompt construction, AI judging,
 *   gamification rules, and the four `/vsbot/*` handlers. Framework-agnostic:
 *   handlers take parsed bodies and a resolved actor and return
 *   `{ status, body }`, so a Next.js route handler wraps one in a few lines.
 * - `./client` — the browser client for those endpoints.
 * - `./ui` — the ported round screens.
 *
 * @example Wiring the backend into a Next.js route handler
 * ```ts
 * import { createPracticeVsAiBackend, createAnthropicModelClient } from "debate-practice-vs-ai"
 *
 * const backend = createPracticeVsAiBackend({
 *   store: myStore,
 *   model: createAnthropicModelClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
 * })
 * const { status, body } = await backend.createDebate(actor, await request.json())
 * ```
 *
 * @module debate-practice-vs-ai
 */

export * from "./backend"
export * from "./ui"
export {
  DEFAULT_VSBOT_BASE_URL,
  concedeDebate,
  createDebate,
  judgeDebate as judgeDebateRequest,
  sendDebateMessage,
  type CreateDebateInput,
  type CreateDebateResult,
  type VsBotClientOptions,
} from "./client"
