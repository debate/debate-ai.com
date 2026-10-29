"use client"

/**
 * @fileoverview Settings → Sound & speech: how fast, and in which engine and
 * voice, the card editor's **Read aloud** button speaks — Kokoro on this
 * device, Cloudflare Workers AI (Deepgram Aura), or the browser's own speech.
 *
 * Rendered as a shadcn Dialog modal (opened from the Sound & speech tab) with a
 * standard X close button, instead of an inline section.
 *
 * This is the only place to set them: the card's Read aloud button just reads.
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
import { Button } from "@debate-ai/ui/primitives/button"
import { Label } from "@debate-ai/ui/primitives/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@debate-ai/ui/primitives/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@debate-ai/ui/primitives/select"
import {
  DEFAULT_READ_SPEED,
  DEFAULT_READ_VOICE_ID,
  MAX_READ_SPEED,
  MIN_READ_SPEED,
  READ_SPEED_CHANGE_EVENT,
  READ_VOICE_CHANGE_EVENT,
  READ_VOICE_ENGINES,
  READ_VOICE_OPTIONS,
  firstVoiceOf,
  readStoredSpeed,
  readStoredVoiceId,
  readVoiceEngine,
  storeReadSpeed,
  storeVoiceId,
  type ReadVoiceEngine,
} from "@debate-ai/editor/read-voice"

function isEngine(value: string): value is ReadVoiceEngine {
  return READ_VOICE_ENGINES.some((engine) => engine.id === value)
}

/** The read-aloud speed and voice settings, opened as a shadcn Dialog modal from Settings → Sound & speech. */
export function ReadAloudVoiceSection() {
  // The defaults until mounted, so the server and first client render agree.
  const [voiceId, setVoiceId] = useState(DEFAULT_READ_VOICE_ID)
  const [speed, setSpeed] = useState(DEFAULT_READ_SPEED)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setVoiceId(readStoredVoiceId())
    setSpeed(readStoredSpeed())
    const followVoice = () => setVoiceId(readStoredVoiceId())
    const followSpeed = () => setSpeed(readStoredSpeed())
    window.addEventListener(READ_VOICE_CHANGE_EVENT, followVoice)
    window.addEventListener(READ_SPEED_CHANGE_EVENT, followSpeed)
    return () => {
      window.removeEventListener(READ_VOICE_CHANGE_EVENT, followVoice)
      window.removeEventListener(READ_SPEED_CHANGE_EVENT, followSpeed)
    }
  }, [])

  const engine = readVoiceEngine(voiceId)
  const voices = READ_VOICE_OPTIONS.filter((option) => option.engine === engine)
  const engineInfo = READ_VOICE_ENGINES.find((option) => option.id === engine)

  const choose = (id: string) => {
    setVoiceId(id)
    storeVoiceId(id)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <AudioLines className="h-4 w-4" aria-hidden="true" />
        Read aloud voice & speed
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Read aloud voice & speed</DialogTitle>
          <DialogDescription>
            How fast, and with which engine and voice, the card editor's Read aloud button speaks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 text-sm">
          <Label htmlFor="settings-read-speed">Speed: {speed.toFixed(1)}x</Label>
          <input
            id="settings-read-speed"
            type="range"
            min={MIN_READ_SPEED}
            max={MAX_READ_SPEED}
            step={0.1}
            value={speed}
            onChange={(event) => storeReadSpeed(Number(event.target.value))}
            aria-label="Read-aloud speed multiplier"
            className="w-full accent-primary"
          />
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="settings-read-engine">Engine</Label>
            <Select value={engine} onValueChange={(value) => isEngine(value) && choose(firstVoiceOf(value))}>
              <SelectTrigger id="settings-read-engine" className="w-full">
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
            <Label htmlFor="settings-read-voice">Voice</Label>
            <Select value={voiceId} onValueChange={choose} disabled={voices.length < 2}>
              <SelectTrigger id="settings-read-voice" className="w-full">
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
        <p className="mt-2 text-xs text-muted-foreground">{engineInfo?.description}</p>
      </DialogContent>
    </Dialog>
  )
}
