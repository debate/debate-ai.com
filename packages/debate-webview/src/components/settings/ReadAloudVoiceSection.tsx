"use client"

/**
 * @fileoverview Settings → Preferences: which engine and voice the card
 * editor's **Read aloud** button speaks with — Kokoro on this device,
 * Cloudflare Workers AI (Deepgram Aura), or the browser's own speech.
 *
 * Rendered as a shadcn Dialog modal (opened from the Preferences tab) with a
 * standard X close button, instead of an inline section.
 *
 * The same choice the gear under Read aloud offers (`@debate/editor/read-voice`
 * keeps it in this browser and tells open editors when it changes), so
 * picking here applies to every card at once. If the chosen engine can't
 * answer, Read aloud still falls back: Kokoro to the site's voices, the site's
 * voices to the browser's speech.
 *
 * @module components/settings/ReadAloudVoiceSection
 */

import { useEffect, useState } from "react"
import { AudioLines } from "lucide-react"
import { Button } from "../../lib/ui/primitives/button"
import { Label } from "../../lib/ui/primitives/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../lib/ui/primitives/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../lib/ui/primitives/select"
import {
  DEFAULT_READ_VOICE_ID,
  READ_VOICE_CHANGE_EVENT,
  READ_VOICE_ENGINES,
  READ_VOICE_OPTIONS,
  firstVoiceOf,
  readStoredVoiceId,
  readVoiceEngine,
  storeVoiceId,
  type ReadVoiceEngine,
} from "@debate/editor/read-voice"

function isEngine(value: string): value is ReadVoiceEngine {
  return READ_VOICE_ENGINES.some((engine) => engine.id === value)
}

/** The read-aloud voice settings, opened as a shadcn Dialog modal from Settings → Preferences. */
export function ReadAloudVoiceSection() {
  // The default until mounted, so the server and first client render agree.
  const [voiceId, setVoiceId] = useState(DEFAULT_READ_VOICE_ID)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setVoiceId(readStoredVoiceId())
    const follow = () => setVoiceId(readStoredVoiceId())
    window.addEventListener(READ_VOICE_CHANGE_EVENT, follow)
    return () => window.removeEventListener(READ_VOICE_CHANGE_EVENT, follow)
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
        Read aloud voice
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Read aloud voice</DialogTitle>
          <DialogDescription>
            Which engine and voice the card editor's Read aloud button speaks with.
          </DialogDescription>
        </DialogHeader>
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
