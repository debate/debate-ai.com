import { NextResponse, type NextRequest } from "next/server";
import {
  EXTINCTION_BASE_URL,
  EXTINCTION_FORMAT_PREFIX,
  currentRankingSeasonYear,
} from "@debate-ai/rankings";
import { getDBFromContext } from "@/lib/database/context";
import { readSavedExtinctionFile, saveExtinctionFile } from "@/lib/rankings/extinction-store";

/**
 * Same-origin proxy for Extinction.GG's live JSON files
 * (`/api/extinction/teams/HSPolicy2526.json` → `https://extinction.gg/live/teams/HSPolicy2526.json`).
 *
 * Extinction.GG sends no `Access-Control-Allow-Origin`, so the rankings
 * loader in `@debate-ai/rankings` reads through here in the browser. Only the
 * `teams` and `bids` files for the known format prefixes are allowed, so this
 * is not an open proxy.
 *
 * - **Past seasons** never change, so they are served from D1
 *   (`lib/rankings/extinction-store.ts`). The first request for one fetches it
 *   from Extinction.GG and saves it; every later request skips Extinction.GG.
 * - **The current season** is fetched live and held in the Worker's
 *   Cloudflare cache for 30 minutes and the browser's for 10.
 *
 * Upstream 403/404 (a season with no bid list) is passed through with its
 * status, which the loader treats as "no bids".
 */

const KINDS = new Set(["teams", "bids"]);
const FILE_PATTERN = new RegExp(`^(?:${Object.values(EXTINCTION_FORMAT_PREFIX).join("|")})(\\d{2})(\\d{2})\\.json$`);

const LIVE_CACHE = "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600";
const MISSING_CACHE = "public, max-age=600, s-maxage=600";
const SAVED_CACHE = "public, max-age=86400, s-maxage=604800";

type EdgeCache = { match(req: Request): Promise<Response | undefined>; put(req: Request, res: Response): Promise<void> };

/** The Worker's default cache, or null outside Cloudflare (dev, tests). */
function edgeCache(): EdgeCache | null {
  const store = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return store?.default ?? null;
}

function jsonResponse(status: number, body: string, cacheControl: string, source: "live" | "saved"): Response {
  const ok = status === 200;
  return new Response(ok ? body : JSON.stringify({ error: "Not found" }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": ok ? cacheControl : MISSING_CACHE,
      "X-Extinction-Source": source,
    },
  });
}

type Upstream = { status: number; body: string } | { error: string; status: 502 };

/** Fetches one file from Extinction.GG; 200 and 403/404 are results, anything else an error. */
async function fetchUpstream(kind: string, file: string): Promise<Upstream> {
  try {
    const res = await fetch(`${EXTINCTION_BASE_URL}/${kind}/${file}`, { headers: { Accept: "application/json" } });
    if (res.status === 403 || res.status === 404) return { status: res.status, body: "" };
    if (!res.ok) return { error: `Extinction.GG returned ${res.status}`, status: 502 };
    return { status: 200, body: await res.text() };
  } catch (error) {
    console.error("[extinction] upstream fetch failed:", error instanceof Error ? error.message : String(error));
    return { error: "Extinction.GG unreachable", status: 502 };
  }
}

function upstreamError(error: string): Response {
  return NextResponse.json({ error }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

/** A finished season: D1 first, Extinction.GG only to fill it the first time. */
async function servePastSeason(kind: string, file: string): Promise<Response> {
  const db = await getDBFromContext().catch(() => null);
  if (db) {
    try {
      const saved = await readSavedExtinctionFile(db, kind, file);
      if (saved) return jsonResponse(saved.status, saved.body, SAVED_CACHE, "saved");
    } catch (error) {
      console.error("[extinction] reading saved season failed:", error instanceof Error ? error.message : String(error));
    }
  }

  const upstream = await fetchUpstream(kind, file);
  if ("error" in upstream) return upstreamError(upstream.error);
  if (db) {
    try {
      // A 200 must be valid JSON before it is kept for good.
      if (upstream.status === 200) JSON.parse(upstream.body);
      await saveExtinctionFile(db, kind, file, upstream);
    } catch (error) {
      console.error("[extinction] saving season failed:", error instanceof Error ? error.message : String(error));
    }
  }
  return jsonResponse(upstream.status, upstream.body, SAVED_CACHE, "live");
}

/** The current season: live, behind the edge cache. */
async function serveCurrentSeason(kind: string, file: string): Promise<Response> {
  const cacheKey = new Request(`${EXTINCTION_BASE_URL}/${kind}/${file}`);
  const cache = edgeCache();
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return hit;

  const upstream = await fetchUpstream(kind, file);
  if ("error" in upstream) return upstreamError(upstream.error);
  const response = jsonResponse(upstream.status, upstream.body, LIVE_CACHE, "live");
  await cache?.put(cacheKey, response.clone()).catch(() => undefined);
  return response;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string; file: string }> }) {
  const { kind, file } = await params;
  const match = FILE_PATTERN.exec(file);
  if (!KINDS.has(kind) || !match) {
    return NextResponse.json({ error: "Unknown Extinction.GG file" }, { status: 404 });
  }
  const seasonYear = 2000 + Number(match[2]);
  return seasonYear < currentRankingSeasonYear() ? servePastSeason(kind, file) : serveCurrentSeason(kind, file);
}
