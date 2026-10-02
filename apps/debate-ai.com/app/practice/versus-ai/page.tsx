import type { Metadata } from "next"
import Image from "next/image"
import { Suspense } from "react"
import { DebatePracticeVsAi } from "@debate/practice-vs-ai"
import { getSession } from "@/lib/auth/session"
import { ToolPage, ToolPageHeader } from "@debate/webview/components/tools/ToolPageHeader"

export const metadata: Metadata = {
  title: "Practice vs AI",
  description: "Practice a full round against an AI opponent, format and side of your choice",
}

/** Screenshot of the tool, shown as the page banner (700x263). */
const BANNER_SRC = "https://i.imgur.com/2awjrUp.png"
const BANNER_ALT =
  "Practice vs AI: pick an opponent, set the topic and clocks, debate a timed round, and get an AI scorecard"

/**
 * Practice vs AI — pick an opponent persona, set the topic, stance and phase
 * clocks, then debate a full timed round and get an AI scorecard.
 *
 * The screens come from `debate-practice-vs-ai`, ported from the upstream
 * Vite/React client; the round itself runs against this app's
 * `/api/vsbot/*` routes, which wrap that same package's ported Go backend.
 * The session user is passed down so the round's resume key is per-account
 * and the scorecard shows the right name and avatar.
 */
export default async function VersusAiPage() {
  const session = await getSession()

  return (
    <ToolPage>
      <ToolPageHeader href="/practice/versus-ai" backHref="/debate" backLabel="round workspace" guide="practice-tools" />
      <Image
        src={BANNER_SRC}
        alt={BANNER_ALT}
        width={700}
        height={263}
        sizes="(max-width: 768px) 100vw, 700px"
        className="w-full max-w-3xl rounded-lg border border-border"
      />
      <Suspense>
        <DebatePracticeVsAi
          userId={session?.user?.id}
          userDisplayName={session?.user?.name}
          userAvatar={session?.user?.image}
        />
      </Suspense>
    </ToolPage>
  )
}
