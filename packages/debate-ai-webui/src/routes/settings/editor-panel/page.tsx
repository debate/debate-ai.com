"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ComponentType } from "react"
import { useSearchParams } from "next/navigation"
import { Accessibility, FolderOpen, Keyboard, MessageSquareText, Palette, PenLine, Search, Settings, SlidersHorizontal, Users } from "lucide-react"
// Static import so bundling confines this ~15k-line global stylesheet to
// this route's own chunk — never loaded by the host app's main bundle.
import "debate-editor/styles.css"
import type { SettingsCategory } from "debate-editor/settings"
import { UserSettingsPanel } from "debate-round"
import { EDITOR_PREFERENCE_KEYS, EDITOR_SETTINGS_TABS } from "../../../lib/editor-preferences"

// The app's own account-linked preferences (debate style, font size, font
// family, color theme, light/dark) — rendered by `UserSettingsPanel`, which
// syncs itself via `/api/settings`, rather than by the editor's settings UI.
// It used to be its own page, `/settings/preferences` (now a redirect here).
const PREFERENCES_TAB = "preferences"
type TabId = SettingsCategory | typeof PREFERENCES_TAB

// The editor tabs and their order come from `lib/editor-preferences.ts`, so
// the set of categories shown here and the set mirrored to the account
// cannot drift. Preferences is listed first, ahead of them.
const CATEGORIES: readonly { id: TabId; label: string }[] = [
  { id: PREFERENCES_TAB, label: "Preferences" },
  ...EDITOR_SETTINGS_TABS,
]

// Sidebar icon and header subtitle per category, in the style of the
// research workspace's settings (components/qwksearch/Settings).
const CATEGORY_DETAILS: Record<string, { icon: ComponentType<{ size?: number }>; description: string }> = {
  preferences: { icon: SlidersHorizontal, description: "Debate style, font, color theme and light/dark mode." },
  general: { icon: Settings, description: "Startup, language and general editor behavior." },
  files: { icon: FolderOpen, description: "Opening, saving, autosave and file handling." },
  appearance: { icon: Palette, description: "Colors, fonts, sizing and layout." },
  accessibility: { icon: Accessibility, description: "Contrast, motion and readability overrides." },
  editing: { icon: PenLine, description: "Typing, formatting and card cutting." },
  shortcuts: { icon: Keyboard, description: "View and customize keyboard shortcuts." },
  "comments-ai": { icon: MessageSquareText, description: "Comments, AI providers and assistance." },
  pairing: { icon: Users, description: "Real-time collaboration and sharing." },
}

// `dai-` rather than the editor's `pmd-` prefix: its stylesheet already
// styles `.pmd-settings-sidebar` for its own modal.
const SIDEBAR_CSS = `
.dai-settings-shell { display: flex; gap: 24px; align-items: flex-start; }
.dai-settings-sidebar { width: 220px; flex-shrink: 0; position: sticky; top: 0; }
.dai-settings-main { flex: 1; min-width: 0; }
.dai-settings-nav-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 10px;
  border: none; border-radius: 8px; background: none; color: inherit; font: inherit; font-size: 14px;
  text-align: left; cursor: pointer; opacity: 0.75; transition: background 150ms, opacity 150ms; }
.dai-settings-nav-item:hover { background: rgba(127, 127, 127, 0.12); opacity: 1; }
.dai-settings-nav-item[aria-selected="true"] { background: rgba(127, 127, 127, 0.18); opacity: 1; font-weight: 600; }
.dai-settings-search { width: 100%; box-sizing: border-box; padding: 7px 10px 7px 32px; border: none;
  border-radius: 8px; background: rgba(127, 127, 127, 0.12); color: inherit; font: inherit; font-size: 14px; outline: none; }
.dai-settings-search:focus { box-shadow: 0 0 0 1px rgba(127, 127, 127, 0.4); }
@media (max-width: 640px) {
  .dai-settings-shell { flex-direction: column; gap: 12px; }
  .dai-settings-sidebar { width: 100%; position: static; }
}
`

function isTabId(value: string | null): value is TabId {
  return CATEGORIES.some((category) => category.id === value)
}

const SAVE_DEBOUNCE_MS = 600

function EditorSettingsPanelPage() {
  const searchParams = useSearchParams()
  const requestedCategory = searchParams.get("category")
  const [active, setActive] = useState<TabId>(isTabId(requestedCategory) ? requestedCategory : PREFERENCES_TAB)
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement | null>(null)
  const moduleRef = useRef<typeof import("debate-editor/settings-ui") | null>(null)
  const settingsRef = useRef<typeof import("debate-editor/settings") | null>(null)
  // Every mirrored key whose row has rendered in this session — see the push
  // effect below for why the DOM, and not `SETTING_METADATA`, decides.
  const mirroredKeysRef = useRef<Set<string>>(new Set())

  // One-time setup: load CardMirror's settings store + UI module and its
  // stylesheet, then hydrate from the signed-in user's saved values (a `401`
  // just means signed out — local defaults/localStorage stay authoritative).
  // The panel itself is built by the effect below, once there is a hydrated
  // store to build it against.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const [settingsModule, uiModule] = await Promise.all([
        import("debate-editor/settings"),
        import("debate-editor/settings-ui"),
      ])
      if (cancelled) return
      settingsRef.current = settingsModule
      moduleRef.current = uiModule

      try {
        const res = await fetch("/api/settings")
        if (res.ok) {
          setSignedIn(true)
          const payload = (await res.json()) as { editorPreferences?: Record<string, unknown> }
          for (const [key, value] of Object.entries(payload.editorPreferences ?? {})) {
            settingsModule.settings.set(key as never, value as never)
          }
        }
      } catch {
        // Best-effort hydration — local defaults/localStorage stay authoritative on failure.
      }

      if (cancelled) return
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
    // Only ever runs once per mount — auth state changing mid-session
    // doesn't need to re-hydrate an already-open panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build the active category's panel, and only that one. The editor ties
  // each row's store subscription to "the settings dialog's current DOM
  // generation", and `buildEmbeddedSettingsPanel` opens a new generation by
  // flushing the previous one's cleanups — so building all eight up front
  // would leave every panel but the last-built one unsubscribed, its rows
  // stuck showing the values they were built with. One at a time honours
  // that contract: what is on screen is live, and switching tabs rebuilds
  // from the store rather than revealing a stale render.
  useEffect(() => {
    const uiModule = moduleRef.current
    const host = containerRef.current
    if (!ready || !uiModule || !host || active === PREFERENCES_TAB) return

    const panel = uiModule.buildEmbeddedSettingsPanel(active)
    host.appendChild(panel.element)
    for (const row of panel.element.querySelectorAll<HTMLElement>("[data-setting-key]")) {
      const key = row.dataset["settingKey"]
      if (key && EDITOR_PREFERENCE_KEYS.has(key)) mirroredKeysRef.current.add(key)
    }

    return () => {
      panel.destroy()
      panel.element.remove()
    }
  }, [ready, active])

  // Debounced push of every mirrored key's current value to the account,
  // whenever anything in the local store changes (mirrors
  // lib/hooks/useRoundsCloudSync.ts's local-source-of-truth/debounced-mirror
  // pattern). No-op while signed out — the local store's own localStorage
  // persistence keeps working regardless.
  //
  // The keys are the ones whose rows have rendered — each tagged
  // `data-setting-key` by the editor — rather than every key in a hosted
  // category. That keeps the mirror to what this host can edit: a row the
  // editor hides here (desktop-only card sharing, a Lite build, a setting
  // revealed by another) would otherwise be pushed at its default and
  // overwrite whatever the account holds for it. `EDITOR_PREFERENCE_KEYS`
  // then drops the credentials, which never leave this browser. The set
  // grows as tabs are visited, which is enough: nothing here can change a
  // setting whose row never rendered.
  useEffect(() => {
    if (!ready || !signedIn) return
    const settingsModule = settingsRef.current
    if (!settingsModule) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const push = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const editorPreferences: Record<string, unknown> = {}
        for (const key of mirroredKeysRef.current) {
          editorPreferences[key] = settingsModule.settings.get(key as never)
        }
        if (Object.keys(editorPreferences).length === 0) return
        void fetch("/api/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ editorPreferences }),
        }).catch(() => {
          // Best-effort — a failed account sync doesn't undo the local change.
        })
      }, SAVE_DEBOUNCE_MS)
    }
    const unsubscribe = settingsModule.settings.subscribe(push)
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [ready, signedIn])

  // Report content height to the parent so it can size the iframe instead
  // of scrolling inside a fixed box.
  useEffect(() => {
    const report = () => {
      window.parent.postMessage(
        { type: "pmd-settings-panel-height", height: document.documentElement.scrollHeight },
        window.location.origin,
      )
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [active, ready])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CATEGORIES
    return CATEGORIES.filter(
      ({ id, label }) =>
        label.toLowerCase().includes(q) || CATEGORY_DETAILS[id]?.description.toLowerCase().includes(q),
    )
  }, [query])
  const activeCategory = CATEGORIES.find((category) => category.id === active)

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "12px 16px 16px" }}>
      <style>{SIDEBAR_CSS}</style>
      <div className="dai-settings-shell">
        <div className="dai-settings-sidebar" role="navigation" aria-label="Settings">
          <div style={{ position: "relative", marginBottom: 10 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.5, display: "flex" }}>
              <Search size={15} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              aria-label="Search settings"
              className="dai-settings-search"
            />
          </div>
          <div
            role="tablist"
            aria-label="Settings categories"
            aria-orientation="vertical"
            style={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {filtered.length === 0 && (
              <p style={{ fontSize: 13, opacity: 0.6, padding: "6px 10px", margin: 0 }}>
                No settings match &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
            {filtered.map(({ id, label }) => {
              const Icon = CATEGORY_DETAILS[id]?.icon ?? Settings
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active === id}
                  onClick={() => setActive(id)}
                  className="dai-settings-nav-item"
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="dai-settings-main">
          <div
            style={{
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: "1px solid var(--pmd-border, rgba(127, 127, 127, 0.25))",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{activeCategory?.label}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.6 }}>{CATEGORY_DETAILS[active]?.description}</p>
          </div>
          {active === PREFERENCES_TAB ? (
            <UserSettingsPanel embedded />
          ) : (
            <>
              {!ready && <p style={{ fontSize: 14, opacity: 0.7 }}>Loading…</p>}
              <div ref={containerRef} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditorSettingsPanelPage
