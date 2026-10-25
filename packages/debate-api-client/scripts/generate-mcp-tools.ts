/**
 * Writes mcp-tools.json from debate-openapi.yml — `bun run generate:mcp`.
 * See ./mcp-tools.ts.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { buildMcpToolManifest } from "./mcp-tools"

const root = fileURLToPath(new URL("..", import.meta.url))
const manifest = buildMcpToolManifest(readFileSync(`${root}debate-openapi.yml`, "utf8"))
writeFileSync(`${root}mcp-tools.json`, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${manifest.tools.length} MCP tools to mcp-tools.json`)
