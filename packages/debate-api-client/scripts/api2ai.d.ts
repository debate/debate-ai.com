// api2ai ships plain JavaScript with no type declarations; this covers the
// one export scripts/mcp-tools.ts uses.
declare module "api2ai" {
  export interface Api2AiTool {
    name: string
    description: string
    zodSchema: string
    method: string
    pathTemplate: string
    executionParameters: { name: string; in: string }[]
    requestBodyContentType?: string
    operationId: string
    baseUrl?: string
  }

  export function extractTools(
    spec: unknown,
    options?: {
      baseUrl?: string
      excludeOperationIds?: string[]
      filterFn?: (tool: Api2AiTool) => boolean
    },
  ): Api2AiTool[]
}
