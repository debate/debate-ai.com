import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import {
  CALLBACK_PATH,
  CONNECT_COOKIE,
  CONNECT_COOKIE_MAX_AGE_SECONDS,
  CONNECT_COOKIE_PATH,
  buildAuthorizeUrl,
  pkceChallenge,
  qwksearchOrigin,
  randomToken,
  safeReturnTo,
  serializePending,
} from "@/lib/qwksearch/connect"

/**
 * GET — starts "Sign in with QwkSearch" (lib/qwksearch/connect.ts): makes a
 * PKCE verifier and state, parks them in a short-lived cookie scoped to
 * /api/qwksearch, and sends the visitor to QwkSearch's consent screen.
 *
 * The QwkSearch account is stored against the debate-ai account, so a
 * signed-out visitor signs in here first and comes straight back.
 */
export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"))
  const session = await getSession()
  if (!session) {
    const back = `${request.nextUrl.pathname}?returnTo=${encodeURIComponent(returnTo)}`
    return NextResponse.redirect(new URL(`/login?callbackURL=${encodeURIComponent(back)}`, request.url))
  }

  const verifier = randomToken(48)
  const state = randomToken(24)
  const authorize = buildAuthorizeUrl({
    origin: qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN")),
    redirectUri: new URL(CALLBACK_PATH, request.url).toString(),
    state,
    challenge: await pkceChallenge(verifier),
  })

  const response = NextResponse.redirect(authorize)
  response.cookies.set(CONNECT_COOKIE, serializePending({ verifier, state, returnTo }), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    // Lax: the cookie must ride along on QwkSearch's top-level redirect back.
    sameSite: "lax",
    path: CONNECT_COOKIE_PATH,
    maxAge: CONNECT_COOKIE_MAX_AGE_SECONDS,
  })
  return response
}
