import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"

/**
 * ICE servers for the round webcam rooms (packages/debate-round/src/webcam).
 *
 * Browsers connect peer-to-peer when their networks allow it (STUN); behind
 * restrictive NATs, corporate networks or some mobile carriers they need a
 * TURN relay. When `CF_TURN_KEY_ID` and `CF_TURN_KEY_API_TOKEN` are set, this
 * mints short-lived Cloudflare TURN credentials for the signed-in user;
 * otherwise `WEBRTC_ICE_SERVERS` (a JSON array of RTCIceServer) is used, and
 * failing that Cloudflare's public STUN server alone.
 */

const STUN_ONLY = [{ urls: "stun:stun.cloudflare.com:3478" }]
const TURN_TTL_SECONDS = 4 * 60 * 60

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ iceServers: STUN_ONLY })

  const turnKeyId = getEnv("CF_TURN_KEY_ID")
  const turnToken = getEnv("CF_TURN_KEY_API_TOKEN")
  if (turnKeyId && turnToken) {
    try {
      const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${turnToken}`, "content-type": "application/json" },
          body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
        },
      )
      if (res.ok) {
        const body = (await res.json()) as { iceServers?: unknown }
        if (body.iceServers) {
          return NextResponse.json(
            { iceServers: Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers] },
            { headers: { "cache-control": "private, no-store" } },
          )
        }
      }
    } catch {
      // Fall through to the static configuration.
    }
  }

  const configured = getEnv("WEBRTC_ICE_SERVERS")
  if (configured) {
    try {
      const parsed = JSON.parse(configured)
      if (Array.isArray(parsed) && parsed.length) {
        return NextResponse.json({ iceServers: parsed }, { headers: { "cache-control": "private, no-store" } })
      }
    } catch {
      // Malformed — ignore.
    }
  }
  return NextResponse.json({ iceServers: STUN_ONLY })
}
