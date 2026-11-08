"use client"

/**
 * @fileoverview Settings → Preferences: whether school mascots and school
 * logos show.
 *
 * Mascots sit on watch-page team cards and school pages; logos stand in for,
 * or sit beside, school names in team labels, profile headers, the schools
 * table and tournament pairings. Both are on by default. Like the sidebar
 * animation switch, the choice is local to this browser, applies the moment
 * it's made and is never synced to the account
 * (`@debate-ai/rankings` `school-art-settings.ts`).
 *
 * @module components/settings/sections/SchoolArtSection
 */

import { School } from "lucide-react"
import {
  setSchoolArtSetting,
  useShowSchoolLogos,
  useShowSchoolMascots,
} from "@debate-ai/rankings/src/leaderboard/lib/school-art-settings"
import { Label } from "../../../ui/primitives/label"
import { Switch } from "@debate-ai/qwksearch/components/ui/switch"

/** The mascots and logos rows of Settings → Preferences. */
export function SchoolArtSection() {
  const mascots = useShowSchoolMascots()
  const logos = useShowSchoolLogos()

  return (
    <section
      id="school-art"
      aria-labelledby="school-art-heading"
      className="mb-4 rounded-lg border border-border p-4"
    >
      <h4 id="school-art-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <School className="h-4 w-4" aria-hidden="true" />
        School mascots and logos
      </h4>
      <div className="flex items-center justify-between gap-4 text-sm">
        <Label htmlFor="settings-show-school-mascots">Show school mascots</Label>
        <Switch
          id="settings-show-school-mascots"
          checked={mascots}
          onCheckedChange={(checked) => setSchoolArtSetting("mascots", checked)}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-4 text-sm">
        <Label htmlFor="settings-show-school-logos">Show school logos with team names</Label>
        <Switch
          id="settings-show-school-logos"
          checked={logos}
          onCheckedChange={(checked) => setSchoolArtSetting("logos", checked)}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Mascots appear on video team cards and school pages. Logos stand in for school names in team labels, profiles
        and rankings; turn them off to see plain names. Both on by default.
      </p>
    </section>
  )
}
