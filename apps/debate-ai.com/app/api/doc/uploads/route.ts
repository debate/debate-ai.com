import { QWKSEARCH_ORIGIN } from "@/components/qwksearch/base-url"

/**
 * Pass-through to qwksearch.com's document upload endpoint.
 *
 * Unlike every other network call in the embedded qwksearch UI (which goes
 * through grab-url or qwksearch-api-client, both repointed at qwksearch.com
 * by the /doc embed), research-agent-ui's file-upload hook issues a raw
 * same-origin `fetch("/api/doc/uploads")` with no base-URL hook — so this
 * route exists solely to forward that one call upstream.
 */
const UPSTREAM = `${QWKSEARCH_ORIGIN}/api/doc/uploads`

async function forward(req: Request): Promise<Response> {
  const headers = new Headers()
  const contentType = req.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)

  const upstream = await fetch(UPSTREAM, {
    method: req.method,
    headers,
    // Buffer the body instead of streaming: streaming request bodies need
    // half-duplex support that isn't available across all deploy targets.
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
  })

  const responseHeaders = new Headers()
  const upstreamType = upstream.headers.get("content-type")
  if (upstreamType) responseHeaders.set("content-type", upstreamType)
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function POST(req: Request) {
  return forward(req)
}

export async function GET(req: Request) {
  return forward(req)
}
