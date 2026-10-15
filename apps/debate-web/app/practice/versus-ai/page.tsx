import type { Metadata } from "next"
import Image from "next/image"
import { getSession } from "@/lib/auth/session"
import { ToolPage, ToolPageHeader } from "@debate/webview/components/tools/ToolPageHeader"
import { PracticeVsAiSections } from "@debate/webview/components/practice/PracticeVsAiSections"

export const metadata: Metadata = {
  title: "Practice vs AI",
  description:
    "Pick a difficulty, topic and opponent; the AI finds cards and cases, summarizes both sides, then debates you in a timed round",
}

/** Screenshot of the tool, shown as the page banner (700x263). */
const BANNER_SRC = "https://i.imgur.com/2awjrUp.png"
const BANNER_ALT =
  "Practice vs AI: pick an opponent, set the topic and clocks, debate a timed round, and get an AI scorecard"

/**
 * Practice vs AI, merged with the Practice Round Simulator (whose old
 * `/practice` address redirects here).
 *
 * Setup is three steps: difficulty, topic and side, opponent. The opponent
 * then preps (cards and caselist outlines found for the topic, summarized
 * into each side's arguments) before the timed round and AI scorecard. The
 * simulator's saved rounds, judge paradigms, replays and team matchups
 * follow in a collapsed section.
 *
 * The screens come from `debate-practice-vs-ai` and `debate-practice-rounds`,
 * composed by `debate-webview`'s `PracticeVsAiSections`; the round runs against
 * this app's `/api/vsbot/*` routes. The session user is passed down so the
 * round's resume key is per-account and the scorecard shows the right name
 * and avatar.
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
      <PracticeVsAiSections
        userId={session?.user?.id}
        userDisplayName={session?.user?.name ?? undefined}
        userAvatar={session?.user?.image ?? undefined}
      />
    </ToolPage>
  )
}
