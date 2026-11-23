"use client"

/**
 * @fileoverview The philosophical resolutions section of the Topics &
 * Statistics page (`/practice/statistics`): 700 value resolutions in 28
 * categories, each with its `Prefix.Number` id, a Pro and a Con starting
 * point, and a link to sign up to debate it in Practice Debates.
 *
 * A search box (every word must match the id, title, resolution, category or
 * Pro / Con) and a row of category chips filter the resolutions. The results
 * show either as cards grouped by category or as a compact list; both show
 * every field. Results are paged ({@link PAGE_SIZE} at a time) so the full set
 * never renders at once.
 *
 * @module components/topic-explorer/ValueResolutionsExplorer
 */

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { LayoutGrid, List, Search, Users } from "lucide-react"

import { cn } from "../../ui/lib/utils"
import { topicSignupHref } from "@debate-ai/rankings/src/topics/topic-signup-link"
import {
  VALUE_CATEGORIES,
  VALUE_RESOLUTIONS,
  countValueResolutions,
  groupValueResolutions,
  resolutionPrefix,
  searchValueResolutions,
  type ValueResolution,
} from "../../lib/value-resolutions/value-resolutions"

/** How many resolutions render before "Show more". */
export const PAGE_SIZE = 60

type View = "cards" | "list"

/** Prefix of each category ("Nuke" for "Nuclear Ethics, Energy, and Security"). */
const CATEGORY_PREFIX: Record<string, string> = Object.fromEntries(
  VALUE_RESOLUTIONS.map((r) => [r.category, resolutionPrefix(r)]),
)

/** The Practice Debates sign-up link for one resolution. */
export function valueResolutionSignupHref(resolution: ValueResolution): string {
  return topicSignupHref({ text: resolution.resolution, format: "Value", source: `Value resolution ${resolution.id}` })
}

export function ValueResolutionsExplorer() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [view, setView] = useState<View>("cards")
  const [limit, setLimit] = useState(PAGE_SIZE)

  const counts = useMemo(() => countValueResolutions(), [])
  const results = useMemo(() => searchValueResolutions(query, category), [query, category])
  const shown = results.slice(0, limit)
  const groups = useMemo(() => groupValueResolutions(shown), [shown])

  const resetPaging = () => setLimit(PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        <strong className="text-foreground">Value resolutions</strong> about what we ought to believe, value or regard as
        legitimate, each with a Pro and a Con starting point. Ids use the category prefix and a number (Nuke.1, Dem.1,
        Edu.1). Click a resolution to sign up to debate it, find partners and start a research squad.
      </p>

      <div className="flex flex-wrap gap-3">
        <Stat value={VALUE_RESOLUTIONS.length} label="Resolutions" />
        <Stat value={VALUE_CATEGORIES.length} label="Categories" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search resolutions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              resetPaging()
            }}
            placeholder="Search resolutions, ids and arguments…"
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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        <ThemeChip
          label="All"
          count={VALUE_RESOLUTIONS.length}
          active={category === "all"}
          onClick={() => {
            setCategory("all")
            resetPaging()
          }}
        />
        {VALUE_CATEGORIES.map((c) => (
          <ThemeChip
            key={c}
            label={CATEGORY_PREFIX[c]}
            title={c}
            count={counts[c] ?? 0}
            active={category === c}
            onClick={() => {
              setCategory(c)
              resetPaging()
            }}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {category !== "all" ? <span className="font-medium text-foreground">{category} · </span> : null}
        {results.length === VALUE_RESOLUTIONS.length
          ? `${results.length} resolutions`
          : `${results.length} of ${VALUE_RESOLUTIONS.length} resolutions match`}
      </p>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No resolutions match. Try fewer words or another category.
        </p>
      ) : view === "cards" ? (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.category} className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-foreground">
                {g.category}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({CATEGORY_PREFIX[g.category]} · {counts[g.category] ?? 0})
                </span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.resolutions.map((r) => (
                  <ResolutionCard key={r.id} resolution={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shown.map((r) => (
            <ResolutionRow key={r.id} resolution={r} />
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
        Pro and Con positions are debate starting points, not endorsements or verified empirical findings.
      </p>
    </div>
  )
}

function ResolutionCard({ resolution }: { resolution: ValueResolution }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 font-semibold tabular-nums">{resolution.id}</span>
        <span className="truncate">{resolution.title}</span>
      </div>
      <Link
        href={valueResolutionSignupHref(resolution)}
        title="Sign up to debate this resolution"
        className="text-sm font-semibold leading-snug text-foreground hover:underline"
      >
        Resolved: {resolution.resolution}
      </Link>
      <ProCon resolution={resolution} />
      <SignupLink resolution={resolution} />
    </article>
  )
}

function ResolutionRow({ resolution }: { resolution: ValueResolution }) {
  return (
    <li className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4">
      <div className="flex shrink-0 items-start gap-2 text-xs text-muted-foreground sm:w-40">
        <span className="w-16 font-semibold tabular-nums">{resolution.id}</span>
        <span className="font-medium">{resolution.title}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={valueResolutionSignupHref(resolution)}
          title="Sign up to debate this resolution"
          className="text-sm font-medium text-foreground hover:underline"
        >
          Resolved: {resolution.resolution}
        </Link>
        <ProCon resolution={resolution} />
        <SignupLink resolution={resolution} />
      </div>
    </li>
  )
}

function ProCon({ resolution }: { resolution: ValueResolution }) {
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
      <li className="flex gap-1.5">
        <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">Pro</span>
        <span>{resolution.pro}</span>
      </li>
      <li className="flex gap-1.5">
        <span className="shrink-0 font-semibold text-rose-600 dark:text-rose-400">Con</span>
        <span>{resolution.con}</span>
      </li>
    </ul>
  )
}

function SignupLink({ resolution }: { resolution: ValueResolution }) {
  return (
    <Link
      href={valueResolutionSignupHref(resolution)}
      className="mt-auto inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
    >
      <Users className="h-3 w-3" /> Debate this topic
    </Link>
  )
}

function ThemeChip({
  label,
  title,
  count,
  active,
  onClick,
}: {
  label: string
  title?: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
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
