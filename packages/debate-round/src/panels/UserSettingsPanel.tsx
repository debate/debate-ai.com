/**
 * @fileoverview User Settings panel — TODO.md idea #17 ("User Settings —
 * account-linked debate preferences"), first slice, plus follow-up (2)
 * (the `colorTheme`/`themeMode` fields, added to this form's own UI here —
 * previously only synced silently through the dock's separate theme
 * picker). Lets a user view and change the `debateStyle`/`fontSize`
 * preferences already read throughout the flow editor (`DebateRoundPanel`,
 * `SpeechHeaderBar`, `CreateRoundDialog`) but never exposed by any settings
 * UI before this — the dock's gear-icon "Settings" menu only ever linked to
 * Features/Tools/Theme/Account, not app preferences.
 *
 * A change always applies immediately to the local `settings` singleton
 * (`applyUserSettingsToLocalStore`) and, for the theme fields, the same
 * `localStorage`/cookie/DOM-class/`next-themes` writes
 * `theme-dropdown.tsx`'s `useThemeState` performs — so this panel behaves
 * exactly like today's editor/dock for a signed-out user. When signed in,
 * it additionally loads the account's saved values on mount
 * (`fetchUserSettings`, via `/api/settings`) and syncs a save to the
 * account (`saveUserSettings`) so the same preferences follow the user to
 * another device — a failed account sync is reported but never blocks the
 * local apply.
 *
 * Also live-updates across browser tabs: a `storage`-event listener (see
 * `flow/live-update.ts#isUserSettingsPanelLiveUpdateStorageEvent`) refreshes
 * `fontFamily` unconditionally (it applies instantly everywhere, like a
 * derived-view field) and each `form` field individually — but only when
 * that field still matches what was last loaded/saved here, so an
 * in-progress, not-yet-saved edit on any field is never overwritten by
 * another tab's change.
 *
 * @module panels/UserSettingsPanel
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Label } from "../ui/primitives/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/primitives/select"
import { fetchUserSettings, saveUserSettings, type FullUserSettingsPayload } from "../round/user-settings-client"
import { isUserSettingsPanelLiveUpdateStorageEvent } from "../flow/live-update"
import {
  applyUserSettingsToLocalStore,
  DEBATE_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  FONT_SIZE_OPTIONS,
  readLocalUserSettings,
  refreshLocalUserSettingsFromStorage,
} from "../state/userSettings"
import {
  DEFAULT_THEME_SETTINGS,
  isValidColorTheme,
  isValidThemeMode,
  THEME_MODES,
  THEME_NAMES,
  type ThemeMode,
} from "../state/themeSettings"
import {
  DEFAULT_FONT_FAMILY,
  FONT_OPTIONS,
  readLocalFontFamily,
  setLocalFontFamily,
} from "../state/fontSettings"

// `favoriteTools` has its own `FavoriteToolsSettings` UI; `wordLimitPresets`
// has its own `WordLimitPresetsPanel` UI; `outlineFilterPresets` is managed
// from the Outline tool's own "Filter presets" row, not this form;
// `newsRead`/`newsLiked` are synced automatically by `NewsStreamPanel`'s
// `syncRemote` adapter, not user-editable form fields — all excluded from
// this form the same way.
type FormState = Omit<
  FullUserSettingsPayload,
  "favoriteTools" | "wordLimitPresets" | "outlineFilterPresets" | "newsRead" | "newsLiked"
>

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved-local"; message: string }
  | { kind: "saved-account"; message: string }
  | { kind: "error"; message: string }

function formatThemeName(name: string) {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** Swaps the `theme-*` class on `<html>` to `colorTheme`, leaving `localStorage`/the cookie untouched — the piece of `applyThemeLocally` that a cross-tab refresh (whose write already landed in `localStorage`/the cookie, a store shared across tabs) still needs to redo, since each tab has its own in-memory `document`. */
function applyColorThemeClass(colorTheme: string) {
  if (typeof document === "undefined") return
  THEME_NAMES.forEach((t) => document.documentElement.classList.remove(`theme-${t}`))
  document.documentElement.classList.add(`theme-${colorTheme}`)
}

/** Applies a resolved colorTheme/themeMode to localStorage/cookie/DOM class, mirroring `theme-dropdown.tsx`'s `applyColorTheme`/`handleThemeChange` so this panel's Save button and the dock's picker never disagree about how a theme choice is persisted locally. */
function applyThemeLocally(colorTheme: string, themeMode: ThemeMode, setTheme: (mode: string) => void) {
  if (typeof document === "undefined") return
  applyColorThemeClass(colorTheme)
  localStorage.setItem("color-theme", colorTheme)
  document.cookie = `color-theme=${colorTheme}; path=/; max-age=31536000`
  setTheme(themeMode)
}

/**
 * Renders the User Settings panel: a `debateStyle`/`fontSize`/`colorTheme`/
 * `themeMode` form that applies locally on save and, when signed in, syncs
 * to the account via `/api/settings`.
 *
 * Reads local/remote state on mount only (client-side), so it renders a
 * loading state during SSR/hydration rather than throwing.
 */
export function UserSettingsPanel() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [form, setForm] = useState<FormState | null>(null)
  const [remoteAvailable, setRemoteAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" })
  // Local-only, like the source it was ported from — never synced to `/api/settings`,
  // so it lives outside `form` and applies as soon as it's picked rather than
  // waiting on the Save button below.
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY)
  // The last values `form` was loaded/saved from — i.e. what's actually
  // persisted right now, as far as this tab knows. The cross-tab
  // `storage`-event handler below only refreshes a field whose current
  // `form` value still matches its `baselineRef` entry (meaning the user
  // hasn't started editing it since); a field that differs is an
  // in-progress edit and is left alone.
  const baselineRef = useRef<FormState | null>(null)

  useEffect(() => {
    setFontFamily(readLocalFontFamily())
  }, [])

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value)
    setLocalFontFamily(value)
  }

  useEffect(() => {
    let cancelled = false

    const localColorTheme = localStorage.getItem("color-theme")
    const localThemeMode = resolvedTheme || theme
    const initialForm: FormState = {
      ...readLocalUserSettings(),
      colorTheme: localColorTheme && isValidColorTheme(localColorTheme) ? localColorTheme : DEFAULT_THEME_SETTINGS.colorTheme,
      themeMode: localThemeMode && isValidThemeMode(localThemeMode) ? localThemeMode : DEFAULT_THEME_SETTINGS.themeMode,
    }
    setForm(initialForm)
    baselineRef.current = initialForm

    fetchUserSettings()
      .then((remote) => {
        if (cancelled) return
        if (remote) {
          setRemoteAvailable(true)
          const { debateStyle, fontSize, colorTheme, themeMode } = remote
          const remoteForm: FormState = { debateStyle, fontSize, colorTheme, themeMode }
          setForm(remoteForm)
          baselineRef.current = remoteForm
          applyUserSettingsToLocalStore(remote)
          applyThemeLocally(colorTheme, themeMode, setTheme)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, same as before this slice; theme/resolvedTheme are only read for their initial value.
  }, [])

  /**
   * Live-updates this form across browser tabs — e.g. another tab's own
   * `UserSettingsPanel` Save, or `theme-dropdown.tsx`'s dock picker
   * changing `color-theme`/`theme` — but only fields that still match
   * `baselineRef` (untouched since they were last loaded/saved here), so an
   * in-progress, not-yet-saved edit is never overwritten. `fontFamily` is
   * refreshed unconditionally since it isn't a Save-gated draft; it always
   * applies immediately, so there's nothing to protect. A `colorTheme`
   * refresh also reapplies the `theme-*` class, since that's per-tab DOM
   * state that a `storage` event alone doesn't update — `themeMode`'s
   * equivalent DOM effect is already handled by next-themes' own storage
   * listener.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isUserSettingsPanelLiveUpdateStorageEvent(event)) return
      setFontFamily(readLocalFontFamily())

      const baseline = baselineRef.current
      if (!baseline) return

      const localColorTheme = localStorage.getItem("color-theme")
      const localThemeMode = resolvedTheme || theme
      const next: FormState = {
        ...refreshLocalUserSettingsFromStorage(),
        colorTheme:
          localColorTheme && isValidColorTheme(localColorTheme) ? localColorTheme : DEFAULT_THEME_SETTINGS.colorTheme,
        themeMode:
          localThemeMode && isValidThemeMode(localThemeMode) ? localThemeMode : DEFAULT_THEME_SETTINGS.themeMode,
      }

      setForm((prev) => {
        if (!prev) return prev
        const updated: FormState = {
          debateStyle: prev.debateStyle === baseline.debateStyle ? next.debateStyle : prev.debateStyle,
          fontSize: prev.fontSize === baseline.fontSize ? next.fontSize : prev.fontSize,
          colorTheme: prev.colorTheme === baseline.colorTheme ? next.colorTheme : prev.colorTheme,
          themeMode: prev.themeMode === baseline.themeMode ? next.themeMode : prev.themeMode,
        }
        if (
          updated.debateStyle === prev.debateStyle &&
          updated.fontSize === prev.fontSize &&
          updated.colorTheme === prev.colorTheme &&
          updated.themeMode === prev.themeMode
        ) {
          return prev
        }

        baselineRef.current = {
          debateStyle: prev.debateStyle === baseline.debateStyle ? next.debateStyle : baseline.debateStyle,
          fontSize: prev.fontSize === baseline.fontSize ? next.fontSize : baseline.fontSize,
          colorTheme: prev.colorTheme === baseline.colorTheme ? next.colorTheme : baseline.colorTheme,
          themeMode: prev.themeMode === baseline.themeMode ? next.themeMode : baseline.themeMode,
        }
        if (updated.colorTheme !== prev.colorTheme) applyColorThemeClass(updated.colorTheme)
        return updated
      })
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [theme, resolvedTheme])

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
    applyThemeLocally(form.colorTheme, form.themeMode, setTheme)
    // These values are now what's actually persisted locally, so a later
    // cross-tab refresh should treat them as the new baseline rather than
    // as an unsaved edit relative to whatever was loaded before this Save.
    baselineRef.current = form

    if (!remoteAvailable) {
      setStatus({
        kind: "saved-local",
        message: "Saved on this device. Sign in to sync your settings across devices.",
      })
      return
    }

    try {
      const saved = await saveUserSettings(form)
      const { debateStyle, fontSize, colorTheme, themeMode } = saved
      const savedForm: FormState = { debateStyle, fontSize, colorTheme, themeMode }
      setForm(savedForm)
      baselineRef.current = savedForm
      setStatus({ kind: "saved-account", message: "Saved to your account." })
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save to your account.",
      })
    }
  }

  const handleResetToDefaults = () => {
    setForm({ ...DEFAULT_USER_SETTINGS, ...DEFAULT_THEME_SETTINGS })
    handleFontFamilyChange(DEFAULT_FONT_FAMILY)
    setStatus({ kind: "idle" })
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

        <div className="space-y-1.5">
          <Label htmlFor="settings-font-family">Font family</Label>
          <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
            <SelectTrigger id="settings-font-family">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[min(360px,60vh)]">
              {FONT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Applies immediately in this browser — unlike the settings above, this one isn't saved to your account.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-color-theme">Color theme</Label>
          <Select
            value={form.colorTheme}
            onValueChange={(value) => setForm({ ...form, colorTheme: value })}
          >
            <SelectTrigger id="settings-color-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[min(360px,60vh)]">
              {THEME_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {formatThemeName(name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The same picker as the dock's palette icon — changing it here updates both.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-theme-mode">Light / dark mode</Label>
          <Select
            value={form.themeMode}
            onValueChange={(value) => setForm({ ...form, themeMode: value as ThemeMode })}
          >
            <SelectTrigger id="settings-theme-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {formatThemeName(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={status.kind === "saving"}>
            {status.kind === "saving" ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={handleResetToDefaults} disabled={status.kind === "saving"}>
            Reset to defaults
          </Button>
        </div>

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
