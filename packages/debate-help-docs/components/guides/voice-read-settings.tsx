"use client"
/**
 * @file voice-read-settings.tsx
 * @description The voice and speed pickers in the Voice menu
 * (`voice-read-button.tsx`): one voice list and one speed slider for each part
 * a read-aloud says (Tag, Author & year, Highlighted text), the same
 * settings as the editor's Read aloud player and Settings → Sound & speech.
 * They are stored by `@debate-ai/editor/read-voice`, so a change here shows
 * there and the other way round. The module loads when the menu opens.
 */
import { useEffect, useState } from "react"

type ReadVoice = typeof import("@debate-ai/editor/read-voice")

/** What each part does on the docs pages (the editor's descriptions say "card"). */
const PART_HINTS: Record<string, string> = {
  tag: "Card tags in the editor's Read aloud.",
  author: "The cite (author and year) a hover card's Read button says first.",
  text: "The page text Voice reads, and the underlined text of a hover card.",
}

export function VoiceSettings() {
  const [api, setApi] = useState<ReadVoice | null>(null)
  const [, refresh] = useState(0)

  useEffect(() => {
    let live = true
    void import("@debate-ai/editor/read-voice").then((loaded) => {
      if (live) setApi(loaded)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!api) return
    const update = () => refresh((n) => n + 1)
    window.addEventListener(api.READ_VOICE_CHANGE_EVENT, update)
    window.addEventListener(api.READ_SPEED_CHANGE_EVENT, update)
    return () => {
      window.removeEventListener(api.READ_VOICE_CHANGE_EVENT, update)
      window.removeEventListener(api.READ_SPEED_CHANGE_EVENT, update)
    }
  }, [api])

  if (!api) return <p className="mt-1.5 border-t px-0.5 pt-1.5 text-xs text-fd-muted-foreground">Loading voices…</p>

  return (
    <div className="mt-1.5 border-t pt-1.5" data-voice-settings="">
      <p className="px-0.5 text-xs text-fd-muted-foreground">Voices and speeds are shared with Settings → Sound &amp; speech.</p>
      {api.READ_VOICE_PARTS.map((part) => {
        const speed = api.readStoredSpeed(part.id)
        const voiceId = `voice-settings-${part.id}-voice`
        const speedId = `voice-settings-${part.id}-speed`
        return (
          <section key={part.id} data-part={part.id} className="mt-2 rounded-md border p-2">
            <h3 className="text-sm font-medium">{part.label}</h3>
            <p className="mb-1.5 text-xs text-fd-muted-foreground">{PART_HINTS[part.id] ?? part.description}</p>
            <div className="grid grid-cols-[3rem_1fr] items-center gap-x-2 gap-y-1.5 text-xs">
              <label htmlFor={voiceId}>Voice</label>
              <select
                id={voiceId}
                value={api.readStoredVoiceId(part.id)}
                className="w-full rounded-md border bg-fd-background px-1.5 py-1 text-sm"
                onChange={(event) => api.storeVoiceId(event.target.value, part.id)}
              >
                {api.READ_VOICE_ENGINES.map((engine) => (
                  <optgroup key={engine.id} label={engine.label}>
                    {api.READ_VOICE_OPTIONS.filter((option) => option.engine === engine.id).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label.replace(/^[^·]+·\s*/, "")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <label htmlFor={speedId} className="tabular-nums">
                {speed.toFixed(1)}x
              </label>
              <input
                id={speedId}
                type="range"
                aria-label={`${part.label} speed`}
                min={api.MIN_READ_SPEED}
                max={api.MAX_READ_SPEED}
                step={0.1}
                value={speed}
                style={{ accentColor: "var(--color-fd-primary)" }}
                className="w-full"
                onChange={(event) => api.storeReadSpeed(Number(event.target.value), part.id)}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}
