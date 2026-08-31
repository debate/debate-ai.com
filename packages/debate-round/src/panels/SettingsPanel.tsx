/**
 * @fileoverview Account settings panel — the first real UI for
 * `state/settings.ts`'s `settingsGroups` registry (`debateStyle`/
 * `fontSize`), which until now only ever changed through inline callers
 * (`CreateRoundDialog`, `SpeechHeaderBar`) with no dedicated page a user
 * could reach on its own. Also the first UI wired to `useAccountSettings`,
 * so a signed-in user's choices here follow them across devices instead of
 * staying stuck in one browser.
 *
 * @module panels/SettingsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Label } from "debate-ui/src/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import { Badge } from "debate-ui/src/primitives/badge"
import { settings, settingsGroups } from "../state/settings"
import type { RadioSetting } from "../types/settings"
import { useAccountSettings } from "../hooks/useAccountSettings"

const SYNC_STATUS_LABEL: Record<string, string> = {
  loading: "Checking account sync…",
  synced: "Settings are synced to your account",
  "signed-out": "Sign in to sync settings across your devices",
  error: "Couldn't reach your account — changes are saved on this device only",
}

/**
 * Renders every group in `settingsGroups` as a form of Select controls (all
 * settings in this registry are `"radio"`-typed today), reading and writing
 * straight through the shared `settings` singleton so this panel stays in
 * sync with every other caller of it in the app.
 */
export function SettingsPanel() {
  // `settings` mutates its own `data` object in place rather than being a
  // piece of React state, so this counter forces a re-render whenever any
  // registered setting changes — including a change made elsewhere in the
  // app, or one merged in from the account by `useAccountSettings`.
  const [, forceRender] = useState(0)
  const syncStatus = useAccountSettings()

  useEffect(() => {
    const allKeys = settingsGroups.flatMap((group) => group.settings)
    const unsubscribe = settings.subscribe(allKeys, () => forceRender((n) => n + 1))
    return unsubscribe
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-xl">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Preferences that apply across the app.</p>
        <Badge variant={syncStatus === "synced" ? "secondary" : "outline"} className="mt-2">
          {SYNC_STATUS_LABEL[syncStatus]}
        </Badge>
      </div>

      {settingsGroups.map((group) => (
        <div key={group.name} className="rounded-lg border border-border p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{group.name}</h2>
          {group.settings.map((key) => {
            const setting = settings.data[key] as RadioSetting
            if (!setting) return null
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`setting-${key}`}>{setting.name}</Label>
                <Select
                  value={String(setting.value)}
                  onValueChange={(value) => settings.setValue(key, Number(value))}
                >
                  <SelectTrigger id={`setting-${key}`} className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {setting.detail.options.map((option, index) => (
                      <SelectItem key={option} value={String(index)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {setting.info && <p className="text-xs text-muted-foreground">{setting.info}</p>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
