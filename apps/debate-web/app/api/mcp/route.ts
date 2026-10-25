import { handleMcpRequest } from "@/lib/mcp/server"
import { verifySessionAuthorization } from "@/lib/mcp/verify"

/**
 * The MCP server (lib/mcp/server.ts). In production the Worker answers
 * `/api/mcp` itself before this route is reached (worker/index.ts), so tool
 * calls run in-process; this route covers any host that serves the app
 * without that Worker entry, dispatching tool calls back over HTTP.
 */
function handle(request: Request) {
  return handleMcpRequest(request, {
    dispatch: (sub) => fetch(sub),
    verifyAuthorization: verifySessionAuthorization,
  })
}

export const GET = handle
export const POST = handle
export const DELETE = handle
export const OPTIONS = handle
