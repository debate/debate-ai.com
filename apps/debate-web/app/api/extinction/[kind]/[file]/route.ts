import { NextResponse, type NextRequest } from "next/server";
import { EXTINCTION_BASE_URL, EXTINCTION_FORMAT_PREFIX } from "@debate-ai/rankings";

/**
 * Same-origin proxy for Extinction.GG's live JSON files
 * (`/api/extinction/teams/HSPolicy2526.json` → `https://extinction.gg/live/teams/HSPolicy2526.json`).
 *
 * Extinction.GG sends no `Access-Control-Allow-Origin`, so the rankings
 * loader in `@debate-ai/rankings` reads through here in the browser. Only the
 * `teams` and `bids` files for the known format prefixes are allowed, so this
 * is not an open proxy.
 *
 * Caching: successful responses are kept in the Worker's Cloudflare cache for
 * 30 minutes and in the browser for 10, so visitors share one upstream fetch.
 * Upstream 403/404 (a season with no bid list yet) is passed through with its
 * status, which the loader treats as "no bids", and cached for 10 minutes.
 */

const KINDS = new Set(["teams", "bids"]);
const FILE_PATTERN = new RegExp(`^(?:${Object.values(EXTINCTION_FORMAT_PREFIX).join("|")})\\d{4}\\.json$`);

const OK_CACHE = "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600";
const MISSING_CACHE = "public, max-age=600, s-maxage=600";

type EdgeCache = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };

/** The Worker's default cache, or null outside Cloudflare (dev, tests). */
function edgeCache(): EdgeCache | null {
  const store = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return store?.default ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; file: string }> }) {
  const { kind, file } = await params;
  if (!KINDS.has(kind) || !FILE_PATTERN.test(file)) {
    return NextResponse.json({ error: "Unknown Extinction.GG file" }, { status: 404 });
  }

  const upstreamUrl = `${EXTINCTION_BASE_URL}/${kind}/${file}`;
  const cacheKey = new Request(upstreamUrl);
  const cache = edgeCache();
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return hit;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { headers: { Accept: "application/json" } });
  } catch (error) {
    console.error("[extinction] upstream fetch failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Extinction.GG unreachable" }, { status: 502 });
  }

  if (upstream.status === 403 || upstream.status === 404) {
    const missing = new Response(JSON.stringify({ error: "Not found" }), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { "Content-Type": "application/json", "Cache-Control": MISSING_CACHE },
    });
    await cache?.put(cacheKey, missing.clone()).catch(() => undefined);
    return missing;
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Extinction.GG returned ${upstream.status}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = new Response(await upstream.text(), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": OK_CACHE },
  });
  await cache?.put(cacheKey, response.clone()).catch(() => undefined);
  return response;
}
