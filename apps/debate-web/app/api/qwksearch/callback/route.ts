import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import {
  CALLBACK_PATH,
  CONNECT_COOKIE,
  CONNECT_COOKIE_PATH,
  connectionFromToken,
  parsePending,
  qwksearchOrigin,
  sameString,
  withStatus,
} from "@/lib/qwksearch/connect"
import { saveConnection } from "@/lib/qwksearch/store"

/**
 * GET — where QwkSearch sends the visitor back after the consent screen.
 * Checks `state` against the cookie /api/qwksearch/connect set, redeems the
 * code with the PKCE verifier, stores the QwkSearch API key, profile and plan
 * on the debate-ai account, and returns to the page the flow started from
 * with `?qwksearch=connected` (or `=denied` / `=error`).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const pending = parsePending(request.cookies.get(CONNECT_COOKIE)?.value)
  const finish = (status: string) => {
    const response = NextResponse.redirect(new URL(withStatus(pending?.returnTo ?? "/doc", status), request.url))
    response.cookies.set(CONNECT_COOKIE, "", { path: CONNECT_COOKIE_PATH, maxAge: 0 })
    return response
  }

  const state = params.get("state") ?? ""
  if (!pending || !sameString(state, pending.state)) return finish("error")
  if (params.get("error")) return finish(params.get("error") === "access_denied" ? "denied" : "error")

  const code = params.get("code")
  const session = await getSession()
  if (!code || !session) return finish("error")

  try {
    const res = await fetch(new URL("/api/connect/token", qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN"))), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        code,
        redirect_uri: new URL(CALLBACK_PATH, request.url).toString(),
        code_verifier: pending.verifier,
      }),
    })
    const connection = res.ok ? connectionFromToken(await res.json()) : null
    if (!connection) {
      console.error("[qwksearch] token exchange failed:", res.status)
      return finish("error")
    }
    await saveConnection(session.user.id, connection)
    return finish("connected")
  } catch (error) {
    console.error("[qwksearch] token exchange error:", error)
    return finish("error")
  }
}
