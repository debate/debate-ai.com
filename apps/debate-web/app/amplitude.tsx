"use client"

import { useEffect } from "react"
import { initAll } from "@amplitude/unified"

/**
 * Amplitude starts once, in the browser, before anything else can emit an
 * event. The Analytics project API key is public and ingestion-scoped — it
 * ships in the client bundle by design — so `NEXT_PUBLIC_` is correct here, and
 * being `NEXT_PUBLIC_` means it is inlined at build time: adding it to
 * `.env.local` while the dev server is already running needs a restart.
 *
 * The guard matters because without a key `initAll` fails silently and the
 * first real event looks like an SDK bug rather than missing configuration.
 */
export function Amplitude() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY
    if (!key) {
      console.error(
        "[amplitude] NEXT_PUBLIC_AMPLITUDE_API_KEY is not set — no events will be sent",
      )
      return
    }
    initAll(key, {
      serverZone: "US",
      analytics: { autocapture: true },
      sessionReplay: { sampleRate: 1 },
    })
  }, [])

  return null
}