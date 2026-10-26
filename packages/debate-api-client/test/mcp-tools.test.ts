import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { buildMcpToolManifest, type McpToolManifest } from "../scripts/mcp-tools"

const root = fileURLToPath(new URL("..", import.meta.url))
const specText = readFileSync(`${root}debate-openapi.yml`, "utf8")
const committed = JSON.parse(readFileSync(`${root}mcp-tools.json`, "utf8")) as McpToolManifest

describe("mcp-tools.json", () => {
  it("matches what api2ai generates from debate-openapi.yml (run `bun run generate:mcp`)", () => {
    expect(committed).toEqual(buildMcpToolManifest(specText))
  })

  it("leaves admin, auth and MCP operations out", () => {
    const names = committed.tools.map((tool) => tool.name)
    expect(names).not.toContain("syncVideos")
    expect(names).not.toContain("mcpServer")
    expect(names).not.toContain("createMcpApiKey")
    expect(names).not.toContain("getAuthProviders")
    expect(committed.tools.some((tool) => tool.pathTemplate.startsWith("/admin/"))).toBe(false)
    expect(names).toContain("searchCards")
  })

  it("gives every tool a unique name and an object input schema", () => {
    const names = committed.tools.map((tool) => tool.name)
    expect(new Set(names).size).toBe(names.length)
    for (const tool of committed.tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/)
      expect(tool.inputSchema.type).toBe("object")
    }
  })

  it("requires every path parameter and resolves $refs", () => {
    const getFlow = committed.tools.find((tool) => tool.name === "getFlow")!
    expect(getFlow.inputSchema.required).toContain("clientId")
    expect(JSON.stringify(committed)).not.toContain("$ref")
  })

  it("marks reads as read-only and deletes as destructive", () => {
    const search = committed.tools.find((tool) => tool.name === "searchCards")!
    expect(search.annotations.readOnlyHint).toBe(true)
    expect(search.riskLevel).toBe("low")
    const del = committed.tools.find((tool) => tool.name === "deleteFlow")!
    expect(del.annotations.destructiveHint).toBe(true)
    expect(del.riskLevel).toBe("medium")
  })
})
