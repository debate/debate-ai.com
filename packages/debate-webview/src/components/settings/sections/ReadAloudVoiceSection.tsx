"use client"

/**
 * @fileoverview Settings → Sound & speech: how fast, and in which engine and
 * voice, the card editor's **Read aloud** button speaks — Kokoro on this
 * device, Cloudflare Workers AI (Deepgram Aura), or the browser's own speech.
 * Three sections, each with its own voice and speed: one for the tag, one for
 * the author's name and year, one for the highlighted card text. The author &
 * year section follows the tag's voice and speed until set, and the tag's
 * follows the highlighted text's.
 *
 * Rendered as a shadcn Dialog modal (opened from the Sound & speech tab) with a
 * standard X close button, instead of an inline section.
 *
 * The card's read-aloud player (the gear under its Read aloud button) shows
 * the same settings.
 * `@debate-ai/editor/read-voice` keeps both in this browser and tells open
 * editors when they change, so picking here applies to every card at once,
 * and a new speed reaches a card that is already playing. If the chosen engine can't
 * answer, Read aloud still falls back: Kokoro to the site's voices, the site's
 * voices to the browser's speech.
 *
 * @module components/settings/sections/ReadAloudVoiceSection
 */

import { useEffect, useState } from "react"
import { AudioLines } from "lucide-react"
import { Button } from "../../../ui/primitives/button"
import { Label } from "../../../ui/primitives/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../ui/primitives/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../ui/primitives/select"
import {
  DEFAULT_READ_SPEED,
  DEFAULT_READ_VOICE_ID,
  MAX_READ_SPEED,
  MIN_READ_SPEED,
  READ_SPEED_CHANGE_EVENT,
  READ_VOICE_CHANGE_EVENT,
  READ_VOICE_ENGINES,
  READ_VOICE_OPTIONS,
  READ_VOICE_PARTS,
  firstVoiceOf,
  readStoredSpeed,
  readStoredVoiceId,
  readVoiceEngine,
  storeReadSpeed,
  storeVoiceId,
  type ReadVoiceEngine,
  type ReadVoicePart,
} from "@debate-ai/editor/read-voice"

function isEngine(value: string): value is ReadVoiceEngine {
  return READ_VOICE_ENGINES.some((engine) => engine.id === value)
}

/** Element ids per part; the highlighted text keeps the ids the single setting had. */
function partIds(part: ReadVoicePart) {
  const prefix = part === "text" ? "settings-read" : `settings-read-${part}`
  return { speed: `${prefix}-speed`, engine: `${prefix}-engine`, voice: `${prefix}-voice` }
}

/** Engine, voice and speed for one part of the card (tag, author & year, or highlighted text). */
function VoicePartControls({ part }: { part: ReadVoicePart }) {
  // The defaults until mounted, so the server and first client render agree.
  const [voiceId, setVoiceId] = useState(DEFAULT_READ_VOICE_ID)
  const [speed, setSpeed] = useState(DEFAULT_READ_SPEED)

  useEffect(() => {
    const followVoice = () => setVoiceId(readStoredVoiceId(part))
    const followSpeed = () => setSpeed(readStoredSpeed(part))
    followVoice()
    followSpeed()
    window.addEventListener(READ_VOICE_CHANGE_EVENT, followVoice)
    window.addEventListener(READ_SPEED_CHANGE_EVENT, followSpeed)
    return () => {
      window.removeEventListener(READ_VOICE_CHANGE_EVENT, followVoice)
      window.removeEventListener(READ_SPEED_CHANGE_EVENT, followSpeed)
    }
  }, [part])

  const info = READ_VOICE_PARTS.find((p) => p.id === part)
  const ids = partIds(part)
  const engine = readVoiceEngine(voiceId)
  const voices = READ_VOICE_OPTIONS.filter((option) => option.engine === engine)
  const engineInfo = READ_VOICE_ENGINES.find((option) => option.id === engine)

  const choose = (id: string) => {
    setVoiceId(id)
    storeVoiceId(id, part)
  }

  return (
    <section className="space-y-3 rounded-md border p-3" data-read-part={part}>
      <div>
        <h3 className="text-sm font-medium">{info?.label}</h3>
        <p className="text-xs text-muted-foreground">{info?.description}</p>
      </div>
      <div className="space-y-1.5 text-sm">
        <Label htmlFor={ids.speed}>Speed: {speed.toFixed(1)}x</Label>
        <input
          id={ids.speed}
          type="range"
          min={MIN_READ_SPEED}
          max={MAX_READ_SPEED}
          step={0.1}
          value={speed}
          onChange={(event) => storeReadSpeed(Number(event.target.value), part)}
          aria-label={`${info?.label ?? "Read-aloud"} speed multiplier`}
          className="w-full accent-primary"
        />
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={ids.engine}>Engine</Label>
          <Select value={engine} onValueChange={(value) => isEngine(value) && choose(firstVoiceOf(value))}>
            <SelectTrigger id={ids.engine} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {READ_VOICE_ENGINES.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.voice}>Voice</Label>
          <Select value={voiceId} onValueChange={choose} disabled={voices.length < 2}>
            <SelectTrigger id={ids.voice} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voices.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label.replace(/^[^·]+·\s*/, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{engineInfo?.description}</p>
    </section>
  )
}

/** The read-aloud voice and speed settings, opened as a shadcn Dialog modal from Settings → Sound & speech. */
export function ReadAloudVoiceSection() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <AudioLines className="h-4 w-4" aria-hidden="true" />
        Read aloud voice & speed
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Read aloud voice & speed</DialogTitle>
          <DialogDescription>
            How fast, and with which engine and voice, the card editor's Read aloud button speaks: one
            voice for the tag, another for the author and year, another for the highlighted text.
          </DialogDescription>
        </DialogHeader>
        {READ_VOICE_PARTS.map((p) => (
          <VoicePartControls key={p.id} part={p.id} />
        ))}
      </DialogContent>
    </Dialog>
  )
}
