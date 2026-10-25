import { describe, expect, it, vi } from "vitest";
import { buildToolRequest, handleMcpRequest, listTools, MAX_TOOL_RESULT_CHARS, type McpTool } from "../server";

const ORIGIN = "https://debate-ai.com";

function rpc(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function setup(responder: (req: Request) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const dispatch = vi.fn(async (req: Request) => responder(req));
  const verifyAuthorization = vi.fn(async (header: string) => header === "Bearer good");
  return { dispatch, verifyAuthorization };
}

describe("handleMcpRequest", () => {
  it("negotiates the protocol version on initialize", async () => {
    const res = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
      setup(),
    );
    const body = await res.json();
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe("debate-ai");

    const unknown = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }),
      setup(),
    );
    expect((await unknown.json()).result.protocolVersion).toBe("2025-06-18");
  });

  it("answers a notification with 202 and no body", async () => {
    const res = await handleMcpRequest(rpc({ jsonrpc: "2.0", method: "notifications/initialized" }), setup());
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("lists the generated tools", async () => {
    const res = await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }), setup());
    const { result } = await res.json();
    const names = result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("searchCards");
    expect(names).not.toContain("mcpServer");
    expect(result.tools.length).toBe(listTools().length);
  });

  it("dispatches tools/call to the matching /api route and returns its body", async () => {
    const opts = setup(() => Response.json({ results: [{ tag: "Nuclear war" }], total: 1 }));
    const res = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "searchCards", arguments: { q: "nuclear war", year: "2024" } } }),
      opts,
    );
    const body = await res.json();
    expect(body.id).toBe(7);
    expect(body.result.isError).toBe(false);
    expect(JSON.parse(body.result.content[0].text).total).toBe(1);
    const sent = opts.dispatch.mock.calls[0][0];
    expect(sent.method).toBe("GET");
    expect(sent.url).toBe(`${ORIGIN}/api/search?q=nuclear+war&year=2024`);
  });

  it("forwards a valid API key but never the caller's cookies", async () => {
    const opts = setup();
    await handleMcpRequest(
      rpc(
        { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "listFlows", arguments: {} } },
        { authorization: "Bearer good", cookie: "better-auth.session_token=browser" },
      ),
      opts,
    );
    const sent = opts.dispatch.mock.calls[0][0];
    expect(sent.headers.get("authorization")).toBe("Bearer good");
    expect(sent.headers.get("cookie")).toBeNull();
  });

  it("rejects an unknown API key with 401 before running anything", async () => {
    const opts = setup();
    const res = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer revoked" }),
      opts,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(opts.dispatch).not.toHaveBeenCalled();
  });

  it("reports a failed route call as a tool error with a key hint on 401", async () => {
    const opts = setup(() => Response.json({ error: "Unauthorized" }, { status: 401 }));
    const res = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "listFlows", arguments: {} } }),
      opts,
    );
    const { result } = await res.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("API key");
  });

  it("truncates very long results", async () => {
    const opts = setup(() => new Response("x".repeat(MAX_TOOL_RESULT_CHARS + 10)));
    const res = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "getDictionary", arguments: {} } }),
      opts,
    );
    expect((await res.json()).result.content[0].text).toContain("[Truncated");
  });

  it("returns JSON-RPC errors for unknown tools, unknown methods and bad JSON", async () => {
    const unknownTool = await handleMcpRequest(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "dropTables" } }),
      setup(),
    );
    expect((await unknownTool.json()).error.code).toBe(-32602);

    const unknownMethod = await handleMcpRequest(rpc({ jsonrpc: "2.0", id: 2, method: "sampling/createMessage" }), setup());
    expect((await unknownMethod.json()).error.code).toBe(-32601);

    const bad = await handleMcpRequest(
      new Request(`${ORIGIN}/api/mcp`, { method: "POST", body: "{not json" }),
      setup(),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe(-32700);
  });

  it("answers a batch with one reply per request", async () => {
    const res = await handleMcpRequest(
      rpc([
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ]),
      setup(),
    );
    const body = await res.json();
    expect(body.map((r: { id: number }) => r.id)).toEqual([1, 2]);
  });

  it("describes itself on GET and allows CORS preflight", async () => {
    const info = await handleMcpRequest(new Request(`${ORIGIN}/api/mcp`), setup());
    const body = await info.json();
    expect(body.endpoint).toBe(`${ORIGIN}/api/mcp`);
    expect(body.tools).toBeGreaterThan(0);

    const preflight = await handleMcpRequest(new Request(`${ORIGIN}/api/mcp`, { method: "OPTIONS" }), setup());
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("Authorization");
  });
});

describe("buildToolRequest", () => {
  const tool: McpTool = {
    name: "syncFlow",
    title: "Upsert",
    description: "",
    method: "put",
    pathTemplate: "/flows/{clientId}",
    executionParameters: [{ name: "clientId", in: "path" }],
    requestBodyContentType: "application/json",
    inputSchema: { type: "object" },
    riskLevel: "medium",
    annotations: {},
  };

  it("fills path parameters and sends requestBody as JSON", async () => {
    const req = buildToolRequest(tool, { clientId: "a/b", requestBody: { title: "1AC" } }, ORIGIN, null);
    expect(req.url).toBe(`${ORIGIN}/api/flows/a%2Fb`);
    expect(req.method).toBe("PUT");
    expect(req.headers.get("content-type")).toBe("application/json");
    expect(await req.json()).toEqual({ title: "1AC" });
  });

  it("refuses a call missing a path parameter", () => {
    expect(() => buildToolRequest(tool, {}, ORIGIN, null)).toThrow(/clientId/);
  });
});
