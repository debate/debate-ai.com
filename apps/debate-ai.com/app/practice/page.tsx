import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

/**
 * The Practice Round Simulator's old address, now merged into Practice vs AI
 * at `/practice/versus-ai`.
 *
 * That page's setup asks for a difficulty, a topic and an opponent, has the
 * opponent find cards and cases and summarize both sides, then runs the
 * timed round; the simulator's saved rounds, judge paradigms, replays and
 * team matchups sit in a section below it. `/practice` is linked from the
 * sidebar, the coach hub and saved-record links, so it stays live as a
 * permanent redirect rather than 404ing.
 */

export const metadata: Metadata = {
  title: "Practice vs AI",
  description: "Pick a difficulty, topic and opponent; the AI preps cards and cases, then debates you in a timed round",
  alternates: { canonical: "/practice/versus-ai" },
}

export default function LegacyPracticeRoundSimulatorPage() {
  permanentRedirect("/practice/versus-ai")
}
