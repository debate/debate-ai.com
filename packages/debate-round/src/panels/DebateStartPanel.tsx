"use client"

/**
 * @fileoverview The `/debate` start screen, shown when the page is opened
 * with no flow selected — the first click on the page in a session, and any
 * later landing where every flow has been deleted.
 *
 * It answers "what do I open?" in one place instead of leaving the user to
 * dig through the sidebar's round tree: the built-in featured rounds
 * (`round/featured-rounds`) and the user's pinned rounds first, then the most
 * recent entries from the auto-saved flow history, each openable in one click. Opening anything dismisses it, since the page then has a
 * `currentFlow` and this is no longer rendered.
 *
 * Everything it lists is passed in — pins from `state/pinnedDebates`, recents
 * from the `flow-history` log, rounds from the `rounds` key, featured rounds
 * from the built-in catalog — so this component fetches nothing itself and
 * only reports the user's choice back to the page, which owns the store (and
 * fetches a featured round's speech docs when one is opened).
 *
 * @module panels/DebateStartPanel
 */

import { useMemo, type ReactNode } from "react"
import { FileText, History as HistoryIcon, Pin, PinOff, Plus, Star, Users } from "lucide-react"
import { Button } from "../ui/primitives/button"
import { Badge } from "../ui/primitives/badge"
import { orderPinnedRounds } from "../state/pinnedDebates"
import { formatRelativeCloudTime } from "../state/cloudLibrary"
import type { FlowHistoryEntry } from "../state/flowHistoryEntries"
import type { FeaturedRound } from "../round/featured-rounds"
import type { Round } from "../types/flow"
import { RoundAccountMarker } from "../navigation/RoundAccountMarker"

/** How many recent-history entries the start screen offers. */
export const MAX_RECENT_DEBATES = 8

interface DebateStartPanelProps {
  /** Every round known to this browser — the pool pins are resolved against. */
  rounds: Round[]
  /** The auto-saved flow history, newest entry first (`useFlowStore().getFlowHistory()`). */
  history: FlowHistoryEntry[]
  /** Currently pinned round ids, oldest pin first (`readPinnedDebateIds()`). */
  pinnedIds: number[]
  /** Built-in featured rounds, shown before the pinned ones. */
  featuredRounds?: readonly FeaturedRound[]
  /** Key of the featured round whose speech docs are loading, if any. */
  loadingFeaturedKey?: string | null
  /** Why the last featured round failed (or only partly) loaded. */
  featuredError?: string | null
  /** Opens (building it the first time) a featured round. */
  onOpenFeatured?: (featured: FeaturedRound) => void
  /** Opens a round's flows (and archives everything else). */
  onOpenRound: (round: Round) => void
  /** Restores a history entry as a new flow and opens it. */
  onOpenHistoryEntry: (historyId: string) => void
  /** Pins or unpins a round. */
  onTogglePin: (roundId: number) => void
  /** Creates a new blank flow. */
  onCreateFlow: () => void
  /** Opens the round editor for a new round. */
  onCreateRound: () => void
  /** Opens the full round/history dialog. */
  onOpenHistory: () => void
  /**
   * Extra header controls rendered before the action buttons — the host app
   * passes its account-sync badge here, since this package can't import it.
   */
  headerActions?: ReactNode
}

/** "Aff vs Neg" line for a round card, or "" when the round names no debaters. */
function matchupLabel(round: Round): string {
  const aff = round.debaters.aff.filter(Boolean).join(" / ")
  const neg = round.debaters.neg.filter(Boolean).join(" / ")
  if (!aff && !neg) return ""
  return `${aff || "Aff"} vs ${neg || "Neg"}`
}

/**
 * The most recent history entry per flow, newest first, capped at
 * {@link MAX_RECENT_DEBATES}. The history log keeps several versions of the
 * same flow while it's being worked on (`addFlowHistoryEntry`), so a raw
 * slice would show one debate several times.
 */
function recentEntries(history: FlowHistoryEntry[]): FlowHistoryEntry[] {
  const seen = new Set<number>()
  const recents: FlowHistoryEntry[] = []
  for (const entry of history) {
    const flowId = entry.flow?.id
    if (flowId === undefined || seen.has(flowId)) continue
    seen.add(flowId)
    recents.push(entry)
    if (recents.length === MAX_RECENT_DEBATES) break
  }
  return recents
}

export function DebateStartPanel({
  rounds,
  history,
  pinnedIds,
  featuredRounds = [],
  loadingFeaturedKey = null,
  featuredError = null,
  onOpenFeatured,
  onOpenRound,
  onOpenHistoryEntry,
  onTogglePin,
  onCreateFlow,
  onCreateRound,
  onOpenHistory,
  headerActions,
}: DebateStartPanelProps) {
  const pinnedRounds = useMemo(() => orderPinnedRounds(rounds, pinnedIds), [rounds, pinnedIds])
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const recents = useMemo(() => recentEntries(history), [history])
  const roundsById = useMemo(() => new Map(rounds.map((round) => [round.id, round])), [rounds])

  return (
    <div className="h-full overflow-y-auto border border-border rounded-lg bg-background/40 p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Debate FIAT</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Open a featured or pinned debate, or pick up one of your recent flows.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
            <Button size="sm" onClick={onCreateFlow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New flow
            </Button>
            <Button size="sm" variant="outline" onClick={onCreateRound} className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              New round
            </Button>
            <Button size="sm" variant="ghost" onClick={onOpenHistory} className="gap-1.5 text-muted-foreground">
              <HistoryIcon className="h-3.5 w-3.5" />
              All rounds
            </Button>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured</h2>
          </div>
          {featuredRounds.length + pinnedRounds.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredRounds.map((featured) => {
                const loading = loadingFeaturedKey === featured.key
                const open = () => {
                  if (!loadingFeaturedKey) onOpenFeatured?.(featured)
                }
                return (
                  <div
                    key={featured.key}
                    role="button"
                    tabIndex={0}
                    aria-busy={loading}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        open()
                      }
                    }}
                    className="flex cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{featured.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {`${featured.schools.aff[0]} vs ${featured.schools.neg[0]}`}
                        </div>
                      </div>
                      {loading ? (
                        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <Trophy className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{featured.description}</p>
                    <div className="mt-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">
                        Featured
                      </Badge>
                      <span className="truncate">
                        {loading ? "Loading speech docs…" : `${featured.speechDocs.length} speech docs`}
                      </span>
                    </div>
                  </div>
                )
              })}
              {pinnedRounds.map((round) => (
                <div
                  key={round.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenRound(round)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onOpenRound(round)
                    }
                  }}
                  className="flex cursor-pointer flex-col gap-2 rounded-md border bg-card p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {round.title || [round.tournamentName, round.roundLevel].filter(Boolean).join(" — ") || "Round"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{matchupLabel(round)}</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      tabIndex={-1}
                      className="h-7 w-7 flex-shrink-0 p-0"
                      title="Unpin from the start screen"
                      onClick={(e) => {
                        e.stopPropagation()
                        onTogglePin(round.id)
                      }}
                    >
                      <PinOff className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="mt-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {round.status}
                    </Badge>
                    <span>{formatRelativeCloudTime(round.timestamp)}</span>
                    <RoundAccountMarker round={round} />
                    <span className="truncate">
                      {round.flowIds.length} flow{round.flowIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {featuredError && (
            <p role="alert" className="text-xs text-destructive">
              {featuredError}
            </p>
          )}
          {pinnedRounds.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No pinned debates yet. Pin a round from{" "}
              <button type="button" onClick={onOpenHistory} className="underline underline-offset-2">
                round history
              </button>{" "}
              and it will show up here.
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent</h2>
          </div>
          {recents.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {recents.map((entry) => {
                const round = entry.flow?.roundId !== undefined ? roundsById.get(entry.flow.roundId) : undefined
                return (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenHistoryEntry(entry.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onOpenHistoryEntry(entry.id)
                      }
                    }}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md border bg-card p-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{entry.label || "Untitled Flow"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {round
                            ? [round.tournamentName, round.roundLevel].filter(Boolean).join(" — ")
                            : formatRelativeCloudTime(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {round && <RoundAccountMarker round={round} />}
                      {round && pinnedSet.has(round.id) && <Pin className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nothing here yet — your flows are auto-saved as you work and will show up here.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
