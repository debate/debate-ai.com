/**
 * GET /api/caselist-team/file?path=hspf25/Harker/LiLe/hspf25-Harker-LiLe-Pro-Blake-Round1.docx
 *
 * Streams one open-source document from openCaselist, which only serves files
 * to a signed-in session (and at most ten a minute per account), so each file
 * is fetched once with the server's session and then served from the edge
 * cache. Only `<caselist>/<school>/<team>/<file>` paths are accepted.
 *
 * A file an admin synced (`lib/caselist/team-caselist-sync.ts`) is served
 * from the CARD_TEXT R2 bucket instead, without touching openCaselist.
 */
import { NextResponse } from "next/server"
import { CaselistApiError, createCaselistClient } from "@debate-ai/research-evidence/src/caselist/caselist-api"
import { caselistCredentials, isOpenSourcePath } from "@/lib/caselist/team-caselist"
import { type CaselistFileBucket, caselistFileKey } from "@/lib/caselist/team-caselist-sync"
import { getCardTextBucket } from "@/lib/search/card-text-store"

const CACHE_SECONDS = 30 * 24 * 60 * 60

const CONTENT_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pdf: "application/pdf",
  rtf: "application/rtf",
  txt: "text/plain; charset=utf-8",
}

function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default
}

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path") ?? ""
  if (!isOpenSourcePath(path)) {
    return NextResponse.json({ error: "Not a caselist open-source path" }, { status: 400 })
  }
  const bucket = getCardTextBucket() as unknown as CaselistFileBucket | null
  const synced = await bucket?.get(caselistFileKey(path)).catch(() => null)
  if (synced) {
    const fileName = path.split("/").pop() ?? "file"
    const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
    return new Response(await synced.arrayBuffer(), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, immutable`,
      },
    })
  }

  const credentials = caselistCredentials()
  if (!credentials) {
    return NextResponse.json({ error: "openCaselist downloads are not configured on this server" }, { status: 503 })
  }

  const cache = edgeCache()
  const cacheKey = new Request(request.url, { method: "GET" })
  const cached = await cache?.match(cacheKey).catch(() => undefined)
  if (cached) return new Response(cached.body, cached)

  try {
    const upstream = await createCaselistClient(credentials).download(path)
    const fileName = path.split("/").pop() ?? "file"
    const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
    const response = new Response(await upstream.arrayBuffer(), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, immutable`,
      },
    })
    await cache?.put(cacheKey, response.clone()).catch(() => undefined)
    return response
  } catch (error) {
    const status = error instanceof CaselistApiError ? error.status : 502
    const message =
      status === 429
        ? "openCaselist download limit reached; try again in a minute."
        : status === 404
          ? "File not found on openCaselist."
          : "openCaselist did not answer."
    return NextResponse.json({ error: message }, { status: status === 404 || status === 429 ? status : 502 })
  }
}
