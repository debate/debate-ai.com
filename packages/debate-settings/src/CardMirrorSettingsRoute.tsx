"use client"

/**
 * Isolated iframe document embedding the CardMirror editor's own
 * general/appearance/accessibility settings rows on /settings.
 *
 * This lives at its own route rather than as a component on the /settings
 * page directly because CardMirror's settings UI (`debate-editor`)
 * ships with its own ~15k-line stylesheet (`style.css`) full of unscoped
 * global rules (`*`, `body`, `html`, `:root`) meant for a page CardMirror
 * fully owns — importing it into the host app's normal component tree
 * would fight its Tailwind base styles document-wide. Rendering it here and
 * embedding this route in a same-origin `<iframe>` (`EditorPreferencesPanel`)
 * keeps that stylesheet's global reach confined to this one document, in
 * either direction: the host app's styles never bleed in, and CardMirror's
 * never bleed out.
 *
 * Same-origin, so no postMessage/CORS dance is needed for state — this page
 * fetches/saves the host app's `/api/settings` directly and shares
 * `localStorage` with the parent page's origin, which is all CardMirror's
 * own settings store needs. It does post a `pmd-settings-panel-height`
 * message so the parent iframe wrapper can size itself to content instead
 * of a fixed height.
 *
 * Talks to `/api/settings` directly rather than through a host-app
 * session hook, so this package stays independent of `apps/debate-ai.com`'s
 * own auth wiring — a `401` there just means "signed out," handled the same
 * way `debate-round`'s `user-settings-client.ts` treats it: skip hydration
 * and skip the debounced account push, local defaults/localStorage stay
 * authoritative either way.
 */

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
// Static import so bundling confines this ~15k-line global stylesheet to
// this route's own chunk — never loaded by the host app's main bundle.
import "debate-editor/styles.css"

// Cast through `any` for these dynamic-only subpath imports: the package's
// `tsconfig`/paths aren't set up to resolve them at type-check time from
// this package, and the whole point of loading them via `import()` inside
// `useEffect` is that they (and CardMirror's global stylesheet) only ever
// load in this isolated iframe document, never in the host app's main
// bundle.
type SettingsCategory = "general" | "appearance" | "accessibility"

const CATEGORIES: { id: SettingsCategory; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "accessibility", label: "Accessibility" },
]

function isSettingsCategory(value: string | null): value is SettingsCategory {
  return value === "general" || value === "appearance" || value === "accessibility"
}

const SAVE_DEBOUNCE_MS = 600

export function CardMirrorSettingsRoute() {
  const searchParams = useSearchParams()
  const initialCategory = isSettingsCategory(searchParams.get("category")) ? searchParams.get("category") : "general"
  const [active, setActive] = useState<SettingsCategory>(initialCategory as SettingsCategory)
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const containerRefs = useRef<Partial<Record<SettingsCategory, HTMLDivElement | null>>>({})
  const panelsRef = useRef<Partial<Record<SettingsCategory, { element: HTMLElement; destroy: () => void }>>>({})
  const moduleRef = useRef<typeof import("debate-editor/settings-ui") | null>(null)
  const settingsRef = useRef<typeof import("debate-editor/settings") | null>(null)

  // One-time setup: load CardMirror's settings store + UI module and its
  // stylesheet, hydrate from the signed-in user's saved values (a `401`
  // just means signed out — local defaults/localStorage stay authoritative),
  // then build every category's panel (cheap — these are plain settings
  // rows, not the full editor) and mount the initially-active one.
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
      for (const { id } of CATEGORIES) {
        const panel = uiModule.buildEmbeddedSettingsPanel(id)
        panelsRef.current[id] = panel
        const host = containerRefs.current[id]
        if (host) host.appendChild(panel.element)
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
      for (const panel of Object.values(panelsRef.current)) panel?.destroy()
      panelsRef.current = {}
    }
    // Only ever runs once per mount — auth state changing mid-session
    // doesn't need to re-hydrate an already-open panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced push of every migrated key's current value to the account,
  // whenever anything in the local store changes (mirrors
  // lib/hooks/useRoundsCloudSync.ts's local-source-of-truth/debounced-mirror
  // pattern). No-op while signed out — the local store's own localStorage
  // persistence keeps working regardless.
  useEffect(() => {
    if (!ready || !signedIn) return
    const settingsModule = settingsRef.current
    if (!settingsModule) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const push = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const editorPreferences: Record<string, unknown> = {}
        for (const meta of settingsModule.SETTING_METADATA) {
          if (meta.category === "general" || meta.category === "appearance" || meta.category === "accessibility") {
            editorPreferences[meta.key] = settingsModule.settings.get(meta.key as never)
          }
        }
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
        aria-label="Editor preference categories"
        style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid var(--pmd-border, #ddd)" }}
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
      {CATEGORIES.map(({ id }) => (
        <div
          key={id}
          ref={(el) => {
            containerRefs.current[id] = el
          }}
          hidden={active !== id}
        />
      ))}
    </div>
  )
}

export default CardMirrorSettingsRoute
