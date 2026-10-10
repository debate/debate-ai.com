"use client"

/**
 * @fileoverview Settings → Preferences: whether sidebar icons animate on
 * hover.
 *
 * Hovering or focusing a sidebar row can wiggle, bounce, pulse, spin or shake
 * its icon (`@debate/videos`' `sidebar-icon-hover.ts`). That is off by
 * default; this switch turns it on. Like the sound-effect level, the choice is
 * local to this browser, applies the moment it's made and is never synced to
 * the account.
 *
 * @module components/settings/SidebarIconAnimationsSection
 */

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  readSidebarIconAnimations,
  setSidebarIconAnimations,
  subscribeSidebarIconAnimations,
} from "@debate/videos"
import { Label } from "../../lib/ui/primitives/label"
import { Switch } from "../qwksearch/ui/switch"

/**
 * The sidebar-animation row of Settings → Preferences. Loaded after mount so
 * the server render and the first client render both show it off, then the
 * stored choice takes over.
 */
export function SidebarIconAnimationsSection() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(readSidebarIconAnimations())
    return subscribeSidebarIconAnimations(() => setOn(readSidebarIconAnimations()))
  }, [])

  const handleChange = (checked: boolean) => {
    setOn(checked)
    setSidebarIconAnimations(checked)
  }

  return (
    <section
      id="sidebar-icon-animations"
      aria-labelledby="sidebar-icon-animations-heading"
      className="mb-4 rounded-lg border border-border p-4"
    >
      <h4
        id="sidebar-icon-animations-heading"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Sidebar animations
      </h4>
      <div className="flex items-center justify-between gap-4 text-sm">
        <Label htmlFor="settings-sidebar-icon-animations">Animate sidebar icons</Label>
        <Switch id="settings-sidebar-icon-animations" checked={on} onCheckedChange={handleChange} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Icons wiggle, bounce, pulse, spin or shake when you hover or tab to them. Off by default.
      </p>
    </section>
  )
}
