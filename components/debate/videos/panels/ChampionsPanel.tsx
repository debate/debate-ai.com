"use client"

/**
 * @fileoverview Champions Panel Component
 *
 * Displays historical debate champions by year and category.
 * Features:
 * - Year selection dropdown (from 2002 to present)
 * - Four debate categories (NDT, Policy, LD, PF)
 * - Champion names and topic display
 * - Navigation to view videos for selected year
 *
 * @module components/debate/videos/panels/ChampionsPanel
 */

import { useState, useEffect } from "react"
import Image from "next/image"
import { Trophy, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import grab from "grab-url"


/** Minimum year with available champion data */
const MIN_YEAR = 2002

/**
 * Data structure for a single year's debate information
 */
type YearData = {
  /** NDT topic for the year */
  ndt_topic?: string
  /** NDT champion team */
  ndt_champion?: string
  /** High school policy topic */
  policy_topic?: string
  /** TOC Policy champion */
  policy_champion?: string
  /** LD topic */
  ld_topic?: string
  /** TOC LD champion */
  ld_champion?: string
  /** PF topic */
  pf_topic?: string
  /** TOC PF champion */
  pf_champion?: string
}

/**
 * Complete debate history indexed by year string
 */
type DebateHistory = Record<string, YearData>

/**
 * Props for the ChampionsPanel component
 */
interface ChampionsPanelProps {
  /**
   * Callback when user clicks to view videos for a year
   * @param year - The selected year as string
   */
  onYearSelect: (year: string) => void
}

/**
 * Configuration entry for a single debate category display.
 * Maps category keys to display labels and visual styling.
 */
type CategoryConfig = {
  /** Short identifier key for the category */
  key: string
  /** Human-readable label shown in the UI */
  label: string
  /** Key into YearData for the topic field */
  topicKey: string
  /** Key into YearData for the champion field */
  championKey: string
  /** Tailwind background color class for the logo container */
  color: string
  /** Path to the category logo image */
  logoSrc: string
  /** Alt text for the category logo image */
  logoAlt: string
}

/**
 * Display configuration for each of the four debate categories
 */
const categoryConfig: CategoryConfig[] = [

  {
    key: "pf",
    label: "TOC PF",
    topicKey: "pf_topic",
    championKey: "pf_champion",
    color: "bg-orange-500",
    logoSrc: "/images/logo-public-forum-format.png",
    logoAlt: "Public Forum format",
  },
  {
    key: "policy",
    label: "TOC Policy",
    topicKey: "policy_topic",
    championKey: "policy_champion",
    color: "bg-emerald-500",
    logoSrc: "/images/logo-policy-format.png",
    logoAlt: "Policy format",
  },
  {
    key: "ld",
    label: "TOC LD",
    topicKey: "ld_topic",
    championKey: "ld_champion",
    color: "bg-purple-500",
    logoSrc: "/images/logo-lincoln-douglas-format.png",
    logoAlt: "Lincoln-Douglas format",
  },
  {
    key: "ndt",
    label: "College NDT",
    topicKey: "ndt_topic",
    championKey: "ndt_champion",
    color: "bg-blue-500",
    logoSrc: "/images/logo-college-policy-format.png",
    logoAlt: "NDT format",
  },
]

/**
 * ChampionsPanel - Historical debate champions display
 *
 * Shows tournament champions and topics for each year across
 * multiple debate formats (NDT, Policy, LD, PF).
 *
 * @param props - Component props
 * @param props.onYearSelect - Callback when user clicks to view videos for a year
 * @returns The champions panel component
 *
 * @example
 * ```tsx
 * <ChampionsPanel
 *   onYearSelect={(year) => {
 *     setSearchTerm(year);
 *     setCategory('rounds');
 *   }}
 * />
 * ```
 */
export function ChampionsPanel({ onYearSelect }: ChampionsPanelProps) {
  // State for debate history data from API
  const [debateHistory, setDebateHistory] = useState<DebateHistory | null>(null)


  // get current year plus 6 months 
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const currentSeason = currentMonth >= 6 ? currentYear + 1 : currentYear

  // Currently selected year in dropdown
  const [selectedYear, setSelectedYear] = useState(currentSeason.toString())

  // Data for the selected year
  const [yearData, setYearData] = useState<YearData | null>(null)

  // Loading state for initial data fetch
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Generate array of available years.
   * Spans from current year + 1 down to MIN_YEAR.
   */
  const years = Array.from({ length: new Date().getFullYear() - MIN_YEAR + 2 }, (_, i) =>
    (new Date().getFullYear() - i + 1).toString()
  )

  /**
   * Fetch debate history on component mount.
   */
  useEffect(() => {
    fetchHistory()
  }, [])

  /**
   * Fetches debate history data from the API.
   * Uses grab-url for consistent API calls.
   */
  const fetchHistory = async () => {
    const result = await grab<DebateHistory, { type: "history" | "debates" }>("videos", { type: "history" })

    if (result && !result.error) {
      setDebateHistory(result as DebateHistory)
      handleSelect("2025", result as DebateHistory)
    }
    setIsLoading(false)
  }

  /**
   * Handle year selection change.
   * Updates the selected year state and retrieves data for that year.
   *
   * @param year - The year string to select (e.g. "2025")
   * @param history - Optional history data object; falls back to component state if omitted
   */
  function handleSelect(year: string, history?: DebateHistory | null) {
    const data = history || debateHistory
    if (!data) return

    setSelectedYear(year)
    if (year && data[year] && Number(year) >= MIN_YEAR) {
      setYearData(data[year])
    } else {
      setYearData(null)
    }
  }

  /**
   * Navigate to view videos for the selected year by invoking the parent callback.
   *
   * @param year - The year string to view videos for
   */
  function handleViewVideos(year: string) {
    onYearSelect(year)
  }

  // Show loading spinner while fetching data
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4" />
          <p className="text-muted-foreground">Loading champions data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-4">
      {/* Year selector and view videos button */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {/* Year dropdown */}
        <Select value={selectedYear} onValueChange={(val) => handleSelect(val)}>
          <SelectTrigger className="w-[120px] h-11 bg-card border-border shadow-sm rounded-lg font-semibold text-base">
            <SelectValue placeholder={selectedYear} />
          </SelectTrigger>
          <SelectContent className="bg-card rounded-lg max-h-[300px]">
            <SelectGroup>
              <SelectLabel className="text-xs text-muted-foreground px-2">Select Year</SelectLabel>
              {years.map((year) => (
                <SelectItem key={year} value={year} className="hover:bg-accent rounded-md font-medium">
                  {year}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* View videos button */}
        <Button variant="outline" onClick={() => handleViewVideos(selectedYear)} className="h-11 gap-2">
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">View Videos</span>
        </Button>
      </div>

      {/* Champion cards grid */}
      {yearData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categoryConfig.map((cat) => {
            const topic = yearData[cat.topicKey as keyof YearData]
            const champion = yearData[cat.championKey as keyof YearData]

            // Skip categories with no data
            if (!topic && !champion) return null

            return (
              <Card
                key={cat.key}
                className="group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    {/* Category logo – 3D tilt on hover */}
                    <article
                      className="w-[200px] h-[200px] shrink-0 rounded-xl overflow-hidden cursor-pointer will-change-transform"
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
                      {cat.logoSrc ? (
                        <Image src={cat.logoSrc} alt={cat.logoAlt} width={200} height={200} className="w-full h-full object-contain p-2" />
                      ) : (
                        <div className={cn("w-full h-full flex items-center justify-center", cat.color)}>
                          <Trophy className="w-16 h-16 text-white" />
                        </div>
                      )}
                    </article>
                    <div>
                      {/* Topic display box */}
                      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Topic</p>
                        <p
                          className="text-sm text-foreground leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: topic || "TBA" }}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardTitle className="text-xl font-bold">{cat.label} Champions</CardTitle>
                  <p className="text-base font-semibold text-primary">{champion || "TBA"}</p>

                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        // Empty state when no data for selected year
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">No champion data available for {selectedYear}</p>
          </div>
        </div>
      )}
    </div>
  )
}
