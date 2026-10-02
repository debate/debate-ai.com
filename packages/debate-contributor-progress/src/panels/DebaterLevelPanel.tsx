"use client"

/**
 * @fileoverview Debater Levels panel — the UI over `lib/debater-levels.ts`
 * and `state/debaterLevel.ts`. Shows the debater's level, rank title and XP
 * bar, today's daily challenges ("Cut 5 cards", "Redo a rebuttal", …),
 * lifetime milestones, the five judge-given awards (`JudgeAwardShowcase`),
 * and a recent-XP log, plus a level-up banner. Every challenge and milestone
 * shows its badge art.
 *
 * Most XP arrives automatically from the tools that dispatch
 * `DEBATER_ACTIVITY_EVENT` (saving a quick card, finishing a practice round
 * vs AI, marking a drill practiced). Practice that happens off-app — like
 * redoing a rebuttal out loud — is logged with the "Log practice" buttons.
 *
 * An award that crosses a level boundary opens {@link DebaterLevelUpOverlay}
 * — the animated level-up cutscene — over the panel until it plays out or is
 * dismissed.
 *
 * Refreshes on every award in this tab (`DEBATER_XP_AWARDED_EVENT`) and in
 * other tabs (the `storage` event).
 */

import { useEffect, useState } from "react"
import { Button } from "@debate/research-evidence/src/ui/primitives/button"
import {
  MeterBar,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
} from "@debate/research-evidence/src/ui/panels/panel-shell"
import {
  ACTIVITY_XP,
  computeLevelProgress,
  DEBATER_ACTIVITY_KINDS,
  DEBATER_ACTIVITY_LABELS,
  getChallengeProgress,
  utcDayKeyFor,
  type DebaterActivityResult,
  type DebaterChallengeProgress,
  type DebaterLevelState,
} from "../lib/debater-levels"
import {
  DEBATER_LEVEL_STORAGE_KEY,
  DEBATER_XP_AWARDED_EVENT,
  loadDebaterLevelState,
  recordDebaterActivity,
  resetDebaterLevelState,
} from "../state/debaterLevel"
import { DebaterLevelUpOverlay } from "./DebaterLevelUpOverlay"
import { JudgeAwardShowcase } from "./JudgeAwardsSection"
import { TiltBadge } from "./TiltBadge"

const CHALLENGE_BADGES: Record<string, string> = {
  "daily-cut-5-cards": "https://i.imgur.com/VbNI6bB.png",
  "daily-redo-rebuttal": "https://i.imgur.com/d3YazEe.png",
  "daily-drills-3": "https://i.imgur.com/mRbAE4b.png",
  "daily-practice-round": "https://i.imgur.com/TkYzW2l.png",
  "milestone-first-card": "https://i.imgur.com/BgMCyP5.png",
  "milestone-cards-50": "https://i.imgur.com/eJ9jtza.png",
  "milestone-cards-250": "https://i.imgur.com/grVj3kk.png",
  "milestone-rebuttals-10": "https://i.imgur.com/UT5V0AZ.png",
  "milestone-speeches-25": "https://i.imgur.com/odEL3ih.png",
  "milestone-first-win": "https://i.imgur.com/S9QAmli.png",
  "milestone-wins-10": "https://i.imgur.com/e2dmeOA.png",
}

function ChallengeRow({ progress }: { progress: DebaterChallengeProgress }) {
  const { challenge, current, isComplete } = progress
  const badgeUrl = CHALLENGE_BADGES[challenge.id]
  return (
    <li className="flex flex-col gap-1 rounded-lg border p-3">
      {badgeUrl && (
        <div className="flex justify-center">
          <TiltBadge src={badgeUrl} alt={challenge.title} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{challenge.title}</span>
        {isComplete ? <Pill tone="positive">+{challenge.xpReward} XP earned</Pill> : <Pill tone="info">+{challenge.xpReward} XP</Pill>}
      </div>
      <p className="text-muted-foreground text-xs">{challenge.description}</p>
      <MeterBar value={current} max={challenge.target} caption={`${current}/${challenge.target}`} tone={isComplete ? "positive" : "info"} />
    </li>
  )
}

export function DebaterLevelPanel() {
  const [state, setState] = useState<DebaterLevelState | null>(null)
  const [levelUp, setLevelUp] = useState<DebaterActivityResult | null>(null)

  useEffect(() => {
    setState(loadDebaterLevelState())
    const onAward = (event: Event) => {
      const result = (event as CustomEvent<DebaterActivityResult>).detail
      setState(result.state)
      if (result.leveledUp) setLevelUp(result)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEBATER_LEVEL_STORAGE_KEY) setState(loadDebaterLevelState())
    }
    window.addEventListener(DEBATER_XP_AWARDED_EVENT, onAward)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(DEBATER_XP_AWARDED_EVENT, onAward)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  if (state === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading your level…</div>
  }

  const progress = computeLevelProgress(state.totalXp)
  const challenges = getChallengeProgress(state, utcDayKeyFor(Date.now()))
  const daily = challenges.filter((entry) => entry.challenge.repeat === "daily")
  const milestones = challenges.filter((entry) => entry.challenge.repeat === "once")
  const dailyDone = daily.filter((entry) => entry.isComplete).length
  const milestonesDone = milestones.filter((entry) => entry.isComplete).length

  return (
    <PanelShell
      title="Debater Level"
      description="Earn XP for every card you cut, rebuttal you redo, and round you practice — and level up."
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("Reset your level and XP to zero?")) setState(resetDebaterLevelState())
          }}
        >
          Reset progress
        </Button>
      }
    >
      {levelUp ? (
        <DebaterLevelUpOverlay
          open
          previousLevel={levelUp.previousLevel}
          progress={computeLevelProgress(levelUp.state.totalXp)}
          xpGained={levelUp.xpGained}
          onDismiss={() => setLevelUp(null)}
        />
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{progress.title}</div>
            <div className="text-3xl font-bold tabular-nums">Level {progress.level}</div>
          </div>
          <div className="text-muted-foreground text-sm tabular-nums">{progress.totalXp.toLocaleString()} XP total</div>
        </div>
        <MeterBar
          value={progress.xpIntoLevel}
          max={progress.isMaxLevel ? 1 : progress.xpForNextLevel}
          label={progress.isMaxLevel ? "Max level reached" : `Progress to level ${progress.level + 1}`}
          caption={progress.isMaxLevel ? undefined : `${progress.xpIntoLevel}/${progress.xpForNextLevel} XP`}
          tone="warning"
        />
      </div>

      <StatGrid columns={4}>
        <StatTile label="Cards cut" value={state.lifetimeCounts.card_cut ?? 0} />
        <StatTile label="Rebuttals redone" value={state.lifetimeCounts.rebuttal_redo ?? 0} />
        <StatTile label="Daily challenges" value={`${dailyDone}/${daily.length}`} hint="completed today" tone={dailyDone === daily.length ? "positive" : "neutral"} />
        <StatTile label="Milestones" value={`${milestonesDone}/${milestones.length}`} />
      </StatGrid>

      <PanelSection title="Log practice" description="Practiced off-app? Log it to earn the XP.">
        <div className="flex flex-wrap gap-2">
          {DEBATER_ACTIVITY_KINDS.map((kind) => (
            <Button key={kind} variant="outline" size="sm" onClick={() => recordDebaterActivity(kind)}>
              {DEBATER_ACTIVITY_LABELS[kind]} (+{ACTIVITY_XP[kind]})
            </Button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Daily challenges" description="Reset every day (UTC).">
        <ul className="grid gap-2 sm:grid-cols-2">
          {daily.map((entry) => (
            <ChallengeRow key={entry.challenge.id} progress={entry} />
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Milestones" description="One-time bonuses for lifetime totals.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {milestones.map((entry) => (
            <ChallengeRow key={entry.challenge.id} progress={entry} />
          ))}
        </ul>
      </PanelSection>

      <JudgeAwardShowcase />

      <PanelSection title="Recent XP">
        {state.recentXp.length === 0 ? (
          <p className="text-muted-foreground text-sm">No XP yet — cut a card or log some practice to get started.</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {state.recentXp.map((event, index) => (
              <li key={`${event.atMs}-${event.source}-${index}`} className="flex items-center justify-between gap-2 py-1.5">
                <span>{event.label}</span>
                <span className="text-muted-foreground flex items-center gap-3 tabular-nums">
                  <span>{new Date(event.atMs).toLocaleString()}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">+{event.xp} XP</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>
    </PanelShell>
  )
}
