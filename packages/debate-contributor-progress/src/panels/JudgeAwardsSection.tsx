"use client"

/**
 * @fileoverview Judge awards on a debater's page — the UI over
 * `lib/judge-awards.ts` and `state/judgeAwards.ts`.
 *
 * `JudgeAwardsSection` sits on the contributor profile
 * (`/cards/leaderboard/{debaterId}`): every award the debater has received,
 * each a large badge with the giving judge's name underneath, plus a
 * **Give an award** form for judges. The form enforces the
 * once-per-judge-per-tournament rule and shows the store's error when a
 * judge tries to give the same award twice at one tournament.
 *
 * `JudgeAwardShowcase` lists all five awards with their descriptions for the
 * Debater Level page, which has no debater identity to look awards up by.
 *
 * @module panels/JudgeAwardsSection
 */

import { useEffect, useState } from "react"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import { PanelSection } from "debate-research-evidence/src/ui/panels/panel-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-research-evidence/src/ui/primitives/select"
import { JUDGE_AWARD_BY_KIND, JUDGE_AWARDS, type JudgeAward, type JudgeAwardKind } from "../lib/judge-awards"
import {
  deleteJudgeAward,
  giveJudgeAward,
  JUDGE_AWARDS_CHANGED_EVENT,
  JUDGE_AWARDS_STORAGE_KEY,
  listJudgeAwardsForDebater,
} from "../state/judgeAwards"
import { TiltBadge } from "./TiltBadge"

function EarnedJudgeAward({ award, onRemove }: { award: JudgeAward; onRemove: () => void }) {
  const definition = JUDGE_AWARD_BY_KIND[award.kind]
  return (
    <li className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
      <TiltBadge src={definition.badgeUrl} alt={definition.title} />
      <span className="font-medium">{definition.title}</span>
      <span className="text-sm">Awarded by {award.judgeName}</span>
      <span className="text-muted-foreground text-xs">
        {award.tournament} · {new Date(award.awardedAt).toLocaleDateString()}
      </span>
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onRemove}>
        Remove
      </Button>
    </li>
  )
}

function GiveJudgeAwardForm({ debaterId }: { debaterId: string }) {
  const [kind, setKind] = useState<JudgeAwardKind>(JUDGE_AWARDS[0].kind)
  const [judgeName, setJudgeName] = useState("")
  const [tournament, setTournament] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [given, setGiven] = useState<string | null>(null)

  const submit = () => {
    try {
      const award = giveJudgeAward({ kind, debaterId, judgeName, tournament })
      setError(null)
      setGiven(`${JUDGE_AWARD_BY_KIND[award.kind].title} given to ${award.debaterId}.`)
    } catch (err) {
      setGiven(null)
      setError(err instanceof Error ? err.message : "Couldn't give that award.")
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 text-sm font-medium text-foreground">Judging? Give an award</div>
      <p className="text-muted-foreground mb-3 text-xs">Each judge can give each award once per tournament.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,200px)_minmax(0,180px)_minmax(0,180px)_auto] sm:items-end">
        <div>
          <Label htmlFor="judge-award-kind" className="text-xs">
            Award
          </Label>
          <Select value={kind} onValueChange={(value) => setKind(value as JudgeAwardKind)}>
            <SelectTrigger id="judge-award-kind" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JUDGE_AWARDS.map((award) => (
                <SelectItem key={award.kind} value={award.kind}>
                  {award.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="judge-award-judge" className="text-xs">
            Judge name
          </Label>
          <Input id="judge-award-judge" value={judgeName} onChange={(e) => setJudgeName(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label htmlFor="judge-award-tournament" className="text-xs">
            Tournament
          </Label>
          <Input
            id="judge-award-tournament"
            value={tournament}
            onChange={(e) => setTournament(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <Button size="sm" onClick={submit} disabled={!judgeName.trim() || !tournament.trim()}>
          Give award
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {given && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{given}</p>}
    </div>
  )
}

/** A debater's judge awards, plus the form judges give them with. */
export function JudgeAwardsSection({ debaterId }: { debaterId: string }) {
  const [awards, setAwards] = useState<JudgeAward[]>([])

  useEffect(() => {
    const refresh = () => setAwards(listJudgeAwardsForDebater(debaterId))
    const onStorage = (event: StorageEvent) => {
      if (event.key === JUDGE_AWARDS_STORAGE_KEY) refresh()
    }
    refresh()
    window.addEventListener(JUDGE_AWARDS_CHANGED_EVENT, refresh)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(JUDGE_AWARDS_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", onStorage)
    }
  }, [debaterId])

  return (
    <PanelSection title="Judge awards" description="Given by judges at tournaments — they can't be earned with XP.">
      {awards.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {awards.map((award) => (
            <EarnedJudgeAward
              key={award.id}
              award={award}
              onRemove={() => {
                if (window.confirm(`Remove ${award.judgeName}'s ${JUDGE_AWARD_BY_KIND[award.kind].title} award?`)) {
                  deleteJudgeAward(award.id)
                }
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No judge awards yet.</p>
      )}
      <GiveJudgeAwardForm debaterId={debaterId} />
    </PanelSection>
  )
}

/** All five judge awards and what each one recognizes. */
export function JudgeAwardShowcase() {
  return (
    <PanelSection
      title="Judge awards"
      description="Only a judge can give these, once per award per tournament. They appear on your debater page with the judge's name."
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {JUDGE_AWARDS.map((award) => (
          <li key={award.kind} className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
            <TiltBadge src={award.badgeUrl} alt={award.title} />
            <span className="font-medium">{award.title}</span>
            <p className="text-muted-foreground text-xs">{award.description}</p>
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}
