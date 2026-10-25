/**
 * Builds the MCP tool manifest (`mcp-tools.json`) from `debate-openapi.yml`.
 *
 * api2ai (https://www.npmjs.com/package/api2ai) does the OpenAPI → MCP tool
 * extraction: one tool per operation, named after its `operationId`, with the
 * same `executionParameters` / `requestBody` calling convention its generated
 * mcp-use servers use. Its generated server is a standalone Node process, which
 * the Cloudflare Worker cannot host, so instead of writing that server out we
 * keep api2ai's tool list and add what an MCP `tools/list` answer needs on top:
 * a JSON Schema `inputSchema` (api2ai emits Zod source text), the tool's risk
 * level, and MCP tool annotations. The Worker's `/api/mcp` endpoint
 * (apps/debate-web/lib/mcp) serves the result.
 *
 * Regenerate with `bun run generate:mcp` after editing the spec;
 * test/mcp-tools.test.ts fails while the committed manifest is stale.
 */
import { extractTools } from "api2ai"
import { parse } from "yaml"

/** One tool in `mcp-tools.json`. */
export interface McpToolManifestEntry {
  name: string
  title: string
  description: string
  method: "get" | "post" | "put" | "patch" | "delete"
  /** Path under `/api`, with `{param}` placeholders. */
  pathTemplate: string
  executionParameters: { name: string; in: "path" | "query" }[]
  requestBodyContentType?: string
  inputSchema: JsonSchema
  /** api2ai's classification: `low` is read-only, `medium` writes, `high` touches auth/billing. */
  riskLevel: "low" | "medium" | "high"
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }
}

export interface McpToolManifest {
  /** The spec's `info.version`. */
  specVersion: string
  tools: McpToolManifestEntry[]
}

type JsonSchema = Record<string, unknown>

/**
 * Operations that are not exposed as tools: admin-gated routes, sign-in
 * plumbing, and the MCP endpoint and its key management themselves.
 */
const EXCLUDED_TAGS = new Set(["Admin", "Auth", "MCP"])
const EXCLUDED_PATH_PREFIXES = ["/admin/", "/auth/", "/mcp"]

// api2ai's high-risk keyword list, applied to the path and operationId.
const HIGH_RISK = /admin|auth|billing|payment|token|secret|password|stripe|wallet/i

const ALLOWED_METHODS = new Set(["get", "post", "put", "patch", "delete"])

/** Resolves every local `$ref` in `node` against `spec`, guarding cycles. */
function deref(node: unknown, spec: Record<string, unknown>, seen: string[] = []): unknown {
  if (Array.isArray(node)) return node.map((item) => deref(item, spec, seen))
  if (!node || typeof node !== "object") return node
  const obj = node as Record<string, unknown>
  if (typeof obj.$ref === "string") {
    const ref = obj.$ref
    if (seen.includes(ref) || !ref.startsWith("#/")) return { type: "object" }
    const target = ref
      .slice(2)
      .split("/")
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], spec)
    return deref(target ?? { type: "object" }, spec, [...seen, ref])
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    // OpenAPI-only keywords that are not JSON Schema.
    if (key === "example" || key === "xml" || key === "externalDocs" || key === "discriminator") continue
    out[key] = deref(value, spec, seen)
  }
  return out
}

interface OpenApiParameter {
  name: string
  in: string
  required?: boolean
  description?: string
  schema?: JsonSchema
}

interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenApiParameter[]
  requestBody?: { required?: boolean; description?: string; content?: Record<string, { schema?: JsonSchema }> }
}

function buildInputSchema(
  spec: Record<string, unknown>,
  pathParameters: OpenApiParameter[],
  operation: OpenApiOperation,
): JsonSchema {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const raw of [...pathParameters, ...(operation.parameters ?? [])]) {
    const param = deref(raw, spec) as OpenApiParameter
    if (param.in !== "path" && param.in !== "query") continue
    properties[param.name] = {
      ...((param.schema as JsonSchema | undefined) ?? { type: "string" }),
      ...(param.description ? { description: param.description } : {}),
    }
    if (param.required || param.in === "path") required.push(param.name)
  }
  const content = operation.requestBody?.content
  const media = content?.["application/json"] ?? (content ? Object.values(content)[0] : undefined)
  if (media?.schema) {
    properties.requestBody = {
      ...(deref(media.schema, spec) as JsonSchema),
      description: operation.requestBody?.description ?? "Request body (JSON).",
    }
    if (operation.requestBody?.required) required.push("requestBody")
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) }
}

/** Builds the manifest from the spec's YAML text. Pure: same text, same output. */
export function buildMcpToolManifest(specText: string): McpToolManifest {
  const spec = parse(specText) as Record<string, unknown> & {
    info?: { version?: string }
    paths?: Record<string, Record<string, unknown>>
  }
  const paths = spec.paths ?? {}

  const tools = extractTools(spec, {
    filterFn: (tool) => {
      if (!ALLOWED_METHODS.has(tool.method)) return false
      if (EXCLUDED_PATH_PREFIXES.some((prefix) => tool.pathTemplate === prefix || tool.pathTemplate.startsWith(prefix))) return false
      const operation = paths[tool.pathTemplate]?.[tool.method] as OpenApiOperation | undefined
      return !(operation?.tags ?? []).some((tag) => EXCLUDED_TAGS.has(tag))
    },
  })

  return {
    specVersion: spec.info?.version ?? "0.0.0",
    tools: tools
      .map((tool): McpToolManifestEntry => {
        const pathItem = paths[tool.pathTemplate] ?? {}
        const operation = pathItem[tool.method] as OpenApiOperation
        const method = tool.method as McpToolManifestEntry["method"]
        const readOnly = method === "get"
        const riskLevel = HIGH_RISK.test(`${tool.pathTemplate} ${tool.operationId}`) ? "high" : readOnly ? "low" : "medium"
        const description = [operation.summary, operation.description]
          .filter((part): part is string => Boolean(part?.trim()))
          .map((part) => part.trim())
          .filter((part, index, parts) => parts.indexOf(part) === index)
          .join("\n\n")
        return {
          name: tool.name,
          title: operation.summary?.trim() || tool.name,
          description: `${description || tool.description}\n\n${method.toUpperCase()} /api${tool.pathTemplate}`.slice(0, 2048),
          method,
          pathTemplate: tool.pathTemplate,
          executionParameters: tool.executionParameters.filter(
            (param): param is { name: string; in: "path" | "query" } => param.in === "path" || param.in === "query",
          ),
          ...(tool.requestBodyContentType ? { requestBodyContentType: tool.requestBodyContentType } : {}),
          inputSchema: buildInputSchema(spec, (pathItem.parameters as OpenApiParameter[] | undefined) ?? [], operation),
          riskLevel,
          annotations: {
            readOnlyHint: readOnly,
            destructiveHint: method === "delete",
            idempotentHint: readOnly || method === "put" || method === "delete",
            openWorldHint: false,
          },
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
