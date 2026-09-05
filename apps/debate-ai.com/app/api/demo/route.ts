import { NextResponse } from "next/server"
import { DEMO_ACCOUNT } from "debate-round"
import { isDemoAccountEnabled } from "@/lib/demo-account"

/** Whether this deployment offers the shared demo account (see `./login/route.ts`). */
export async function GET() {
  return NextResponse.json({ enabled: isDemoAccountEnabled(), email: DEMO_ACCOUNT.email, name: DEMO_ACCOUNT.name })
}
