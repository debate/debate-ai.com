/**
 * @fileoverview Ranking and leaderboard interface for debate teams.
 * Supports multiple divisions (PF, LD, Policy, NDT) and historical data.
 */

"use client"


import { useState, useEffect, useMemo, Fragment } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Info, ChevronUp, ChevronDown, Trophy } from "lucide-react"
import grab from "grab-url"
import type { LeaderboardEntry } from "@/lib/third-party-sync/sync-rankings-debatedrills"

type Division = "VPF" | "VLD" | "VCX" | "NDT"
const VALID_DIVISIONS = new Set<string>(["VPF", "VLD", "VCX", "NDT"])

type SortKey = "rank" | "state" | "bids" | "tocScore" | "debateElo"
type SortDir = "asc" | "desc"
type SortState = { key: SortKey; dir: SortDir } | null

type YearData = {
  ndt_topic?: string
  ndt_champion?: string
  policy_topic?: string
  policy_champion?: string
  ld_topic?: string
  ld_champion?: string
  pf_topic?: string
  pf_champion?: string
}

type DebateHistory = Record<string, YearData>

const DIVISION_CONFIG: { value: Division; label: string; topicKey: keyof YearData; championKey: keyof YearData; logoSrc: string }[] = [
  { value: "VPF", label: "Public Forum", topicKey: "pf_topic", championKey: "pf_champion", logoSrc: "/images/logo-public-forum-format.png" },
  { value: "VLD", label: "LD", topicKey: "ld_topic", championKey: "ld_champion", logoSrc: "/images/logo-lincoln-douglas-format.png" },
  { value: "VCX", label: "Policy", topicKey: "policy_topic", championKey: "policy_champion", logoSrc: "/images/logo-policy-format.png" },
  { value: "NDT", label: "College NDT", topicKey: "ndt_topic", championKey: "ndt_champion", logoSrc: "/images/logo-college-policy-format.png" },
]

function getNumericValue(val: unknown): number {
  if (val === undefined || val === null || val === "--") return -Infinity
  const n = Number(val)
  return isNaN(n) ? -Infinity : n
}

function getStringValue(val: unknown): string {
  if (val === undefined || val === null) return ""
  return String(val).toLowerCase()
}

function sortEntries(entries: LeaderboardEntry[], sort: SortState): LeaderboardEntry[] {
  if (!sort) return entries
  const { key, dir } = sort
  const mul = dir === "asc" ? 1 : -1

  return [...entries].sort((a, b) => {
    if (key === "state") {
      return mul * getStringValue(a.state).localeCompare(getStringValue(b.state))
    }
    return mul * (getNumericValue(a[key]) - getNumericValue(b[key]))
  })
}

const ELO_TOOLTIP = `Debate Elo rating updates a team's skill score after each round using an Elo-style formula. The change in Elo for the winner is S = K \u00b7 mv \u00b7 (1 - wp), where S is the points gained (the loser loses roughly S). Here K is a scaling "drift factor" based on tournament bid level, mv is the margin of victory from judge ballots, and wp is the win probability implied by the pre-round Elo difference. Upsets against higher-rated opponents and larger margins give bigger Elo gains, while expected results change Elo only slightly. Debate Elo also adds a small outround bonus: e = b/2, where b is the number of bids, awarded to each team that wins an elimination round.`

interface LeaderboardPanelProps {
  /** When provided, the parent controls division/year filters */
  controlledDivision?: Division
  controlledYear?: string
  onControlledDivisionChange?: (v: Division) => void
  onControlledYearChange?: (v: string) => void
}

export function LeaderboardPanel({
  controlledDivision,
  controlledYear,
  onControlledDivisionChange,
  onControlledYearChange,
}: LeaderboardPanelProps = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialDivision = useMemo(() => {
    const f = searchParams.get("format")
    return f && VALID_DIVISIONS.has(f) ? (f as Division) : "VPF"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalYear, setInternalYear] = useState("2026")
  const year = controlledYear ?? internalYear
  const setYear = onControlledYearChange ?? setInternalYear
  const [internalDivision, setInternalDivision] = useState<Division>(initialDivision)
  const division = controlledDivision ?? internalDivision
  const setDivisionRaw = onControlledDivisionChange ?? setInternalDivision

  const changeDivision = (val: Division) => {
    setDivisionRaw(val)
    if (!controlledDivision) setExpandedRow?.(null)
    setSort(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set("format", val)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  // Champions data
  const [debateHistory, setDebateHistory] = useState<DebateHistory | null>(null)
  const [championsLoading, setChampionsLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const maxYear = Math.max(currentYear, 2026)
  const years = Array.from({ length: maxYear - 2001 }, (_, i) => String(maxYear - i))
  const isCurrentYear = year === String(maxYear)

  // Fetch champions history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      const result = await grab<DebateHistory, { type: "history" | "debates" }>("videos", { type: "history" })
      if (result && !result.error) {
        setDebateHistory(result as DebateHistory)
      }
      setChampionsLoading(false)
    }
    fetchHistory()
  }, [])

  // Fetch leaderboard data (skip for NDT — champions-only view)
  useEffect(() => {
    if (division === "NDT") {
      setData([])
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({ division, year })
        const payload = await grab(`leaderboard?${params.toString()}`, {
          cache: false,
        })

        const leaderboardData = payload.data || []
        setData(Array.isArray(leaderboardData) ? leaderboardData : [])
      } catch (err) {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : "Failed to fetch leaderboard data"
        setError(message)
        setData([])
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => controller.abort()
  }, [year, division])

  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [sort, setSort] = useState<SortState>(null)

  const isControlled = controlledDivision !== undefined
  const showInternalFilters = !isControlled

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.dir === "desc" ? { key, dir: "asc" } : null
      }
      return { key, dir: "desc" }
    })
    setExpandedRow(null)
  }

  const showElo = division === "VPF" || division === "VLD"
  // Prior years only have Elo data from DebateDrills — no bids, score, or state
  const showTocColumns = isCurrentYear

  const gridCols = !showTocColumns
    ? "grid-cols-[40px_1fr_70px] sm:grid-cols-[50px_1fr_80px]"
    : showElo
      ? "grid-cols-[40px_1fr_32px_40px_50px_50px] sm:grid-cols-[50px_1fr_40px_50px_70px_70px]"
      : "grid-cols-[40px_1fr_32px_40px_50px] sm:grid-cols-[50px_1fr_40px_50px_70px]"

  const filteredData = sortEntries(data, sort)

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort?.key !== col) return null
    return sort.dir === "desc"
      ? <ChevronDown className="h-3 w-3 inline-block" />
      : <ChevronUp className="h-3 w-3 inline-block" />
  }

  // Get champion info for current division and year
  const divConfig = DIVISION_CONFIG.find((d) => d.value === division)!
  const yearData = debateHistory?.[year]
  const topic = yearData?.[divConfig.topicKey]
  const champion = yearData?.[divConfig.championKey]

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter controls — hidden when parent controls filters */}
        {showInternalFilters && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 border-b">
            <Tabs
              value={division}
              onValueChange={(val) => changeDivision(val as Division)}
              className="w-full sm:w-auto"
            >
              <TabsList>
                {DIVISION_CONFIG.map((d) => (
                  <TabsTrigger key={d.value} value={d.value}>{d.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {Number(y) - 1}-{y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[1600px] mx-auto">
            {/* Champion banner */}
            {!championsLoading && (
              <div className=" flex items-center gap-4 rounded-lg border bg-card">
                <article
                  className="p-6 w-[120px] h-[120px] sm:w-[250px] sm:h-[250px] shrink-0 rounded-lg overflow-hidden will-change-transform"
                  onMouseMove={(e) => {
                    const el = e.currentTarget
                    el.style.transition = "transform 0.1s ease-out"
                    const rect = el.getBoundingClientRect()
                    const x = (e.clientX - rect.left) / rect.width
                    const y = (e.clientY - rect.top) / rect.height
                    const rotateX = (y - 0.5) * -22
                    const rotateY = (x - 0.5) * 22
                    el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.06)`
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.transition = "transform 0.45s ease-out"
                    el.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)"
                  }}
                >
                  <Image
                    src={divConfig.logoSrc}
                    alt={divConfig.label}
                    width={100}
                    height={100}
                    className="w-[180px] h-[180px] object-contain"
                  />
                </article>
                <div className="min-w-0 flex-1">
                  {champion && (
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                      <span className="font-bold text-sm sm:text-base">{champion}</span>
                    </div>
                  )}
                  {topic && (
                    <p
                      className="text-xs sm:text-sm text-muted-foreground leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: topic }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* NDT: champions-only view */}
            {division === "NDT" ? (
              !championsLoading && !topic && !champion ? null : championsLoading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
                    <p className="text-muted-foreground">Loading data...</p>
                  </div>
                </div>
              ) : null
            ) : (
              /* Leaderboard table for VPF/VLD/VCX */
              <>
                {loading ? (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <div className="text-4xl mb-2">⏳</div>
                      <p className="text-muted-foreground">Loading leaderboard...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-semibold text-foreground mb-2">Error Loading Data</h2>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredData.length === 0 ? null : (
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    {/* Table header */}
                    <div className={`grid ${gridCols} gap-1 sm:gap-2 px-2 sm:px-4 py-3 bg-gray-50 border-b text-sm font-medium text-muted-foreground`}>
                      <div className="cursor-pointer select-none" onClick={() => toggleSort("rank")}>
                        Rank <SortIcon col="rank" />
                      </div>
                      <div>Team</div>
                      {showTocColumns && (
                        <>
                          <div className="text-center cursor-pointer select-none" onClick={() => toggleSort("state")}>
                            St <SortIcon col="state" />
                          </div>
                          <div className="text-right cursor-pointer select-none" onClick={() => toggleSort("bids")}>
                            Bids <SortIcon col="bids" />
                          </div>
                          <div className="text-right cursor-pointer select-none" onClick={() => toggleSort("tocScore")}>
                            Score <SortIcon col="tocScore" />
                          </div>
                        </>
                      )}
                      {(showElo || !showTocColumns) && (
                        <div className="text-right cursor-pointer select-none flex items-center justify-end gap-1" onClick={() => toggleSort("debateElo")}>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span className="cursor-help flex items-center gap-1">
                                Elo
                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs leading-relaxed">{ELO_TOOLTIP}</p>
                            </TooltipContent>
                          </Tooltip>
                          <SortIcon col="debateElo" />
                        </div>
                      )}
                    </div>

                    {/* Table rows */}
                    {filteredData.map((entry: LeaderboardEntry, index: number) => (
                      <Fragment key={index}>
                        <div
                          className={`grid ${gridCols} gap-1 sm:gap-2 items-center px-2 sm:px-4 py-3 border-b hover:bg-gray-50 transition-colors cursor-pointer`}
                          onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                        >
                          <div className="font-bold text-sm sm:text-base">{entry.rank}</div>
                          <div className="min-w-0">
                            <div className="font-semibold text-xs sm:text-sm break-words">
                              {division === "VLD" && entry.students
                                ? `${entry.teamName} ${entry.students.split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join("")}`
                                : entry.teamName}
                            </div>
                            {entry.students && (
                              <div className="text-xs text-muted-foreground truncate">{entry.students}</div>
                            )}
                            {entry.details && entry.details.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {entry.details.map((d) => `${d.tournament} ${d.placementNormalized}`).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="text-center text-xs text-muted-foreground">{entry.state || "--"}</div>
                          <div className="text-right font-medium text-sm">{entry.bids ?? "--"}</div>
                          <div className="text-right text-sm">{entry.tocScore ?? "--"}</div>
                          {showElo && (
                            <div className="text-right text-sm">{entry.debateElo ?? "--"}</div>
                          )}
                        </div>

                        {expandedRow === index && entry.details && entry.details.length > 0 && (
                          <div className="bg-gray-50 border-b px-4 sm:px-8 py-3">
                            <div className="grid grid-cols-[1fr_80px_60px] sm:grid-cols-[1fr_100px_80px_60px] gap-1 text-xs font-medium text-muted-foreground mb-1">
                              <div>Tournament</div>
                              <div className="hidden sm:block">Bid Tier</div>
                              <div>Placement</div>
                              <div className="text-right">Pts</div>
                            </div>
                            {entry.details.map((d, di) => (
                              <div
                                key={di}
                                className="grid grid-cols-[1fr_80px_60px] sm:grid-cols-[1fr_100px_80px_60px] gap-1 text-xs py-1 border-t border-gray-100"
                              >
                                <div className="font-medium">{d.tournament}</div>
                                <div className="hidden sm:block text-muted-foreground">{d.bidTier}</div>
                                <div>{d.placementNormalized}</div>
                                <div className="text-right">{d.score}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
