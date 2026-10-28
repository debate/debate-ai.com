"use client"

/**
 * @fileoverview Settings → General: whether sidebar icons animate on
 * hover.
 *
 * Hovering or focusing a sidebar row can wiggle, bounce, pulse, spin, flip (and more)
 * its icon (`@debate-ai/videos`' `sidebar-icon-hover.ts`). That is on by
 * default; this switch turns it off. Like the sound-effect level, the choice is
 * local to this browser, applies the moment it's made and is never synced to
 * the account.
 *
 * @module components/settings/sections/SidebarIconAnimationsSection
 */

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  readSidebarIconAnimations,
  setSidebarIconAnimations,
  subscribeSidebarIconAnimations,
} from "@debate-ai/videos"
import { Label } from "@debate-ai/ui/primitives/label"
import { Switch } from "@debate-ai/qwksearch/components/ui/switch"

/**
 * The sidebar-animation row of Settings → General. Loaded after mount so
 * the server render and the first client render both show it on, then the
 * stored choice takes over.
 */
export function SidebarIconAnimationsSection() {
  const [on, setOn] = useState(true)

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
        Icons wiggle, bounce, spin, flip and more at random, in a random color, when you hover or tab to them; each at most once every 3 seconds. On by default.
      </p>
    </section>
  )
}
