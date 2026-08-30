/**
 * @fileoverview User Settings panel — TODO.md idea #17 ("User Settings —
 * account-linked debate preferences"), first slice. Lets a user view and
 * change the `debateStyle`/`fontSize` preferences already read throughout
 * the flow editor (`DebateRoundPanel`, `SpeechHeaderBar`,
 * `CreateRoundDialog`) but never exposed by any settings UI before this —
 * the dock's gear-icon "Settings" menu only ever linked to Features/Tools/
 * Theme/Account, not app preferences.
 *
 * A change always applies immediately to the local `settings` singleton
 * (`applyUserSettingsToLocalStore`), so this panel behaves exactly like
 * today's editor for a signed-out user. When signed in, it additionally
 * loads the account's saved values on mount (`fetchUserSettings`, via
 * `/api/settings`) and syncs a save to the account (`saveUserSettings`) so
 * the same preferences follow the user to another device — a failed
 * account sync is reported but never blocks the local apply.
 *
 * @module panels/UserSettingsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Label } from "debate-ui/src/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import { fetchUserSettings, saveUserSettings } from "../round/user-settings-client"
import {
  applyUserSettingsToLocalStore,
  DEBATE_STYLE_OPTIONS,
  FONT_SIZE_OPTIONS,
  readLocalUserSettings,
  type UserSettingsPayload,
} from "../state/userSettings"

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved-local"; message: string }
  | { kind: "saved-account"; message: string }
  | { kind: "error"; message: string }

/**
 * Renders the User Settings panel: a `debateStyle`/`fontSize` form that
 * applies locally on save and, when signed in, syncs to the account via
 * `/api/settings`.
 *
 * Reads local/remote state on mount only (client-side), so it renders a
 * loading state during SSR/hydration rather than throwing.
 */
export function UserSettingsPanel() {
  const [form, setForm] = useState<UserSettingsPayload | null>(null)
  const [remoteAvailable, setRemoteAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" })

  useEffect(() => {
    let cancelled = false
    setForm(readLocalUserSettings())

    fetchUserSettings()
      .then((remote) => {
        if (cancelled) return
        if (remote) {
          setRemoteAvailable(true)
          setForm(remote)
          applyUserSettingsToLocalStore(remote)
        }
      })
      .catch(() => {
        // Signed in but the load failed (network/server error) — keep the
        // local values already set above rather than blocking the form.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!form) {
    return (
      <div className="max-w-lg mx-auto p-4 sm:p-6">
        <h1 className="text-xl font-semibold mb-4">Settings</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const handleSave = async () => {
    setStatus({ kind: "saving" })
    applyUserSettingsToLocalStore(form)

    if (!remoteAvailable) {
      setStatus({
        kind: "saved-local",
        message: "Saved on this device. Sign in to sync your settings across devices.",
      })
      return
    }

    try {
      const saved = await saveUserSettings(form)
      setForm(saved)
      setStatus({ kind: "saved-account", message: "Saved to your account." })
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save to your account.",
      })
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6">
      <h1 className="text-xl font-semibold mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {loading
          ? "Loading your saved settings…"
          : remoteAvailable
            ? "Signed in — changes sync to your account."
            : "Signed out — changes apply to this browser only."}
      </p>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="settings-debate-style">Debate style</Label>
          <Select
            value={String(form.debateStyle)}
            onValueChange={(value) => setForm({ ...form, debateStyle: Number(value) })}
          >
            <SelectTrigger id="settings-debate-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEBATE_STYLE_OPTIONS.map((label, index) => (
                <SelectItem key={label} value={String(index)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Already-created flows won't be affected by this setting.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-font-size">Font size</Label>
          <Select
            value={String(form.fontSize)}
            onValueChange={(value) => setForm({ ...form, fontSize: Number(value) })}
          >
            <SelectTrigger id="settings-font-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZE_OPTIONS.map((px) => (
                <SelectItem key={px} value={String(px)}>
                  {px}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Saving…" : "Save"}
        </Button>

        {status.kind === "saved-local" && (
          <Badge variant="secondary" className="block w-fit">
            {status.message}
          </Badge>
        )}
        {status.kind === "saved-account" && (
          <Badge variant="secondary" className="block w-fit">
            {status.message}
          </Badge>
        )}
        {status.kind === "error" && (
          <Badge variant="destructive" className="block w-fit">
            {status.message}
          </Badge>
        )}
      </div>
    </div>
  )
}
