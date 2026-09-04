/**
 * @fileoverview Top Contributor Awards panel — the UI follow-up named as
 * "(c) an awards UI in `debate-card-search` that renders
 * `buildAwardsAnnouncementText`" under the "🏆 Top Contributor Awards" bullet
 * in TODO.md's Research Crowdsourcing Organizer Features list.
 *
 * Reads every persisted contribution via `state/contributions.ts`'s
 * `buildTopContributorAwardsFromStore` (itself a thin composition of
 * `contributor-awards.ts`'s pure `buildTopContributorAwards` against the
 * persisted store) and renders one card per category winner — reusing the
 * existing per-category selection/scoring directly rather than introducing
 * new logic here.
 *
 * Also closes follow-up (b), "a scheduled job that periodically calls
 * `buildTopContributorAwards` and persists/announces the winners" — this
 * repo has no scheduled-job infrastructure, so (mirroring
 * `state/dailyBestCardAnnouncements.ts`'s identical "Daily Best Card
 * Challenge" pattern) an **Announce today's awards** action freezes the
 * current standings for the day via `state/contributorAwardAnnouncements.ts`.
 * Once a day is announced, the panel shows that frozen snapshot instead of
 * the live standings for the rest of the day.
 *
 * Also closes the bullet's own next-named follow-up, an "awards history /
 * hall-of-fame page": the existing "Announced history" list already shows
 * every past day chronologically, but not who has actually won the most
 * overall, so a new **Hall of Fame** section aggregates every announced
 * day's awards into one all-time ranking via
 * `contributor-awards.ts#buildContributorAwardsHallOfFame`, rendered above
 * the chronological history once at least one day has been announced.
 *
 * Also closes that bullet's next-named follow-up after that, "a 'nominate a
 * peer' action": a **Nominate a peer** form lets any visitor nominate
 * another contributor for one of the six award categories with an optional
 * short note, persisted via `state/contributorAwardNominations.ts`. Each
 * live award card shows that category's top nominee(s)
 * (`contributor-awards.ts#tallyNominationsByKind`), and a "Recent
 * nominations" list below the form shows every submitted nomination,
 * newest first, each deletable — mirroring `DailyBestCardPanel`'s comment
 * thread's unrestricted delete convention (this repo has no reviewer-
 * identity system to gate deletion by).
 *
 * Also closes that bullet's next-named follow-up after that, "per-nomination
 * 'seconding'/upvoting instead of only a raw count": each row in "Recent
 * nominations" has a **👍 Second** action next to Delete, backed by
 * `state/contributorAwardNominations.ts#secondPeerNomination` — support is
 * typed once into a shared "Seconding as" box above the list rather than
 * re-prompting per row. A category's top-nominee chips on the live award
 * cards above now rank and display by total support (nominations plus
 * seconds) via `contributor-awards.ts#tallyNominationsByKind`'s updated
 * `totalSupport`, not raw nomination count alone.
 *
 * @module panels/ContributorAwardsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Award } from "lucide-react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select"
import { Textarea } from "../ui/primitives/textarea"
import {
  announceContributorAwards,
  buildPersistedTopContributorAwards,
  getAnnouncedContributorAwards,
  listAnnouncedContributorAwards,
  type AnnouncedContributorAwards,
} from "../state/contributorAwardAnnouncements"
import { isContributorAwardsLiveUpdateStorageEvent } from "../state/live-update"
import {
  AWARD_KIND_ORDER,
  DEFAULT_AWARD_CATEGORY_LABELS,
  buildContributorAwardsHallOfFame,
  canNominatePeer,
  canSecondNomination,
  tallyNominationsByKind,
  type ContributorAward,
  type HallOfFameEntry,
  type PeerNomination,
} from "../lib/contributor-awards"
import {
  MAX_NOMINATION_NOTE_LENGTH,
  deletePeerNomination,
  listAllPeerNominations,
  secondPeerNomination,
  submitPeerNomination,
} from "../state/contributorAwardNominations"
import type { ContributionKind } from "../lib/community-rating"

/** Renders one category winner card, plus that category's top peer nominee(s) if any exist. */
function AwardCard({
  award,
  topNominees,
}: {
  award: ContributorAward
  topNominees?: { nomineeId: string; count: number; secondCount: number; totalSupport: number }[]
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Award className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{award.label}</div>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary" className="truncate">
            {award.contributorId}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {award.contributionCount} contribution{award.contributionCount === 1 ? "" : "s"} ·{" "}
          {award.totalHelpfulnessScore} pts
        </div>
        {topNominees && topNominees.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <span>🗳️ Nominated:</span>
            {topNominees.slice(0, 3).map((tally) => (
              <span key={tally.nomineeId} className="rounded bg-muted px-1.5 py-0.5">
                {tally.nomineeId} ×{tally.totalSupport}
                {tally.secondCount > 0 && ` (${tally.secondCount} second${tally.secondCount === 1 ? "" : "s"})`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Renders one Hall of Fame row: a contributor's all-time win total plus a per-category breakdown. */
function HallOfFameRow({ entry, rank }: { entry: HallOfFameEntry; rank: number }) {
  const kindEntries = Object.entries(entry.winsByKind) as [ContributorAward["kind"], number][]
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">#{rank}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="truncate">
            {entry.contributorId}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {entry.totalWins} win{entry.totalWins === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {kindEntries.map(([kind, count]) => (
            <span
              key={kind}
              className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {DEFAULT_AWARD_CATEGORY_LABELS[kind]} ×{count}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Renders one previously announced day's frozen award standings. */
function AnnouncementGroup({ announcement }: { announcement: AnnouncedContributorAwards }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {announcement.dayKey}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {announcement.awards.map((award) => (
          <AwardCard key={award.kind} award={award} />
        ))}
      </div>
    </div>
  )
}

/** A "Nominate a peer" form's draft state. */
type NominationDraft = { kind: ContributionKind; nomineeId: string; nominatorId: string; note: string }

const EMPTY_NOMINATION_DRAFT: NominationDraft = {
  kind: "card",
  nomineeId: "",
  nominatorId: "",
  note: "",
}

/** Renders the "Nominate a peer" form: category select, nominee, your name, optional note. */
function NominationForm({
  draft,
  onDraftChange,
  onSubmit,
}: {
  draft: NominationDraft
  onDraftChange: (patch: Partial<NominationDraft>) => void
  onSubmit: () => void
}) {
  const valid = canNominatePeer(draft.nominatorId, draft.nomineeId)
  const showError = draft.nominatorId.trim().length > 0 && draft.nomineeId.trim().length > 0 && !valid

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium text-foreground">Nominate a peer</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,160px)_minmax(0,160px)_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="nomination-kind" className="text-xs">
            Category
          </Label>
          <Select value={draft.kind} onValueChange={(value) => onDraftChange({ kind: value as ContributionKind })}>
            <SelectTrigger id="nomination-kind" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AWARD_KIND_ORDER.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {DEFAULT_AWARD_CATEGORY_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="nomination-nominee" className="text-xs">
            Nominee
          </Label>
          <Input
            id="nomination-nominee"
            value={draft.nomineeId}
            onChange={(e) => onDraftChange({ nomineeId: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor="nomination-nominator" className="text-xs">
            Your name
          </Label>
          <Input
            id="nomination-nominator"
            value={draft.nominatorId}
            onChange={(e) => onDraftChange({ nominatorId: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor="nomination-note" className="text-xs">
            Note (optional)
          </Label>
          <Textarea
            id="nomination-note"
            value={draft.note}
            onChange={(e) => onDraftChange({ note: e.target.value })}
            maxLength={MAX_NOMINATION_NOTE_LENGTH}
            rows={1}
            className="min-h-8 text-xs"
          />
        </div>
        <Button size="sm" onClick={onSubmit} disabled={!valid}>
          Nominate
        </Button>
      </div>
      {showError && (
        <p className="mt-2 text-xs text-destructive">
          A nominee can't be the same as the nominator — enter a peer's name instead.
        </p>
      )}
    </div>
  )
}

/**
 * Renders every submitted nomination, newest first, each with a Second
 * (upvote) and a Delete action. `seconderId` is the shared "Seconding as"
 * name typed above the list; the Second button is disabled per-row via
 * `canSecondNomination` (self-nominee/nominator, or already seconded).
 */
function NominationList({
  nominations,
  seconderId,
  onSecond,
  onDelete,
}: {
  nominations: PeerNomination[]
  seconderId: string
  onSecond: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (nominations.length === 0) {
    return <p className="text-sm text-muted-foreground">No nominations yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {nominations.map((nomination) => {
        const secondCount = nomination.seconderIds?.length ?? 0
        const canSecond = canSecondNomination(nomination, seconderId)
        return (
          <div key={nomination.id} className="rounded-md bg-muted/50 p-2 text-xs">
            <div className="mb-0.5 flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">
                {DEFAULT_AWARD_CATEGORY_LABELS[nomination.kind]}: {nomination.nomineeId}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-auto px-1.5 py-0.5 text-[11px]"
                  onClick={() => onSecond(nomination.id)}
                  disabled={!canSecond}
                >
                  👍 Second{secondCount > 0 ? ` (${secondCount})` : ""}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-auto px-1.5 py-0.5 text-[11px]"
                  onClick={() => onDelete(nomination.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground">Nominated by {nomination.nominatorId}</p>
            {nomination.note && <p className="mt-0.5 text-muted-foreground">"{nomination.note}"</p>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Renders the Top Contributor Awards: one category winner per
 * `ContributionKind` present among persisted contributions, ranked by total
 * helpfulness score within that category. An **Announce today's awards**
 * action freezes the current UTC day's standings; once announced, the panel
 * shows that frozen result instead of the live standings for the rest of the
 * day, plus the history of every previously announced day.
 *
 * Reads localStorage on mount, then live-updates when another same-origin
 * tab submits a contribution or announces awards (a `storage` event never
 * fires in the tab that made the write itself, only in others — see
 * `state/live-update.ts#isContributorAwardsLiveUpdateStorageEvent`). Renders
 * a loading state during SSR/hydration rather than throwing.
 */
export function ContributorAwardsPanel() {
  const [live, setLive] = useState<ContributorAward[] | null>(null)
  const [announcedToday, setAnnouncedToday] = useState<AnnouncedContributorAwards | undefined>(undefined)
  const [history, setHistory] = useState<AnnouncedContributorAwards[]>([])
  const [nominations, setNominations] = useState<PeerNomination[]>([])
  const [nominationDraft, setNominationDraft] = useState<NominationDraft>(EMPTY_NOMINATION_DRAFT)
  const [nominationError, setNominationError] = useState<string | null>(null)
  const [seconderId, setSeconderId] = useState("")
  const [secondError, setSecondError] = useState<string | null>(null)

  const refresh = () => {
    const now = Date.now()
    setLive(buildPersistedTopContributorAwards())
    setAnnouncedToday(getAnnouncedContributorAwards(new Date(now).toISOString().slice(0, 10)))
    setHistory(listAnnouncedContributorAwards())
    setNominations(listAllPeerNominations())
  }

  useEffect(() => {
    refresh()
  }, [])

  /**
   * Live-update the displayed winners/history when another browser tab
   * submits a contribution or announces awards. Same-tab changes already
   * refresh via `handleAnnounce` below.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isContributorAwardsLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleAnnounce = () => {
    announceContributorAwards(Date.now())
    refresh()
  }

  const handleNominationSubmit = () => {
    try {
      submitPeerNomination({
        kind: nominationDraft.kind,
        nomineeId: nominationDraft.nomineeId,
        nominatorId: nominationDraft.nominatorId,
        note: nominationDraft.note,
      })
      setNominationError(null)
      setNominationDraft({ ...EMPTY_NOMINATION_DRAFT, nominatorId: nominationDraft.nominatorId })
      refresh()
    } catch (error) {
      setNominationError(error instanceof Error ? error.message : "Couldn't submit that nomination.")
    }
  }

  const handleNominationDelete = (id: string) => {
    deletePeerNomination(id)
    refresh()
  }

  const handleNominationSecond = (id: string) => {
    try {
      secondPeerNomination(id, seconderId)
      setSecondError(null)
      refresh()
    } catch (error) {
      setSecondError(error instanceof Error ? error.message : "Couldn't second that nomination.")
    }
  }

  if (live === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading awards…</div>
  }

  const awardsToShow = announcedToday?.awards ?? live
  const pastAnnouncements = history.filter((announcement) => announcement.dayKey !== announcedToday?.dayKey)
  const hallOfFame = buildContributorAwardsHallOfFame(history.flatMap((announcement) => announcement.awards))

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Top Contributor Awards</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Current category winners, ranked by total helpfulness score within each contribution kind.
      </p>

      {awardsToShow.length === 0 ? (
        <div className="mb-6 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No awards yet. Categories fill in as contributors submit cards, summaries, highlights,
          annotations, original arguments, and refutations.
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {awardsToShow.map((award) => (
            <AwardCard key={award.kind} award={award} topNominees={tallyNominationsByKind(nominations, award.kind)} />
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3 text-xs text-muted-foreground">
        {announcedToday ? (
          <span>Today's awards are announced and frozen.</span>
        ) : (
          <>
            <span>Not yet announced today.</span>
            <Button size="sm" onClick={handleAnnounce} disabled={live.length === 0}>
              Announce today's awards
            </Button>
          </>
        )}
      </div>

      {hallOfFame.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-sm font-medium text-foreground">🏅 Hall of Fame</div>
          <p className="mb-2 text-xs text-muted-foreground">
            All-time win totals across every announced day, ranked highest first.
          </p>
          <div className="flex flex-col gap-2">
            {hallOfFame.map((entry, index) => (
              <HallOfFameRow key={entry.contributorId} entry={entry} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 text-sm font-medium text-foreground">Peer Nominations</div>
        <p className="mb-2 text-xs text-muted-foreground">
          Nominate a peer for a category — an informal signal alongside the score-based winners above.
        </p>
        <NominationForm
          draft={nominationDraft}
          onDraftChange={(patch) => {
            setNominationDraft((prev) => ({ ...prev, ...patch }))
            setNominationError(null)
          }}
          onSubmit={handleNominationSubmit}
        />
        {nominationError && <p className="mt-2 text-xs text-destructive">{nominationError}</p>}
        <div className="mt-4 flex items-end gap-2">
          <div>
            <Label htmlFor="nomination-seconder" className="text-xs">
              Seconding as
            </Label>
            <Input
              id="nomination-seconder"
              value={seconderId}
              onChange={(e) => {
                setSeconderId(e.target.value)
                setSecondError(null)
              }}
              placeholder="Your name"
              className="h-8 w-40 text-xs"
            />
          </div>
        </div>
        {secondError && <p className="mt-2 text-xs text-destructive">{secondError}</p>}
        <div className="mt-3">
          <NominationList
            nominations={nominations}
            seconderId={seconderId}
            onSecond={handleNominationSecond}
            onDelete={handleNominationDelete}
          />
        </div>
      </div>

      <div className="mb-2 text-sm font-medium text-foreground">Announced history</div>
      {pastAnnouncements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prior days have been announced yet.</p>
      ) : (
        pastAnnouncements.map((announcement) => (
          <AnnouncementGroup key={announcement.dayKey} announcement={announcement} />
        ))
      )}
    </div>
  )
}
