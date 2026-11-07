/**
 * GET /api/caselist-team?dataset=hspf&school=Harker&team=Lin%20%26%20Lee
 *
 * A ranked team's openCaselist page — rounds with open-source files, and the
 * wiki cites — for the team profile. See `lib/caselist/team-caselist.ts`.
 * Answers are edge-cached for six hours; a team page changes a few times a
 * week at most, and openCaselist rate limits per account.
 *
 * A team an admin synced from openCaselist (every season, with its files in
 * R2 — see `lib/caselist/team-caselist-sync.ts`) is answered from our own
 * database first, with no openCaselist session needed.
 */
import { NextResponse } from "next/server"
import { CaselistApiError, createCaselistClient } from "@debate-ai/research-evidence/src/caselist/caselist-api"
import { caselistCredentials, emptyPayload, lookupTeamCaselist } from "@/lib/caselist/team-caselist"
import { readStoredTeamCaselist } from "@/lib/caselist/team-caselist-sync"
import { getDBFromContext } from "@/lib/database/context"

const CACHE_SECONDS = 6 * 60 * 60

function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dataset = searchParams.get("dataset")?.trim() ?? ""
  const school = searchParams.get("school")?.trim() ?? ""
  const team = searchParams.get("team")?.trim() ?? ""
  if (!dataset || !school || !team) {
    return NextResponse.json({ error: "dataset, school and team are required" }, { status: 400 })
  }

  const stored = await readStoredTeamCaselist(await getDBFromContext(), { dataset, school, team }).catch((error) => {
    console.warn(`caselist-team stored lookup failed for ${school} ${team}:`, error)
    return null
  })
  if (stored) {
    return NextResponse.json(stored, { headers: { "Cache-Control": "public, max-age=300" } })
  }

  const credentials = caselistCredentials()
  if (!credentials) {
    return NextResponse.json(emptyPayload(false), { headers: { "Cache-Control": "no-store" } })
  }

  const cache = edgeCache()
  const cacheKey = new Request(request.url, { method: "GET" })
  const cached = await cache?.match(cacheKey).catch(() => undefined)
  if (cached) return new Response(cached.body, cached)

  try {
    const payload = await lookupTeamCaselist(createCaselistClient(credentials), { dataset, school, team })
    const response = NextResponse.json(payload, {
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
    })
    await cache?.put(cacheKey, response.clone()).catch(() => undefined)
    return response
  } catch (error) {
    const message =
      error instanceof CaselistApiError && error.status === 401
        ? "The openCaselist session on the server has expired."
        : "openCaselist did not answer."
    console.warn(`caselist-team lookup failed for ${school} ${team}:`, error)
    return NextResponse.json(emptyPayload(true, message), { headers: { "Cache-Control": "no-store" } })
  }
}
