import { NextRequest, NextResponse } from "next/server"
import { getDBFromContext } from "@/lib/database/context"
import { getSession } from "@/lib/auth/session"
import {
  API_KEY_USER_AGENT,
  TooManyApiKeysError,
  createApiKey,
  listApiKeys,
  resetApiKey,
  revealApiKey,
  revokeApiKey,
} from "@/lib/mcp/api-keys"

/**
 * The signed-in account's API keys for the MCP server (/api/mcp) and the REST
 * API — Settings → MCP server & API. See lib/mcp/api-keys.ts.
 *
 * GET           — the keys' summaries; with `?id=`, that key in full (`{ key }`).
 * POST          — `{ name }`: creates a key, answers `{ key, summary }`.
 * PATCH `?id=`  — resets that key to a new token, answers `{ key, summary }`.
 * DELETE `?id=` — revokes that key.
 *
 * Only a browser session can manage keys: a request authenticated *with* a key
 * is refused, so a leaked key can't mint itself replacements before it is
 * revoked.
 */
async function requireBrowserUser(): Promise<string | NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Sign in to manage your API keys." }, { status: 401 })
  }
  const userAgent = (session.session as { userAgent?: string | null }).userAgent ?? ""
  if (userAgent.startsWith(API_KEY_USER_AGENT)) {
    return NextResponse.json({ error: "API keys can only be managed from a signed-in browser." }, { status: 403 })
  }
  return session.user.id
}

export async function GET(req: NextRequest) {
  const userId = await requireBrowserUser()
  if (userId instanceof NextResponse) return userId
  const db = await getDBFromContext()
  const id = req.nextUrl.searchParams.get("id")
  if (id) {
    const key = await revealApiKey(db, userId, id)
    if (!key) return NextResponse.json({ error: "No such key." }, { status: 404 })
    return NextResponse.json({ key }, { headers: { "Cache-Control": "no-store" } })
  }
  return NextResponse.json({ keys: await listApiKeys(db, userId) })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireBrowserUser()
  if (userId instanceof NextResponse) return userId
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing key id." }, { status: 400 })
  const db = await getDBFromContext()
  const reset = await resetApiKey(db, userId, id)
  if (!reset) return NextResponse.json({ error: "No such key." }, { status: 404 })
  return NextResponse.json(reset, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(req: NextRequest) {
  const userId = await requireBrowserUser()
  if (userId instanceof NextResponse) return userId
  const body = (await req.json().catch(() => ({}))) as { name?: unknown }
  const db = await getDBFromContext()
  try {
    return NextResponse.json(await createApiKey(db, userId, body?.name))
  } catch (error) {
    if (error instanceof TooManyApiKeysError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await requireBrowserUser()
  if (userId instanceof NextResponse) return userId
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing key id." }, { status: 400 })
  const db = await getDBFromContext()
  if (!(await revokeApiKey(db, userId, id))) {
    return NextResponse.json({ error: "No such key." }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
