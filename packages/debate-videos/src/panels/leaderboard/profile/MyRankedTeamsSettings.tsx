/**
 * @fileoverview Settings → My team: the ranked team the viewer debates on,
 * coaches or assists in each division, and their partner. The matchup
 * simulator pre-fills side A from here (see `lib/my-ranked-teams`).
 * @module panels/leaderboard/profile/MyRankedTeamsSettings
 */

"use client"

import { useEffect, useState } from "react"
import type { RankingDatasetId } from "@debate/rankings-adapter"
import { useAllRankingDatasets } from "../../../hooks/useAllRankingDatasets"
import { MY_TEAM_ROLES, type MyRankedTeams, type MyTeamRole } from "../../../lib/my-ranked-teams/my-ranked-teams"
import { useMyRankedTeams } from "../../../lib/my-ranked-teams/useMyRankedTeams"
import { Button } from "../../../ui/primitives/button"
import { Input } from "../../../ui/primitives/input"
import { TeamPicker } from "./MatchupSimulator"

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"

/** The "My team" settings form. */
export function MyRankedTeamsSettings() {
  const { datasets, loading, error } = useAllRankingDatasets()
  const { value, save } = useMyRankedTeams()
  const [draft, setDraft] = useState<MyRankedTeams>(value)
  const [status, setStatus] = useState<string | null>(null)

  // Follow the stored value until the user starts editing (it loads after mount).
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) setDraft(value)
  }, [value, dirty])

  const edit = (next: MyRankedTeams) => {
    setDraft(next)
    setDirty(true)
    setStatus(null)
  }
  const setTeam = (id: RankingDatasetId, slug: string) => {
    const teams = { ...draft.teams }
    if (slug) teams[id] = slug
    else delete teams[id]
    edit({ ...draft, teams })
  }

  const onSave = async () => {
    setStatus("Saving…")
    const synced = await save(draft)
    setDirty(false)
    setStatus(synced ? "Saved to your account." : "Saved in this browser — sign in to keep it on every device.")
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        The team you debate on, coach or assist in each division. The matchup simulator starts from it, so “Simulate
        vs. any ranked team” on another team&apos;s profile compares that team with yours.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Your role</span>
          <select
            className={selectClass}
            value={draft.role}
            onChange={(e) => edit({ ...draft, role: e.target.value as MyTeamRole })}
          >
            {MY_TEAM_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Partner</span>
          <Input
            value={draft.partner}
            maxLength={160}
            placeholder={draft.role === "debater" ? "Your partner's name" : "Optional"}
            onChange={(e) => edit({ ...draft, partner: e.target.value })}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading rankings…</p>
      ) : error ? (
        <p className="text-muted-foreground">{error}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {datasets.map((d) => (
            <TeamPicker
              key={d.id}
              label={d.label}
              entries={d.entries}
              value={draft.teams[d.id] ?? ""}
              onChange={(slug) => setTeam(d.id, slug)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={onSave} disabled={!dirty}>
          Save my team
        </Button>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
    </div>
  )
}
