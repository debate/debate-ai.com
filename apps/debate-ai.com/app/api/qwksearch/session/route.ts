import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import { connectionFromToken, qwksearchOrigin, toSessionPayload } from "@/lib/qwksearch/connect"
import { loadConnection, saveConnection } from "@/lib/qwksearch/store"

const noStore = { "Cache-Control": "no-store" }

/**
 * GET — the signed-in user's linked QwkSearch account, in the shape
 * research-agent-ui's connect auth client reads: `{ connected, user, apiKey,
 * plan, upgradeUrl }`. The key is the user's own and goes only to them; the
 * embed needs it to call qwksearch.com as that account.
 *
 * `?refresh=1` re-reads the profile and plan from QwkSearch first — the
 * settings page asks for it when the user comes back from upgrading. A key
 * QwkSearch no longer accepts (regenerated there) unlinks the account.
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ connected: false }, { headers: noStore })

  let connection = await loadConnection(session.user.id)
  if (connection && request.nextUrl.searchParams.get("refresh") === "1") {
    try {
      const res = await fetch(new URL("/api/connect/me", qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN"))), {
        headers: { "X-API-Key": connection.apiKey, Accept: "application/json" },
      })
      if (res.status === 401) {
        connection = null
        await saveConnection(session.user.id, null)
      } else if (res.ok) {
        const refreshed = connectionFromToken(await res.json(), connection)
        if (refreshed) {
          connection = refreshed
          await saveConnection(session.user.id, refreshed)
        }
      }
    } catch (error) {
      // QwkSearch unreachable: keep serving what we have.
      console.warn("[qwksearch] plan refresh failed:", error)
    }
  }

  return NextResponse.json(toSessionPayload(connection), { headers: noStore })
}
