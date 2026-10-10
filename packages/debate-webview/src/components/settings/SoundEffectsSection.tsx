"use client"

/**
 * @fileoverview Settings → Preferences: the UI sound-effect level.
 *
 * The sound effects (`@debate/timer`'s `sound-effects.ts`) play from
 * the timers, the sidebar, the mobile drawer and the command palette.
 * This is the one place to choose how many of them play: all of them
 * (the default), only the ones that confirm a change or alert the
 * reader, or none. The choice is local to this browser — like the
 * font-family pick, it applies the moment it's made and is never
 * synced to the account — and it's shared with every component that
 * plays an effect through `playUISoundEffect`.
 *
 * @module components/settings/SoundEffectsSection
 */

import { useEffect, useState } from "react"
import { Volume2 } from "lucide-react"
import { Label } from "../../lib/ui/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../lib/ui/primitives/select"
import {
  DEFAULT_SOUND_EFFECT_LEVEL,
  readSoundEffectLevel,
  setSoundEffectLevel,
  subscribeSoundEffectLevel,
  type SoundEffectLevel,
} from "@debate/timer"

/** The three levels, in the order they're listed, with the help text
 *  shown under the picker for the one currently selected. */
const LEVEL_OPTIONS: readonly {
  value: SoundEffectLevel
  label: string
  description: string
}[] = [
  {
    value: "all",
    label: "All effects",
    description:
      "Every interaction plays a sound — the sidebar and drawers opening and closing, the search palette, and the timers.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description:
      "Only the sounds that confirm a change or alert you — a sidebar or drawer opening, a timer finishing. The decorative blips and bounces stay silent.",
  },
  {
    value: "off",
    label: "Off",
    description: "No sound effects at all.",
  },
]

/** True for the three levels the picker offers. */
function isLevel(value: string): value is SoundEffectLevel {
  return value === "all" || value === "minimal" || value === "off"
}

/**
 * The sound-effects row of Settings → Preferences. Local-only: it
 * applies immediately through `setSoundEffectLevel` and is never part
 * of the account-synced form (`UserSettingsPanel`). Loaded after
 * mount so the server render and the first client render both show
 * the default, then the stored level takes over.
 */
export function SoundEffectsSection() {
  const [level, setLevel] = useState<SoundEffectLevel>(DEFAULT_SOUND_EFFECT_LEVEL)

  useEffect(() => {
    setLevel(readSoundEffectLevel())
    return subscribeSoundEffectLevel(() => setLevel(readSoundEffectLevel()))
  }, [])

  const handleChange = (value: string) => {
    if (!isLevel(value)) return
    setLevel(value)
    setSoundEffectLevel(value)
  }

  const selected = LEVEL_OPTIONS.find((option) => option.value === level)

  return (
    <section
      id="sound-effects"
      aria-labelledby="sound-effects-heading"
      className="mb-4 rounded-lg border border-border p-4"
    >
      <h4
        id="sound-effects-heading"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <Volume2 className="h-4 w-4" aria-hidden="true" />
        Sound effects
      </h4>
      <div className="space-y-2 text-sm">
        <div className="space-y-1.5">
          <Label htmlFor="settings-sound-effects">UI sound effects</Label>
          <Select value={level} onValueChange={handleChange}>
            <SelectTrigger id="settings-sound-effects" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{selected?.description}</p>
      </div>
    </section>
  )
}
