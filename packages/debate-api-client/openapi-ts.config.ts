import { defineConfig } from "@hey-api/openapi-ts"

/**
 * Generates request/response types only — the SDK layer in src/sdk.ts is
 * hand-written on top of these types and calls the Debate AI API through
 * grab-url (src/client.ts) instead of a Hey API client plugin, so every
 * operation keeps grab's caching, retries, rate limiting, and dedupe.
 */
export default defineConfig({
  input: "../../apps/debate-ai.com/public/debate-openapi.yml",
  output: "src/generated",
  plugins: ["@hey-api/typescript"],
})
