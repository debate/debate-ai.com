"use client"

/**
 * @fileoverview The `/research/topics` page body: every resolution since 2000, split
 * into 44 focused research areas and ranked by how often each area has been
 * debated — overall and within each format. Picking an area lists its
 * resolutions newest first and draws its year-by-year trend.
 *
 * Each format is its own collapsible panel with its own selection, so
 * comparing an area's Policy history against its PF history is two clicks
 * rather than a filter toggle that throws the first answer away.
 *
 * @module components/topics/TopicAreasExplorer
 */

import { useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "../../lib/ui/lib/utils"
import {
  TOPIC_AREAS,
  TOPIC_FIRST_YEAR,
  TOPIC_FORMAT_FILTERS,
  TOPIC_FORMAT_LABELS,
  TOPIC_LAST_YEAR,
  TOPIC_RESOLUTIONS,
  countByArea,
  countByYear,
  resolutionsForFormat,
  resolutionsInArea,
  type TopicFormatFilter,
} from "../../lib/topic-areas/topic-areas"

export function TopicAreasExplorer() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        <strong className="text-foreground">High-volume topic areas have been split into focused research domains.</strong>{" "}
        Areas are ranked by resolution count, from most to least, within every debate format. Select an area to see its
        resolutions newest first and its annual trend.
      </p>

      <div className="flex flex-wrap gap-3">
        <Stat value={TOPIC_RESOLUTIONS.length} label="Total resolutions" />
        <Stat value={TOPIC_AREAS.length} label="Detailed topic areas" />
        <Stat value={TOPIC_FORMAT_FILTERS.length - 1} label="Debate formats" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Explore by format</h2>
        {TOPIC_FORMAT_FILTERS.map(({ id, label }) => (
          <FormatPanel key={id} format={id} label={label} defaultOpen={id === "all"} />
        ))}
      </section>

      <p className="text-xs text-muted-foreground">
        Topic assignments are heuristic research categories, not official NSDA or NDT classifications.
      </p>
    </div>
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

function FormatPanel({ format, label, defaultOpen }: { format: TopicFormatFilter; label: string; defaultOpen: boolean }) {
  const resolutions = useMemo(() => resolutionsForFormat(format), [format])
  const areas = useMemo(() => countByArea(resolutions), [resolutions])
  const [selected, setSelected] = useState<string | null>(null)
  const selectionRef = useRef<HTMLDivElement>(null)
  const max = areas[0]?.count ?? 1

  function select(area: string) {
    setSelected(area)
    requestAnimationFrame(() => selectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-lg font-semibold text-foreground">{label}</span>
          <span className="block text-sm text-muted-foreground">{resolutions.length} resolutions</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-border px-4 pb-6 pt-4 sm:px-5">
        <div className="rounded-xl border border-border bg-background p-3">
          <h3 className="mb-3 mt-1 text-sm font-semibold text-foreground">Detailed topic-area distribution</h3>
          {areas.map((area) => (
            <button
              key={area.name}
              type="button"
              onClick={() => select(area.name)}
              aria-pressed={selected === area.name}
              className={cn(
                "my-1 grid w-full grid-cols-1 items-center gap-1 rounded-lg p-1.5 text-left transition-colors hover:bg-accent sm:grid-cols-[16rem_1fr] sm:gap-3",
                selected === area.name && "bg-accent ring-1 ring-primary/50",
              )}
            >
              <span className="flex items-center text-sm font-semibold text-foreground">
                <span aria-hidden="true" className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: area.color }} />
                {area.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <span
                    className="block h-full min-w-1 rounded-md"
                    style={{ width: `${(area.count / max) * 100}%`, background: area.color }}
                  />
                </span>
                <span className="w-7 text-right text-sm font-bold tabular-nums text-foreground">{area.count}</span>
              </span>
            </button>
          ))}
        </div>

        <div ref={selectionRef} className="mt-6 scroll-mt-4">
          {selected ? (
            <AreaDetail format={format} area={selected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Click a topic area to show matching resolutions, newest first, plus a year-by-year trend.
            </p>
          )}
        </div>
      </div>
    </details>
  )
}

function AreaDetail({ format, area }: { format: TopicFormatFilter; area: string }) {
  const resolutions = useMemo(() => resolutionsInArea(resolutionsForFormat(format), area), [format, area])
  const color = TOPIC_AREAS.find((a) => a.name === area)?.color ?? "currentColor"

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">
        {area}{" "}
        <span className="text-sm font-normal text-muted-foreground">({resolutions.length} resolutions · newest first)</span>
      </h3>
      <div className="grid gap-2.5">
        {resolutions.map((r) => (
          <article key={`${r.year}-${r.format}-${r.topic}`} className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{r.year}</span>
              {format === "all" ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground/80">
                  {TOPIC_FORMAT_LABELS[r.format]}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-foreground">{r.topic}</p>
          </article>
        ))}
      </div>

      <h3 className="mt-4 text-base font-semibold text-foreground">Topics by year</h3>
      <p className="text-sm text-muted-foreground">
        Number of {area} resolutions in each year, {TOPIC_FIRST_YEAR}–{TOPIC_LAST_YEAR}.
      </p>
      <TrendChart points={countByYear(resolutions)} color={color} label={area} />
    </div>
  )
}

const CHART = { width: 850, height: 260, left: 42, right: 18, top: 18, bottom: 35 }
const AXIS_YEARS = [2000, 2005, 2010, 2015, 2020, 2026]

/** Year-by-year line of one area's resolution count, with a hover readout per season. */
function TrendChart({ points, color, label }: { points: { year: number; count: number }[]; color: string; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const { width, height, left, right, top, bottom } = CHART
  const plotW = width - left - right
  const plotH = height - top - bottom
  const max = Math.max(1, ...points.map((p) => p.count))
  const x = (i: number) => left + (i * plotW) / (points.length - 1)
  const y = (v: number) => top + plotH - (v / max) * plotH
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.count)}`).join(" ")
  const active = hovered === null ? null : points[hovered]

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label} resolutions per year, ${TOPIC_FIRST_YEAR} to ${TOPIC_LAST_YEAR}`}
        className="block h-auto w-full min-w-[40rem]"
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: max + 1 }, (_, v) => (
          <g key={v}>
            <line x1={left} x2={width - right} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
            <text x={14} y={y(v) + 4} className="fill-muted-foreground text-[11px]">
              {v}
            </text>
          </g>
        ))}
        {AXIS_YEARS.map((year) => (
          <text key={year} x={x(year - TOPIC_FIRST_YEAR) - 12} y={height - 12} className="fill-muted-foreground text-[11px]">
            {year}
          </text>
        ))}
        {active ? (
          <line
            x1={x(hovered!)}
            x2={x(hovered!)}
            y1={top}
            y2={top + plotH}
            className="stroke-muted-foreground"
            strokeDasharray="3 3"
          />
        ) : null}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.year} onMouseEnter={() => setHovered(i)}>
            <circle cx={x(i)} cy={y(p.count)} r={hovered === i ? 5 : 3.5} fill={color} className="stroke-background" strokeWidth={2} />
            {/* Wider than the dot, so hovering near a season is enough. */}
            <rect x={x(i) - plotW / (points.length - 1) / 2} y={top} width={plotW / (points.length - 1)} height={plotH} fill="transparent" />
          </g>
        ))}
        {active ? (
          <text
            x={Math.min(x(hovered!) + 8, width - right - 110)}
            y={top + 12}
            className="fill-foreground text-[12px] font-semibold"
          >
            {active.year} · {active.count} {active.count === 1 ? "resolution" : "resolutions"}
          </text>
        ) : null}
      </svg>
    </div>
  )
}
