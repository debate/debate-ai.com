/**
 * A read-only proxy to live Tabroom: the API that beta.tabroom.com's own
 * frontend calls (`https://api.tabroom.com/v1`). The tournaments UI imported
 * from `debate-tournaments` fetches through it, so the browser only ever talks
 * to this origin and Tabroom's CORS policy never comes into play.
 *
 * Mounted at `/api/tabroom-beta` by `app/api/tabroom-beta/[...path]/route.ts`;
 * `/api/tabroom-beta/pages/invite/upcoming` fetches
 * `https://api.tabroom.com/v1/pages/invite/upcoming`. Only the public `rest/`
 * and `pages/` trees are forwarded, only GET and HEAD, and no cookie or
 * credential from the visitor is passed on.
 */

export const TABROOM_BETA_API = "https://api.tabroom.com/v1"
export const TABROOM_BETA_PROXY_BASE = "/api/tabroom-beta"

const ALLOWED_ROOTS = new Set(["rest", "pages"])
const UPSTREAM_TIMEOUT_MS = 15_000

/** Maps a request to this proxy onto the upstream URL, or null when it is not forwardable. */
export function tabroomBetaUpstreamUrl(requestUrl: string, base = TABROOM_BETA_PROXY_BASE): URL | null {
  const url = new URL(requestUrl)
  if (!url.pathname.startsWith(`${base}/`)) return null
  const segments = url.pathname.slice(base.length + 1).split("/")
  if (!ALLOWED_ROOTS.has(segments[0] ?? "")) return null
  if (segments.some((s) => s === "" || s === "." || s === ".." || decodeURIComponent(s).includes("/"))) return null
  const upstream = new URL(`${TABROOM_BETA_API}/${segments.join("/")}`)
  upstream.search = url.search
  return upstream
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  })
}

export async function proxyTabroomBeta(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(405, { detail: "The Tabroom proxy is read-only." }, { allow: "GET, HEAD" })
  }
  const upstream = tabroomBetaUpstreamUrl(request.url)
  if (!upstream) return json(404, { detail: "Not a public Tabroom API path." })

  let res: Response
  try {
    res = await fetchImpl(upstream, {
      method: request.method,
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError" ? "Tabroom did not answer in time." : "Tabroom could not be reached."
    return json(502, { detail })
  }

  const headers = new Headers({
    "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
    // Pairings and results change during a tournament; a minute keeps a
    // refresh current while sparing Tabroom a request per visitor.
    "cache-control": res.ok ? "public, max-age=60, s-maxage=60" : "no-store",
  })
  return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers })
}
