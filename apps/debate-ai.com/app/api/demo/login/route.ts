import { NextRequest, NextResponse } from "next/server"
import { getAuth } from "@/lib/auth"
import { DEMO_ACCOUNT } from "debate-round"
import { ensureDemoUser, getDemoAccountPassword, isDemoAccountEnabled, seedDemoAccount } from "@/lib/demo-account"

/**
 * "Try the demo account" — provisions the shared demo user if needed,
 * (re)seeds its sample documents, flows, and shared files, then signs
 * this browser in as it by running better-auth's own email/password
 * sign-in server-side and forwarding the resulting `Set-Cookie` headers.
 * Body: `{ reset?: boolean }` — `reset` wipes the demo account's content
 * back to the seed first. See docs/features/user-library.md.
 */
export async function POST(request: NextRequest) {
  if (!isDemoAccountEnabled()) {
    return NextResponse.json({ error: "The demo account is disabled on this deployment." }, { status: 404 })
  }

  let reset = false
  try {
    const body = (await request.json()) as { reset?: unknown } | null
    reset = body?.reset === true
  } catch {
    // An empty body is fine — plain sign-in.
  }

  try {
    const user = await ensureDemoUser()
    const seeded = await seedDemoAccount(user.id, { reset })

    const auth = await getAuth()
    const { headers } = await auth.api.signInEmail({
      body: { email: DEMO_ACCOUNT.email, password: await getDemoAccountPassword(), rememberMe: true },
      headers: request.headers,
      returnHeaders: true,
    })

    const response = NextResponse.json({ user, seeded, reset })
    const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : []
    if (cookies.length === 0) {
      headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") cookies.push(value)
      })
    }
    for (const cookie of cookies) response.headers.append("set-cookie", cookie)
    return response
  } catch (error) {
    console.error("[demo-account] sign-in failed:", error)
    return NextResponse.json({ error: "Could not sign in to the demo account. Please try again." }, { status: 500 })
  }
}
