"use client"

import { useEffect, useState } from "react"
import type { DailyMetric, TierId } from "../../lib/stripe/limits"
import { limitsFor } from "../../lib/stripe/limits"

const METRIC_LABELS: Record<DailyMetric, string> = {
  llmRequests: "AI requests",
  cardAiAnalyses: "card AI analyses",
  cardSearches: "card searches",
}

const METRIC_LIMIT_KEYS: Record<DailyMetric, keyof ReturnType<typeof limitsFor>> = {
  llmRequests: "llmRequestsPerDay",
  cardAiAnalyses: "cardAiAnalysesPerDay",
  cardSearches: "cardSearchesPerDay",
}

export function UsageMeter() {
  const [data, setData] = useState<{ tier: TierId; usage: { llmRequests: number; cardAiAnalyses: number; cardSearches: number } } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/stripe/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { tier?: TierId | null; usage: { llmRequests: number; cardAiAnalyses: number; cardSearches: number } | null }) => {
        if (!cancelled) {
          setData({
            tier: json.tier ?? "free",
            usage: json.usage ?? { llmRequests: 0, cardAiAnalyses: 0, cardSearches: 0 },
          })
        }
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  const limits = limitsFor(data.tier)

  return (
    <div className="space-y-3">
      {(["llmRequests", "cardAiAnalyses", "cardSearches"] as DailyMetric[]).map((metric) => {
        const limit = limits[METRIC_LIMIT_KEYS[metric]]
        const used = data.usage[metric]
        const unlimited = limit === null
        const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100)
        return (
          <div key={metric} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{METRIC_LABELS[metric]}</span>
              <span className="text-foreground">
                {used.toLocaleString()}{unlimited ? "" : ` / ${limit.toLocaleString()}`}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
