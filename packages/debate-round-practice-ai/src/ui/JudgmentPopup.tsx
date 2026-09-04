/**
 * @fileoverview The end-of-round scorecard — the port of the upstream
 * `frontend/src/components/JudgementPopup.tsx`.
 *
 * Both judgment shapes upstream handled are kept: the user-vs-bot rubric
 * this package's backend emits, and the for/against rubric the upstream Go
 * server's human-vs-human rounds emitted, so the component still renders a
 * transcript scored either way.
 *
 * Two upstream details are fixed rather than ported: the "skills to improve"
 * cards pointed at hardcoded `http://localhost:5173/coach/...` URLs, and the
 * "Back to Home" button called react-router's `navigate('/startdebate')`.
 * Both are now props, so the host app supplies its own routes.
 *
 * @module ui/JudgmentPopup
 */

"use client"

import { Button } from "debate-speech-writer/src/ui/primitives/button"
import type { JudgedScore, JudgmentData } from "../backend/types"

type Scored = JudgedScore

/**
 * The rubric this package's backend produces — the same `JudgmentData` the
 * judge prompt asks for, aliased here under the name upstream used.
 */
export type JudgmentDataUserBot = JudgmentData

/** The rubric the upstream human-vs-human rounds produced. */
export type JudgmentDataForAgainst = {
  opening_statement: { for: Scored; against: Scored }
  cross_examination_questions: { for: Scored; against: Scored }
  cross_examination_answers: { for: Scored; against: Scored }
  closing: { for: Scored; against: Scored }
  total: { for: number; against: number }
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string }
}

/**
 * Either rubric. Named `AnyJudgmentData` rather than upstream's
 * `JudgmentData`, which is taken by the backend's user-vs-bot shape.
 */
export type AnyJudgmentData = JudgmentDataUserBot | JudgmentDataForAgainst

export type RatingSummary = {
  for: { rating: number; change: number }
  against: { rating: number; change: number }
}

type DebateSide = "for" | "against"

/** A follow-up drill the scorecard can recommend. */
export interface CoachSkill {
  title: string
  description: string
  /** In-app href. Upstream hardcoded a localhost dev URL here. */
  url: string
}

/**
 * Default recommendations, pointing at debate-ai.com's own coach routes
 * rather than upstream's `localhost:5173` links.
 */
export const DEFAULT_COACH_SKILLS: CoachSkill[] = [
  {
    title: "Strengthen Argument",
    description:
      "Master the art of crafting compelling, persuasive arguments that win debates.",
    url: "/coach",
  },
  {
    title: "Pros and Cons Challenge",
    description:
      "Test your critical thinking by crafting up to 5 pros and cons for engaging debate topics.",
    url: "/drills",
  },
]

const FALLBACK_LOCAL_AVATAR = "https://api.dicebear.com/9.x/big-ears/svg?seed=Felix"
const FALLBACK_OPPONENT_AVATAR = "https://api.dicebear.com/9.x/big-ears/svg?seed=Nolan"

export interface JudgmentPopupProps {
  judgment: AnyJudgmentData
  userAvatar?: string
  botAvatar?: string
  botName?: string
  userStance?: string
  botStance?: string
  botDesc?: string
  forRole?: string
  againstRole?: string
  localRole?: DebateSide | null
  localDisplayName?: string | null
  localAvatarUrl?: string | null
  opponentDisplayName?: string | null
  opponentAvatarUrl?: string | null
  ratingSummary?: RatingSummary | null
  /** Recommendation cards. Defaults to `DEFAULT_COACH_SKILLS`. */
  coachSkills?: CoachSkill[]
  /** "Back to Home" — upstream navigated to `/startdebate`. */
  onHome?: () => void
  onClose: () => void
}

/** One scored cell — a name, a score out of 10, and the judge's reasoning. */
function ScoreCell({ name, score, reason }: { name: string; score: number; reason: string }) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <h4 className="text-lg font-semibold text-foreground">{name}</h4>
      <p className="mt-2 text-xl font-bold text-primary">{score}/10</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reason}</p>
    </div>
  )
}

/** One judged phase — its title and both sides' cells. */
function ScoreSection({
  title,
  player1Name,
  player2Name,
  player1,
  player2,
}: {
  title: string
  player1Name: string
  player2Name: string
  player1: Scored
  player2: Scored
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-md">
      <h3 className="mb-6 text-center text-2xl font-bold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ScoreCell name={player1Name} score={player1.score} reason={player1.reason} />
        <ScoreCell name={player2Name} score={player2.score} reason={player2.reason} />
      </div>
    </div>
  )
}

export function JudgmentPopup({
  judgment,
  userAvatar,
  botAvatar,
  botName,
  botDesc,
  userStance,
  botStance,
  forRole,
  againstRole,
  localRole = null,
  localDisplayName,
  localAvatarUrl,
  opponentDisplayName,
  opponentAvatarUrl,
  ratingSummary,
  coachSkills = DEFAULT_COACH_SKILLS,
  onHome,
  onClose,
}: JudgmentPopupProps) {
  const userName = "You"
  const isUserBotFormat = "user" in judgment.opening_statement

  const resolvedLocalName = localDisplayName || userName
  const resolvedOpponentName = opponentDisplayName || "Opponent"
  const derivedLocalAvatar = localAvatarUrl || FALLBACK_LOCAL_AVATAR
  const derivedOpponentAvatar = opponentAvatarUrl || FALLBACK_OPPONENT_AVATAR

  const resolvedForName = isUserBotFormat
    ? forRole || "For Debater"
    : localRole === "for"
      ? resolvedLocalName
      : localRole === "against"
        ? resolvedOpponentName
        : forRole || "For Debater"

  const resolvedAgainstName = isUserBotFormat
    ? againstRole || "Against Debater"
    : localRole === "against"
      ? resolvedLocalName
      : localRole === "for"
        ? resolvedOpponentName
        : againstRole || "Against Debater"

  const player1Name = isUserBotFormat ? userName : resolvedForName
  const player2Name = isUserBotFormat ? botName || "Bot" : resolvedAgainstName
  const player1Stance = isUserBotFormat ? userStance : "For"
  const player2Stance = isUserBotFormat ? botStance : "Against"

  const player1Avatar =
    (isUserBotFormat
      ? userAvatar
      : localRole === "for"
        ? derivedLocalAvatar
        : localRole === "against"
          ? derivedOpponentAvatar
          : derivedLocalAvatar) || FALLBACK_LOCAL_AVATAR

  const player2Avatar =
    (isUserBotFormat
      ? botAvatar
      : localRole === "against"
        ? derivedLocalAvatar
        : localRole === "for"
          ? derivedOpponentAvatar
          : derivedOpponentAvatar) || FALLBACK_OPPONENT_AVATAR

  const player2Desc = isUserBotFormat ? botDesc || "AI Opponent" : resolvedAgainstName || "Debater"

  const formatChange = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`
  const formatRating = (value: number) => value.toFixed(2)

  const player1RatingSummary = !isUserBotFormat && ratingSummary ? ratingSummary.for : null
  const player2RatingSummary = !isUserBotFormat && ratingSummary ? ratingSummary.against : null

  /**
   * Read one section for one side across both rubric shapes. Ported from
   * upstream's `getScoreAndReason`.
   */
  const getScoreAndReason = (section: string, player: "player1" | "player2"): Scored => {
    if (isUserBotFormat) {
      const data = judgment as JudgmentDataUserBot
      const key = player === "player1" ? "user" : "bot"
      switch (section) {
        case "opening_statement":
          return data.opening_statement[key]
        case "cross_examination":
          return data.cross_examination[key]
        case "answers":
          return data.answers[key]
        case "closing":
          return data.closing[key]
        case "total":
          return { score: data.total[key], reason: "" }
        default:
          return { score: 0, reason: "Data not available" }
      }
    }
    const data = judgment as JudgmentDataForAgainst
    const key = player === "player1" ? "for" : "against"
    switch (section) {
      case "opening_statement":
        return data.opening_statement[key]
      case "cross_examination_questions":
        return data.cross_examination_questions[key]
      case "cross_examination_answers":
        return data.cross_examination_answers[key]
      case "closing":
        return data.closing[key]
      case "total":
        return { score: data.total[key], reason: "" }
      default:
        return { score: 0, reason: "Data not available" }
    }
  }

  /**
   * Pick follow-up drills from the user's weakest phases. Ported from
   * upstream's `recommendSkills`, thresholds and keyword checks intact.
   */
  const recommendSkills = (): CoachSkill[] => {
    if (coachSkills.length < 2) return coachSkills

    const questionsKey = isUserBotFormat ? "cross_examination" : "cross_examination_questions"
    const answersKey = isUserBotFormat ? "answers" : "cross_examination_answers"

    const scores = {
      opening: getScoreAndReason("opening_statement", "player1").score,
      crossQuestions: getScoreAndReason(questionsKey, "player1").score,
      crossAnswers: getScoreAndReason(answersKey, "player1").score,
      closing: getScoreAndReason("closing", "player1").score,
    }
    const reasons = {
      opening: getScoreAndReason("opening_statement", "player1").reason.toLowerCase(),
      crossQuestions: getScoreAndReason(questionsKey, "player1").reason.toLowerCase(),
      crossAnswers: getScoreAndReason(answersKey, "player1").reason.toLowerCase(),
      closing: getScoreAndReason("closing", "player1").reason.toLowerCase(),
    }

    const recommended: CoachSkill[] = []
    const weakWords = ["weak", "unclear", "persuasive"]
    if (
      scores.opening <= 6 ||
      scores.closing <= 6 ||
      weakWords.some((word) => reasons.opening.includes(word)) ||
      weakWords.some((word) => reasons.closing.includes(word))
    ) {
      recommended.push(coachSkills[0])
    }
    if (
      scores.crossQuestions <= 6 ||
      scores.crossAnswers <= 6 ||
      reasons.crossQuestions.includes("relevance") ||
      reasons.crossQuestions.includes("thinking") ||
      reasons.crossAnswers.includes("coherence") ||
      reasons.crossAnswers.includes("evasion")
    ) {
      recommended.push(coachSkills[1])
    }

    if (recommended.length === 0 || recommended.length > 1) return coachSkills
    return recommended
  }

  const recommendedSkills = recommendSkills()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-background p-8 shadow-2xl">
        {/* Both debaters */}
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row">
          {[
            { name: player1Name, stance: player1Stance, avatar: player1Avatar, desc: "Debater" },
            { name: player2Name, stance: player2Stance, avatar: player2Avatar, desc: player2Desc },
          ].map((side) => (
            <div
              key={side.name}
              className="flex w-full items-center space-x-4 rounded-lg bg-muted p-4 shadow-sm sm:w-1/2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={side.avatar}
                alt={side.name}
                className="h-16 w-16 rounded-full border-2 border-primary object-cover"
              />
              <div>
                <h3 className="text-xl font-bold text-foreground">{side.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Stance: <span className="font-semibold text-primary">{side.stance}</span>
                </p>
                <p className="text-xs text-muted-foreground">{side.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scored phases */}
        <div className="space-y-10">
          <ScoreSection
            title="Opening Statement"
            player1Name={player1Name}
            player2Name={player2Name}
            player1={getScoreAndReason("opening_statement", "player1")}
            player2={getScoreAndReason("opening_statement", "player2")}
          />

          {isUserBotFormat ? (
            <>
              <ScoreSection
                title="Cross Examination"
                player1Name={player1Name}
                player2Name={player2Name}
                player1={getScoreAndReason("cross_examination", "player1")}
                player2={getScoreAndReason("cross_examination", "player2")}
              />
              <ScoreSection
                title="Answers to Cross Examination"
                player1Name={player1Name}
                player2Name={player2Name}
                player1={getScoreAndReason("answers", "player1")}
                player2={getScoreAndReason("answers", "player2")}
              />
            </>
          ) : (
            <>
              <ScoreSection
                title="Cross Examination Questions"
                player1Name={player1Name}
                player2Name={player2Name}
                player1={getScoreAndReason("cross_examination_questions", "player1")}
                player2={getScoreAndReason("cross_examination_questions", "player2")}
              />
              <ScoreSection
                title="Cross Examination Answers"
                player1Name={player1Name}
                player2Name={player2Name}
                player1={getScoreAndReason("cross_examination_answers", "player1")}
                player2={getScoreAndReason("cross_examination_answers", "player2")}
              />
            </>
          )}

          <ScoreSection
            title="Closing Statement"
            player1Name={player1Name}
            player2Name={player2Name}
            player1={getScoreAndReason("closing", "player1")}
            player2={getScoreAndReason("closing", "player2")}
          />
        </div>

        {/* Totals */}
        <div className="mt-10 rounded-lg border border-border bg-card p-6 shadow-md">
          <h3 className="mb-6 text-center text-2xl font-bold text-foreground">Total Scores</h3>
          <div className="flex items-center justify-around">
            {[
              { name: player1Name, score: getScoreAndReason("total", "player1").score },
              { name: player2Name, score: getScoreAndReason("total", "player2").score },
            ].map((side) => (
              <div key={side.name} className="text-center">
                <p className="text-4xl font-bold text-primary">{side.score}</p>
                <p className="text-sm text-muted-foreground">/ 40</p>
                <p className="text-lg font-semibold text-foreground">{side.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Rating impact — only for the for/against (rated) format */}
        {!isUserBotFormat && player1RatingSummary && player2RatingSummary && (
          <div className="mt-10 rounded-lg border border-border bg-card p-6 shadow-md">
            <h3 className="mb-6 text-center text-2xl font-bold text-foreground">Rating Impact</h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[
                { name: player1Name, stance: player1Stance, summary: player1RatingSummary },
                { name: player2Name, stance: player2Stance, summary: player2RatingSummary },
              ].map((side) => (
                <div key={side.name} className="rounded-lg border border-border bg-muted p-4">
                  <h4 className="mb-2 text-lg font-semibold text-foreground">
                    {side.name} ({side.stance})
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    New Rating:{" "}
                    <span className="font-semibold text-foreground">
                      {formatRating(side.summary.rating)}
                    </span>
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      side.summary.change >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    Change: {formatChange(side.summary.change)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verdict */}
        <div className="mt-10 rounded-lg bg-primary p-6 text-center text-primary-foreground shadow-md">
          <h3 className="text-2xl font-bold">Verdict</h3>
          <p className="mt-4 text-3xl font-bold">{judgment.verdict.winner} Wins!</p>
          <p className="mt-3 text-lg">{judgment.verdict.congratulations}</p>
          <p className="mt-2 leading-relaxed">{judgment.verdict.opponent_analysis}</p>
        </div>

        {/* Follow-up drills */}
        <div className="mt-10 rounded-lg border border-border bg-card p-6 shadow-md">
          <h3 className="mb-6 text-center text-2xl font-bold text-foreground">
            Skills to Improve with Debate Coach
          </h3>
          <p className="mb-6 text-center text-muted-foreground">
            Based on your performance, we recommend practicing these skills to enhance your debating
            abilities:
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {recommendedSkills.map((skill) => (
              <div key={skill.title} className="rounded-lg bg-muted p-4 shadow-sm">
                <h4 className="text-lg font-semibold text-foreground">{skill.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {skill.description}
                </p>
                <a
                  href={skill.url}
                  className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Start Now
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 text-center">
          {onHome && (
            <Button onClick={onHome} className="mr-4 rounded-full px-6 py-3 text-lg font-semibold">
              Back to Home
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="secondary"
            className="rounded-full px-6 py-3 text-lg font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export default JudgmentPopup
