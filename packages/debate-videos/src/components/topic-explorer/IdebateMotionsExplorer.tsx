"use client"

/**
 * @fileoverview The iDebate motions section of the Topics & Statistics page
 * (`/practice/statistics`): 700 motions from the iDebate debatabase across ten
 * themes, each shown with its theme, its pro arguments and a link to its
 * idebate.net page when it has one.
 *
 * A search box (every word must match the motion, theme or pro arguments) and
 * a row of theme chips filter the motions. The results show either as cards
 * grouped by theme or as a compact searchable list; both show every field.
 * Results are paged ({@link PAGE_SIZE} at a time) so the full set never
 * renders at once.
 *
 * @module components/topic-explorer/IdebateMotionsExplorer
 */

import { useMemo, useState, type ReactNode } from "react"
import { ExternalLink, LayoutGrid, List, Search } from "lucide-react"

import { cn } from "../../ui/lib/utils"
import {
  IDEBATE_MOTIONS,
  IDEBATE_THEMES,
  countIdebateMotionsByTheme,
  groupIdebateMotionsByTheme,
  searchIdebateMotions,
  type IdebateMotion,
} from "../../lib/idebate-motions/idebate-motions"

/** How many motions render before "Show more". */
export const PAGE_SIZE = 60

type View = "cards" | "list"

export function IdebateMotionsExplorer() {
  const [query, setQuery] = useState("")
  const [theme, setTheme] = useState("all")
  const [view, setView] = useState<View>("cards")
  const [limit, setLimit] = useState(PAGE_SIZE)

  const counts = useMemo(() => countIdebateMotionsByTheme(), [])
  const results = useMemo(() => searchIdebateMotions(query, theme), [query, theme])
  const shown = results.slice(0, limit)
  const groups = useMemo(() => groupIdebateMotionsByTheme(shown), [shown])
  const withLinks = useMemo(() => IDEBATE_MOTIONS.filter((m) => m.url).length, [])

  const resetPaging = () => setLimit(PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        <strong className="text-foreground">Motions from the iDebate debatabase</strong>, grouped into broad themes, each
        with two short pro arguments to start a case from. Search by any word in the motion or its arguments, or pick a
        theme.
      </p>

      <div className="flex flex-wrap gap-3">
        <Stat value={IDEBATE_MOTIONS.length} label="iDebate motions" />
        <Stat value={IDEBATE_THEMES.length} label="Themes" />
        <Stat value={withLinks} label="With a debatabase page" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search iDebate motions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              resetPaging()
            }}
            placeholder="Search motions and arguments…"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Layout">
          <ViewButton active={view === "cards"} onClick={() => setView("cards")} label="Cards">
            <LayoutGrid className="h-4 w-4" />
          </ViewButton>
          <ViewButton active={view === "list"} onClick={() => setView("list")} label="List">
            <List className="h-4 w-4" />
          </ViewButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
        <ThemeChip
          label="All"
          count={IDEBATE_MOTIONS.length}
          active={theme === "all"}
          onClick={() => {
            setTheme("all")
            resetPaging()
          }}
        />
        {IDEBATE_THEMES.map((t) => (
          <ThemeChip
            key={t}
            label={t}
            count={counts[t] ?? 0}
            active={theme === t}
            onClick={() => {
              setTheme(t)
              resetPaging()
            }}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {results.length === IDEBATE_MOTIONS.length
          ? `${results.length} motions`
          : `${results.length} of ${IDEBATE_MOTIONS.length} motions match`}
      </p>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No motions match. Try fewer words or another theme.
        </p>
      ) : view === "cards" ? (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.theme} className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">
                {g.theme} <span className="text-sm font-normal text-muted-foreground">({counts[g.theme] ?? 0})</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.motions.map((m) => (
                  <MotionCard key={m.id} motion={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shown.map((m) => (
            <MotionRow key={m.id} motion={m} />
          ))}
        </ul>
      )}

      {results.length > shown.length ? (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
          className="self-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Show more ({results.length - shown.length} left)
        </button>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Motions and source pages from idebate.net. Arguments are short summaries, not full cases.
      </p>
    </div>
  )
}

function MotionCard({ motion }: { motion: IdebateMotion }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{motion.theme}</span>
        <span>#{motion.id}</span>
      </div>
      <h4 className="text-sm font-semibold leading-snug text-foreground">{motion.topic}</h4>
      <ProList pro={motion.pro} />
      {motion.url ? <SourceLink url={motion.url} /> : null}
    </article>
  )
}

function MotionRow({ motion }: { motion: IdebateMotion }) {
  return (
    <li className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4">
      <div className="flex shrink-0 items-start gap-2 text-xs text-muted-foreground sm:w-36">
        <span className="w-10 tabular-nums">#{motion.id}</span>
        <span className="font-medium">{motion.theme}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{motion.topic}</span>
        <ProList pro={motion.pro} />
        {motion.url ? <SourceLink url={motion.url} /> : null}
      </div>
    </li>
  )
}

function ProList({ pro }: { pro: string[] }) {
  if (pro.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
      {pro.map((p, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">Pro</span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  )
}

function SourceLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-auto inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
    >
      Debatabase page <ExternalLink className="h-3 w-3" />
    </a>
  )
}

function ThemeChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {label} <span className={active ? "opacity-80" : "text-muted-foreground"}>{count}</span>
    </button>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm",
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {label}
    </button>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[10rem] rounded-xl border border-border bg-card px-5 py-4">
      <div className="text-3xl font-extrabold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}
