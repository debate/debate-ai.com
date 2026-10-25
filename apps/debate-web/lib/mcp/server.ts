/**
 * The hosted MCP server — `POST /api/mcp`.
 *
 * Every tool is one `/api` operation from `debate-openapi.yml`, listed in
 * `@debate-ai/api-client/mcp-tools.json`, which api2ai generates from the spec
 * (packages/debate-api-client/scripts/mcp-tools.ts). A `tools/call` becomes a
 * request to that operation's route, dispatched in-process by the Worker
 * (worker/index.ts) rather than over the network, and the route's response
 * body is the tool's result.
 *
 * Transport: MCP Streamable HTTP in its stateless form. Each POST carries one
 * JSON-RPC message or a batch and is answered with `application/json`; no
 * session id is issued and `GET` does not open an SSE stream (it returns a
 * JSON description instead). That is enough for every tool here, none of
 * which streams progress or calls back into the client.
 *
 * Auth: the caller's `Authorization: Bearer <API key>` header (lib/mcp/api-keys.ts)
 * is checked once per request and forwarded on each tool call, so a tool sees
 * exactly what that account would see. Cookies are never forwarded: the
 * endpoint answers cross-origin requests, and a cookie riding along on one
 * would let any page act as the visitor.
 */
import manifest from "@debate-ai/api-client/mcp-tools.json";

export const MCP_SERVER_NAME = "debate-ai";
/** Protocol revisions this server speaks, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
/** A tool result longer than this is cut, with a note saying so. */
export const MAX_TOOL_RESULT_CHARS = 100_000;

export interface McpTool {
  name: string;
  title: string;
  description: string;
  method: string;
  pathTemplate: string;
  executionParameters: { name: string; in: string }[];
  requestBodyContentType?: string;
  inputSchema: Record<string, unknown>;
  riskLevel: string;
  annotations: Record<string, boolean>;
}

const TOOLS = (manifest as { tools: McpTool[] }).tools;
const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));
export const MCP_SERVER_VERSION = (manifest as { specVersion: string }).specVersion;

const INSTRUCTIONS =
  "Tools for Debate AI (debate-ai.com): search debate evidence cards, browse the round video library and " +
  "transcripts, look up schools, tournaments and leaderboards, and read or update the signed-in account's " +
  "saved rounds, flows, documents and coaching materials. Account tools need an API key from " +
  "Settings → MCP server & API.";

export interface McpHandlerOptions {
  /** Runs a sub-request against this app's own routes. */
  dispatch: (request: Request) => Promise<Response>;
  /**
   * Whether an `Authorization` header names a live session. Called only when
   * the header is present; a request without one is anonymous.
   */
  verifyAuthorization: (authorization: string) => Promise<boolean>;
}

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS, ...extra },
  });
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

export function listTools() {
  return TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, ...tool.annotations },
  }));
}

/** Builds the `/api` request a tool call stands for. */
export function buildToolRequest(
  tool: McpTool,
  args: Record<string, unknown>,
  origin: string,
  authorization: string | null,
): Request {
  let path = tool.pathTemplate;
  const query = new URLSearchParams();
  for (const param of tool.executionParameters) {
    const value = args[param.name];
    if (value === undefined || value === null) continue;
    if (param.in === "path") {
      path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    } else if (param.in === "query") {
      for (const item of Array.isArray(value) ? value : [value]) {
        query.append(param.name, typeof item === "object" ? JSON.stringify(item) : String(item));
      }
    }
  }
  const missing = path.match(/\{([^}]+)\}/);
  if (missing) throw new ToolArgumentError(`Missing required argument "${missing[1]}".`);

  const method = tool.method.toUpperCase();
  const headers = new Headers({ Accept: "application/json" });
  if (authorization) headers.set("Authorization", authorization);
  let body: string | undefined;
  if (args.requestBody !== undefined && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set("Content-Type", tool.requestBodyContentType || "application/json");
    body = typeof args.requestBody === "string" ? args.requestBody : JSON.stringify(args.requestBody);
  }
  const search = query.toString();
  return new Request(`${origin}/api${path}${search ? `?${search}` : ""}`, { method, headers, body });
}

class ToolArgumentError extends Error {}

async function callTool(
  params: Record<string, unknown> | undefined,
  origin: string,
  authorization: string | null,
  dispatch: McpHandlerOptions["dispatch"],
) {
  const name = typeof params?.name === "string" ? params.name : "";
  const tool = TOOL_MAP.get(name);
  if (!tool) return { error: { code: -32602, message: `Unknown tool: ${name || "(none)"}` } };
  const args = params?.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};

  let request: Request;
  try {
    request = buildToolRequest(tool, args, origin, authorization);
  } catch (error) {
    if (error instanceof ToolArgumentError) return { error: { code: -32602, message: error.message } };
    throw error;
  }

  let response: Response;
  try {
    response = await dispatch(request);
  } catch (error) {
    return { result: { content: [{ type: "text", text: `Request failed: ${(error as Error).message}` }], isError: true } };
  }
  let text = await response.text();
  if (text.length > MAX_TOOL_RESULT_CHARS) {
    text = `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n\n[Truncated: the response was ${text.length} characters. Narrow the query to see the rest.]`;
  }
  if (!response.ok) {
    const hint =
      response.status === 401
        ? " This tool needs an API key: create one at Settings → MCP server & API and send it as `Authorization: Bearer <key>`."
        : "";
    text = `HTTP ${response.status}${hint}\n${text}`;
  }
  return { result: { content: [{ type: "text", text: text || `HTTP ${response.status}` }], isError: !response.ok } };
}

async function handleMessage(
  message: unknown,
  origin: string,
  authorization: string | null,
  options: McpHandlerOptions,
): Promise<object | null> {
  if (!message || typeof message !== "object" || (message as JsonRpcRequest).jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid Request");
  }
  const { id, method, params } = message as JsonRpcRequest;
  // A notification (no id), or a response to a server request this server never sends.
  if (id === undefined || typeof method !== "string") return null;

  switch (method) {
    case "initialize": {
      const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_SERVER_NAME, title: "Debate AI", version: MCP_SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: listTools() });
    case "tools/call": {
      const outcome = await callTool(params, origin, authorization, options.dispatch);
      return "error" in outcome ? rpcError(id, outcome.error!.code, outcome.error!.message) : rpcResult(id, outcome.result);
    }
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function handleMcpRequest(request: Request, options: McpHandlerOptions): Promise<Response> {
  const origin = new URL(request.url).origin;

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method === "GET") {
    return json({
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
      transport: "streamable-http (stateless, JSON responses)",
      protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
      endpoint: `${origin}/api/mcp`,
      tools: TOOLS.length,
      auth: "Optional. Send `Authorization: Bearer <API key>` from Settings → MCP server & API for account tools.",
      docs: `${origin}/docs/features/ui-navigation/mcp-server`,
    });
  }
  // Stateless: there is no session to end.
  if (request.method === "DELETE") return new Response(null, { status: 405, headers: CORS_HEADERS });
  if (request.method !== "POST") return json(rpcError(null, -32600, "Use POST."), 405);

  const authorization = request.headers.get("authorization");
  if (authorization && !(await options.verifyAuthorization(authorization))) {
    return json(rpcError(null, -32001, "Invalid or revoked API key. Create a new one at Settings → MCP server & API."), 401, {
      "WWW-Authenticate": 'Bearer realm="debate-ai", error="invalid_token"',
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) return json(rpcError(null, -32600, "Invalid Request"), 400);
    const replies = (await Promise.all(payload.map((m) => handleMessage(m, origin, authorization, options)))).filter(Boolean);
    return replies.length ? json(replies) : new Response(null, { status: 202, headers: CORS_HEADERS });
  }
  const reply = await handleMessage(payload, origin, authorization, options);
  return reply ? json(reply) : new Response(null, { status: 202, headers: CORS_HEADERS });
}
