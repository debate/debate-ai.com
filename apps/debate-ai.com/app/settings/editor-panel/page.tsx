"use client"

/**
 * Isolated iframe document embedding the CardMirror editor's own settings
 * rows — every category `/settings` hosts, which is that page's whole
 * content (see `app/settings/page.tsx`).
 *
 * This lives at its own route rather than as a component on the /settings
 * page directly because CardMirror's settings UI (`debate-editor`)
 * ships with its own ~15k-line stylesheet (`style.css`) full of unscoped
 * global rules (`*`, `body`, `html`, `:root`) meant for a page CardMirror
 * fully owns — importing it into the host app's normal component tree
 * would fight its Tailwind base styles document-wide. Rendering it here and
 * embedding this route in a same-origin `<iframe>`
 * (`components/settings/CardMirrorSettingsPanel.tsx`) keeps that
 * stylesheet's global reach confined to this one document, in either
 * direction: the host app's styles never bleed in, and CardMirror's never
 * bleed out.
 *
 * Same-origin, so no postMessage/CORS dance is needed for state — this page
 * fetches/saves the host app's `/api/settings` directly and shares
 * `localStorage` with the parent page's origin, which is all CardMirror's
 * own settings store needs. It does post a `pmd-settings-panel-height`
 * message so the parent iframe wrapper can size itself to content instead
 * of a fixed height.
 *
 * Talks to `/api/settings` directly rather than through a host-app
 * session hook, so `debate-editor` stays independent of this
 * app's own auth wiring — a `401` there just means "signed out," handled
 * the same way `debate-round`'s `user-settings-client.ts` treats it: skip
 * hydration and skip the debounced account push, local defaults/localStorage
 * stay authoritative either way.
 */

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
// Static import so bundling confines this ~15k-line global stylesheet to
// this route's own chunk — never loaded by the host app's main bundle.
import "debate-editor/styles.css"
import type { SettingsCategory } from "debate-editor/settings"
import { EDITOR_PREFERENCE_KEYS, EDITOR_SETTINGS_TABS } from "@/lib/editor-preferences"

// The tabs and their order come from `lib/editor-preferences.ts`, so the set
// of categories shown here and the set mirrored to the account cannot drift.
const CATEGORIES = EDITOR_SETTINGS_TABS

function isSettingsCategory(value: string | null): value is SettingsCategory {
  return CATEGORIES.some((category) => category.id === value)
}

const SAVE_DEBOUNCE_MS = 600

function EditorSettingsPanelPage() {
  const searchParams = useSearchParams()
  const initialCategory = isSettingsCategory(searchParams.get("category")) ? searchParams.get("category") : "general"
  const [active, setActive] = useState<SettingsCategory>(initialCategory as SettingsCategory)
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
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
    if (!ready || !uiModule || !host) return

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

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "4px 0 16px" }}>
      <div
        role="tablist"
        aria-label="Editor settings categories"
        // Wraps: this is the editor's whole tab set now, which is more than
        // fits one row on a phone.
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginBottom: 12,
          borderBottom: "1px solid var(--pmd-border, #ddd)",
        }}
      >
        {CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            style={{
              padding: "8px 14px",
              fontSize: 14,
              fontWeight: active === id ? 600 : 400,
              background: "none",
              border: "none",
              borderBottom: active === id ? "2px solid currentColor" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {!ready && <p style={{ fontSize: 14, opacity: 0.7 }}>Loading…</p>}
      <div ref={containerRef} />
    </div>
  )
}

export default EditorSettingsPanelPage
