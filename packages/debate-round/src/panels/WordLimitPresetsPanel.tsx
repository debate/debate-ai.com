"use client"

/**
 * @fileoverview "Word limit presets" section on `/settings` — TODO.md idea
 * #2 ("Word-Count-Only Speech Format"), "a per-style word-limit preset
 * manager (add/edit/remove custom limits instead of only the built-in
 * registry)" follow-up. Lets a user add, edit, and remove custom
 * `speechName → wordLimit` overrides (`hooks/useWordLimitPresets.ts`), which
 * both the standalone `/word-count` form (`WordCountRoundsPanel`) and the
 * live in-round meter (`useWordCountSpeechMode`) already check ahead of
 * `debate-timer`'s single hardcoded "Public Forum (Word Count)" style.
 *
 * Mirrors `components/settings/FavoriteToolsSettings.tsx`'s
 * "own dedicated settings-page section, backed by its own account-synced
 * hook" shape rather than folding into `UserSettingsPanel`'s form, which
 * already excludes list-type fields (`favoriteTools`, `newsRead`/`newsLiked`)
 * for the same reason.
 *
 * @module panels/WordLimitPresetsPanel
 */

import { useState } from "react"
import { Type, X } from "lucide-react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { useWordLimitPresets } from "../hooks/useWordLimitPresets"
import { isValidPresetName, isValidPresetWordLimit } from "../state/wordLimitPresets"

export function WordLimitPresetsPanel() {
  const { presets, loaded, addPreset, updatePreset, removePreset } = useWordLimitPresets()
  const [name, setName] = useState("")
  const [wordLimit, setWordLimit] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    const trimmedName = name.trim()
    const parsedLimit = Number(wordLimit)

    if (!isValidPresetName(trimmedName)) {
      setError("Enter a speech name (e.g. \"AC\" or \"1AR\").")
      return
    }
    if (!isValidPresetWordLimit(parsedLimit)) {
      setError("Enter a positive whole-number word limit.")
      return
    }
    if (!addPreset(trimmedName, parsedLimit)) {
      setError(`A preset named "${trimmedName}" already exists.`)
      return
    }
    setError(null)
    setName("")
    setWordLimit("")
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 pb-6">
      <div className="flex items-center gap-1.5 mb-1">
        <Type className="h-4 w-4 text-foreground" />
        <h2 className="text-base font-semibold">Word limit presets</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Override the built-in word-count limits for any speech, by name. Applies on the{" "}
        <span className="font-medium text-foreground">Word-Count-Only Speech Format</span> page and
        the live in-round word-limit meter.
      </p>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-3">No custom word limits yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 mb-3">
              {presets.map((preset) => (
                <li
                  key={preset.name}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                >
                  <Badge variant="outline" className="shrink-0">
                    {preset.name}
                  </Badge>
                  <Input
                    type="number"
                    min={1}
                    value={preset.wordLimit}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (isValidPresetWordLimit(next)) updatePreset(preset.name, next)
                    }}
                    aria-label={`Word limit for ${preset.name}`}
                    className="h-8 w-24 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">words</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove the ${preset.name} preset`}
                    className="ml-auto"
                    onClick={() => removePreset(preset.name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="word-limit-preset-name">Speech name</Label>
              <Input
                id="word-limit-preset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AC"
                className="h-9 w-28"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="word-limit-preset-limit">Word limit</Label>
              <Input
                id="word-limit-preset-limit"
                type="number"
                min={1}
                value={wordLimit}
                onChange={(e) => setWordLimit(e.target.value)}
                placeholder="600"
                className="h-9 w-28"
              />
            </div>
            <Button type="button" onClick={handleAdd}>
              Add
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  )
}
