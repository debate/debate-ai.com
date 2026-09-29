"use client"

/**
 * Surfaces the signed-in user's cloud-saved Documents, Flows, and Rounds at
 * the top of the Tools directory, so the SQL-backed save feature (see
 * /settings, packages/debate-help-docs/content/docs/features/flow-cloud-save.mdx, and
 * packages/debate-help-docs/content/docs/features/round-cloud-save.mdx) is actually discoverable from the one
 * page that already lists every tool. Renders nothing when signed out.
 *
 * A signed-in user with nothing saved yet used to get nothing here either —
 * indistinguishable from the widget being broken, and TODO.md's "improve the
 * ui's and have demo mock data samples for testing these out with ui's" ask
 * named exactly this kind of gap. That case now renders
 * `getSampleCloudLibraryItems()` (`debate-round`) instead: a fixed set of
 * clearly-"Sample"-badged cards, each linking to a real tool page, so a new
 * user (or anyone testing this UI) sees what the section looks like and has
 * somewhere to click, rather than a blank space.
 *
 * Previously merged only documents and rounds inline, silently omitting
 * saved flows — the middle of the three data types "save flows docs and
 * debates" names. `buildRecentCloudItems`/`formatRelativeCloudTime`
 * (`debate-round`) now own the merge/sort/label/relative-time logic, unit
 * tested there since this file has no vitest project of its own (see
 * `vitest.config.ts`'s `projects` list). Account-synced word-count rounds
 * (`/word-count`) joined the merge alongside those three — the same
 * SQL-backed, per-user round history as `saved_rounds`, just never
 * surfaced here. Practice vs AI debates (`/versus-ai`) joined next — the
 * third and last of the "save flows docs and debates" idea's named data
 * types, already saved per-user in `practice_vs_ai_debates` but likewise
 * never listed anywhere a returning user could browse it. Video
 * speech-outcome simulation runs (`/videos`) joined after that — already
 * synced per-user via `debate-data-sync`'s generic `saved_tool_records`
 * mechanism once `CachedSpeechOutcome` gained a stable id, but that only
 * wired the sync, not discoverability, so a run stayed invisible here too.
 * Practice Drills' generated drill sets (`/drills`) joined next — already
 * saved per-user in `saved_drill_sets`, same "sync wired, discoverability
 * not" gap. AI Judge Decisions (`/judge-decision`) joined next — already
 * saved per-user in `saved_judge_decisions`, the same gap again. AI
 * Response-Outcome Charts' counsel-panel assessments (`/outcomes`) joined
 * next — already saved per-user in `saved_counsel_panel_assessments`, the
 * same gap again. Pre-Round Briefings' saved round pairings (`/briefings`)
 * joined next — already saved per-user in `saved_round_pairings`, the same
 * gap again. Scout-to-Strategy's saved strategy recommendations
 * (`/strategy`) joined next — already saved per-user in
 * `saved_strategy_recommendations`, the same gap again. Team Collaboration
 * Mode's scheduled Topic Sprint sessions (`/research`) joined next —
 * already saved per-user in `saved_sprint_sessions`, the same gap again.
 * Speech Documents' send-log entries (`/speech-documents`) joined next —
 * already saved per-user in `saved_speech_send_log`, the same gap again.
 * CardMirror Learn's custom flashcard decks (`/reason-editor`) joined next —
 * already saved per-user in `saved_learn_decks`, the same gap again.
 * Practice Round Simulator's saved custom opponent personas
 * (`/practice-round`) joined next — already saved per-user in
 * `saved_custom_opponent_personas`, the same gap again. Flow Annotations'
 * timestamped notes (`/annotations`) joined next — already synced per-user
 * via the generic `saved_tool_records` mechanism, the same gap again.
 * CardMirror's Quick Cards reusable-snippet library (`/reason-editor`)
 * joined next — already saved per-user in `saved_quick_cards`, the same gap
 * again. Prep Notes' live per-argument notes (`/prep-notes`) joined next —
 * already synced per-user via the generic `saved_tool_records` mechanism,
 * the same gap again. The Evidence Library's cut cards and reusable
 * analytic blocks (`/cards/library`) joined next — already synced per-user
 * (per-browser submissions only, not the shared search index) via the same
 * generic mechanism, the same gap again. Practice Round Simulator's saved
 * rounds (`/practice-round`) joined next — already synced per-user via the
 * same generic `saved_tool_records` mechanism, the same gap again. Coach
 * Materials' uploaded grounding documents (`/coach-materials`) joined last —
 * already saved per-user in `saved_coach_materials`, the same gap again;
 * unlike every kind above, `GET /api/coach-materials` didn't even return a
 * timestamp to sort by until now, since `CoachMaterial` itself carries no
 * `updatedAt` — see `cloudLibrary.ts`'s `CloudCoachMaterialSummary`.
 *
 * Previously also fetched all three endpoints itself via a bare
 * `Promise.all(...).then(r => r.json())` with no error handling. `/api/flows`
 * and `/api/rounds` both 401 with an `{ error }` body when the server can't
 * resolve a session even though the client still thinks it's signed in (a
 * stale session, or a transient auth-backend error) — that shape isn't an
 * array, so `buildRecentCloudItems` threw, the effect rejected with nobody
 * to catch it, and `items` stayed `null` forever, silently indistinguishable
 * from "no saved items". `fetchRecentCloudItems` (`debate-round`) now owns
 * that network orchestration and degrades any one failing source to "no
 * items of that kind" instead.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart3, BookOpen, Bot, CalendarClock, ClipboardList, Crosshair, Dumbbell, FileText, Flag, Landmark, Layers, Library, ListTree, MapPin, NotebookPen, PlayCircle, Scissors, Send, Sparkles, Trash2, Type } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "../../lib/ui/primitives/card"
import { Badge } from "../../lib/ui/primitives/badge"
import { useSession } from "../../lib/hooks/useSession"
import {
  deleteCloudLibraryItem,
  fetchRecentCloudItems,
  filterCloudItemsByKind,
  formatRelativeCloudTime,
  getSampleCloudLibraryItems,
  type CloudLibraryItem,
  type CloudLibraryItemKind,
} from "debate-round"

/** Items shown before "Show all"; the fetch itself is widened so filters/show-all have data to work with. */
const COLLAPSED_COUNT = 6
const FETCH_OPTS = { limit: 500, perKindLimit: 100 }

const KIND_ICON: Record<CloudLibraryItemKind, typeof FileText> = {
  document: FileText,
  flow: ListTree,
  round: Flag,
  // Matches Word-Count Speeches' own icon in `app/tools/tool-groups.ts`.
  wordCountRound: Type,
  // Matches Practice vs AI's own icon in `app/tools/tool-groups.ts`.
  debate: Bot,
  // No standalone /tools entry to match — an AI-generated simulation run,
  // not itself a tool.
  speechOutcome: Sparkles,
  // Matches Practice Drills' own icon in `app/tools/tool-groups.ts`.
  drillSet: Dumbbell,
  // Matches AI Judge Decision's own icon in `app/tools/tool-groups.ts`.
  judgeDecision: Landmark,
  // Matches AI Response-Outcome Charts' own icon in `app/tools/tool-groups.ts`.
  counselPanelAssessment: BarChart3,
  // Matches Pre-Round Briefings' own icon in `app/tools/tool-groups.ts` — a
  // pairing has no standalone /tools entry of its own, it's a feature of
  // that same panel.
  roundPairing: ClipboardList,
  // Matches Scout-to-Strategy's own icon in `app/tools/tool-groups.ts`.
  strategyRecommendation: Crosshair,
  // No standalone /tools entry to match — a scheduled Topic Sprint session
  // is a feature of the Research Workspace's Collaboration Prep Room, not
  // a tool of its own.
  sprintSession: CalendarClock,
  // Matches Speech Documents' own icon in `app/tools/tool-groups.ts`.
  speechSendLogEntry: Send,
  // No standalone /tools entry to match — CardMirror Learn's flashcard
  // decks are a feature of the editor's "Manage flashcards" overlay, not a
  // tool of its own.
  learnDeck: Layers,
  // Matches Practice Round Simulator's own icon in `app/tools/tool-groups.ts`.
  customOpponentPersona: PlayCircle,
  // Matches Flow Annotations' own icon in `app/tools/tool-groups.ts`.
  flowAnnotation: MapPin,
  // No standalone /tools entry to match — Quick Cards are a feature of the
  // editor's clip/search/manage UI, not a tool of its own.
  quickCard: Scissors,
  // Matches Prep Notes' own icon in `app/tools/tool-groups.ts`.
  prepNote: NotebookPen,
  // No standalone /tools entry to match — the Evidence Library is the
  // default view of the Research Workspace's `/cards` route. Matches the
  // Research Workspace's own icon in `app/tools/tool-groups.ts`.
  evidenceLibraryEntry: Library,
  // Matches Practice Round Simulator's own icon in `app/tools/tool-groups.ts`,
  // same as `customOpponentPersona` above — both belong to that same tool.
  practiceRound: PlayCircle,
  // Matches Coach Materials' own icon in `app/tools/tool-groups.ts`.
  coachMaterial: BookOpen,
}

export function MySavedItems() {
  const { isAuthenticated } = useSession()
  const [items, setItems] = useState<CloudLibraryItem[] | null>(null)
  const [kindFilter, setKindFilter] = useState<CloudLibraryItemKind | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    void fetchRecentCloudItems(FETCH_OPTS).then((result) => {
      if (!cancelled) setItems(result)
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleDelete = async (item: CloudLibraryItem) => {
    if (!window.confirm(`Delete "${item.label}"? This removes it from your account.`)) return
    if (await deleteCloudLibraryItem(item)) {
      setItems((prev) => prev && prev.filter((i) => i.key !== item.key))
    } else {
      window.alert("Couldn't delete that item. Please try again.")
    }
  }

  if (!isAuthenticated || !items) return null

  // A brand-new signed-in user has no real saved items yet — show a small,
  // clearly-labeled preview of what this section looks like once they save
  // something, instead of rendering nothing (indistinguishable from broken).
  const isPreview = items.length === 0
  const kindCounts = isPreview ? [] : countCloudItemsByKind(items)
  const filtered = isPreview ? getSampleCloudLibraryItems() : filterCloudItemsByKind(items, kindFilter)
  const canExpand = !isPreview && filtered.length > COLLAPSED_COUNT
  const displayItems = canExpand && !expanded ? filtered.slice(0, COLLAPSED_COUNT) : filtered
  if (displayItems.length === 0) return null

  const chipClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      active ? "bg-accent text-accent-foreground border-accent-foreground/30" : "text-muted-foreground hover:bg-accent"
    }`

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {isPreview ? "Try These Tools" : "My Saved Items"}
      </h2>
      {isPreview && (
        <p className="mb-3 text-sm text-muted-foreground">
          Nothing saved yet — here's a preview of what shows up here once you do.
        </p>
      )}
      {kindCounts.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter saved items by type">
          <button
            type="button"
            aria-pressed={kindFilter === null}
            className={chipClass(kindFilter === null)}
            onClick={() => setKindFilter(null)}
          >
            All ({items.length})
          </button>
          {kindCounts.map(([kind, count]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={kindFilter === kind}
              className={chipClass(kindFilter === kind)}
              onClick={() => setKindFilter(kind)}
            >
              {CLOUD_LIBRARY_KIND_LABELS[kind]} ({count})
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayItems.map((item) => {
          const Icon = KIND_ICON[item.kind]
          return (
            <div key={item.key} className="group relative">
            <Link href={item.href} className="block">
              <Card className="h-full py-4 transition-colors hover:bg-accent hover:border-accent-foreground/20">
                <CardHeader className="px-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-foreground" />
                    <CardTitle className="text-sm truncate">{item.label}</CardTitle>
                    {item.isSample && (
                      <Badge variant="outline" className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        Sample
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {item.isSample ? "Click to try this tool" : formatRelativeCloudTime(item.updatedAtMs)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            {item.deletePath && !item.isSample && (
              <button
                type="button"
                aria-label={`Delete ${item.label}`}
                onClick={() => void handleDelete(item)}
                className="absolute bottom-3 right-3 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            </div>
          )
        })}
      </div>
      {canExpand && (
        <button
          type="button"
          className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show fewer" : `Show all ${filtered.length}`}
        </button>
      )}
    </section>
  )
}
