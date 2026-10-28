import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import {
  EXTENSION_CALLBACK_PATH,
  connectionFromToken,
  qwksearchOrigin,
  toSessionPayload,
} from "@debate-ai/qwksearch/lib/connect"
import { saveConnection } from "@/lib/qwksearch/store"

const noStore = { "Cache-Control": "no-store" }

/**
 * POST — finishes "Sign in with QwkSearch" for the browser extension
 * (packages/debate-qwksearch/src/lib/connect.ts, EXTENSION_CALLBACK_PATH).
 *
 * The extension can't take part in the cookie-based flow behind
 * /api/qwksearch/connect: its requests here carry a bearer token rather than
 * the site's cookie, and QwkSearch only redirects to allowlisted web origins.
 * So it runs the PKCE half itself — makes the verifier, sends a tab to
 * QwkSearch's consent screen with this site's EXTENSION_CALLBACK_PATH as the
 * redirect, reads the code off that tab — and posts `{ code, code_verifier }`
 * here. This redeems the code with QwkSearch and stores the key on the
 * signed-in debate-ai account, exactly as /api/qwksearch/callback does, then
 * answers with the same payload as /api/qwksearch/session.
 *
 * The redirect URI is fixed to this site's own completion page, so this
 * can't redeem codes issued to anything else.
 */
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })

  let body: { code?: unknown; code_verifier?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  if (typeof body.code !== "string" || typeof body.code_verifier !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: noStore })
  }

  try {
    const res = await fetch(new URL("/api/connect/token", qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN"))), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        code: body.code,
        redirect_uri: new URL(EXTENSION_CALLBACK_PATH, request.url).toString(),
        code_verifier: body.code_verifier,
      }),
    })
    const connection = res.ok ? connectionFromToken(await res.json()) : null
    if (!connection) {
      console.error("[qwksearch] extension token exchange failed:", res.status)
      return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: noStore })
    }
    await saveConnection(session.user.id, connection)
    return NextResponse.json(toSessionPayload(connection), { headers: noStore })
  } catch (error) {
    console.error("[qwksearch] extension token exchange error:", error)
    return NextResponse.json({ error: "server_error" }, { status: 502, headers: noStore })
  }
}
