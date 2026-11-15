/**
 * @fileoverview `/videos/live/<id>`: one live round stream on its own page —
 * the link a debater shares so people can tune in, and where the replay stays
 * after the round.
 *
 * @module components/videos/live/LiveRoundPage
 */

"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { LiveRadioPanel } from "./LiveRadioPanel"

export function LiveRoundPage({ streamId }: { streamId: string }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-4 bg-background px-4 py-6">
      <Link href="/videos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Videos
      </Link>
      <LiveRadioPanel streamId={streamId} />
      <p className="text-xs text-muted-foreground">
        Round radio plays each speaker&apos;s voice during their speeches, one speech after another. Prep time and the gaps
        between speeches are left out. A live stream starts you at the beginning of the speech being given, a few seconds
        behind live.
      </p>
    </main>
  )
}
