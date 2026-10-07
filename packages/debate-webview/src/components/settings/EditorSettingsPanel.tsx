"use client"

import { useEffect, useMemo, useState } from "react"
import type { ComponentType } from "react"
import { useSearchParams } from "next/navigation"
import { Brain, BrainCog, HardDrive, Search, Server, Settings, SlidersHorizontal, UserCircle, Users, Volume2, Wand2 } from "lucide-react"
// Static import so bundling confines this ~15k-line global stylesheet to
// the settings routes' own chunk — never loaded by the host app's main bundle.
import "@debate/editor/styles.css"
import { CardMirrorSettingsSection } from "@debate/editor/settings-section"
import type { SettingsCategory } from "@debate/editor/settings"
import { CARDMIRROR_SETTINGS_TABS } from "@debate/editor/settings-tabs"
import { UserSettingsPanel } from "@debate/round"
import { MyRankedTeamsSettings } from "@debate/videos"
import { TeamCoachingSection } from "./TeamCoachingSection"
import { OwnAiKeySection } from "./OwnAiKeySection"
import { EDITOR_SETTINGS_TABS } from "../../lib/editor-preferences"
import { useEditorPreferencesSync } from "../../lib/hooks/useEditorPreferencesSync"
import { CARDMIRROR_TAB_ICONS } from "./cardmirror-tab-icons"
import { ResearchSettingsTab } from "./ResearchSettingsTab"
import { researchSectionOfTab, researchSettingsPages } from "../../lib/qwksearch/settings-paths"

// The app's own account-linked preferences (debate style, font size, font
// family, color theme, light/dark) — rendered by `UserSettingsPanel`, which
// syncs itself via `/api/settings`, rather than by the editor's settings UI.
// It used to be its own page, `/settings/preferences` (now a redirect here).
const PREFERENCES_TAB = "preferences"
// The ranked team the viewer debates on, coaches or assists in each division,
// which the matchup simulator pre-fills (`@debate/videos`' MyRankedTeamsSettings).
const MY_TEAM_TAB = "my-team"
/** A research section's tab id: `research-<section key>` (see `researchTabId`). */
type ResearchTabId = `research-${string}`
type TabId = SettingsCategory | typeof PREFERENCES_TAB | typeof MY_TEAM_TAB | ResearchTabId

// The research agent's settings sections (`research-agent-ui/settings`'s
// list), listed after the editor's tabs under their own heading. Each renders
// that section's pane in place (`ResearchSettingsTab`); they used to be a
// separate page, `/settings/research/<section>` (now a redirect here).
const RESEARCH_PAGES = researchSettingsPages()
const RESEARCH_TABS: readonly { id: ResearchTabId; label: string }[] = RESEARCH_PAGES.map((page) => ({
  id: page.tabId as ResearchTabId,
  label: page.name,
}))

// The editor tabs and their order come from `lib/editor-preferences.ts`, so
// the set of categories shown here and the set mirrored to the account
// cannot drift. Preferences is listed first, ahead of them, and the research
// agent's sections after.
const CATEGORIES: readonly { id: TabId; label: string }[] = [
  { id: PREFERENCES_TAB, label: "Preferences" },
  { id: MY_TEAM_TAB, label: "My team" },
  ...EDITOR_SETTINGS_TABS,
  ...RESEARCH_TABS,
]

// research-agent-ui names each section's icon; the lucide components live here.
const RESEARCH_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  account: UserCircle,
  models: BrainCog,
  mcpservers: Server,
  "skills-memory": Brain,
  searchEngines: Search,
  search: Search,
  fileSources: HardDrive,
  aiRewriteModes: Wand2,
  voice: Volume2,
}

// Sidebar icon and header subtitle per category, in the style of the
// research workspace's settings (components/qwksearch/Settings). The editor
// categories' descriptions come with CardMirror's exported tab list.
const CATEGORY_DETAILS: Record<string, { icon: ComponentType<{ size?: number }>; description: string }> = {
  preferences: {
    icon: SlidersHorizontal,
    description: "Your plan, your own AI key, debate style, font, color theme, light/dark mode and tool data sync.",
  },
  [MY_TEAM_TAB]: {
    icon: Users,
    description: "Your role, your partner, and the ranked team you represent in each division — pre-filled in the matchup simulator.",
  },
  ...Object.fromEntries(
    CARDMIRROR_SETTINGS_TABS.map((tab) => [tab.id, { icon: CARDMIRROR_TAB_ICONS[tab.id] ?? Settings, description: tab.description }]),
  ),
  ...Object.fromEntries(
    RESEARCH_PAGES.map((page) => [page.tabId, { icon: RESEARCH_ICONS[page.key] ?? Search, description: page.description }]),
  ),
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
.dai-settings-group { margin: 14px 0 4px; padding: 0 10px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.55; }
.dai-settings-search:focus { box-shadow: 0 0 0 1px rgba(127, 127, 127, 0.4); }
@media (max-width: 640px) {
  .dai-settings-shell { flex-direction: column; gap: 12px; }
  .dai-settings-sidebar { width: 100%; position: static; }
}
`

function isTabId(value: string | null): value is TabId {
  return CATEGORIES.some((category) => category.id === value)
}

export function EditorSettingsPanel() {
  const searchParams = useSearchParams()
  const requestedCategory = searchParams.get("category")
  const [active, setActive] = useState<TabId>(isTabId(requestedCategory) ? requestedCategory : PREFERENCES_TAB)
  // Follow `?category=` when it changes under a mounted page — the research
  // agent's "open settings" pushes `/settings?category=research-…`.
  useEffect(() => {
    if (isTabId(requestedCategory)) setActive(requestedCategory)
  }, [requestedCategory])
  const selectTab = (id: TabId) => {
    setActive(id)
    // Mirror the tab into the URL so it can be linked to, without a
    // navigation (a hash only applies to the tab it was opened on).
    const url = new URL(window.location.href)
    url.searchParams.set("category", id)
    url.hash = ""
    window.history.replaceState(window.history.state, "", url)
  }
  const [query, setQuery] = useState("")
  // Hydrates the editor's store from the account, then mirrors the keys
  // whose rows render back to it (see the hook for why rendered rows decide).
  const { ready, noteRenderedKeys } = useEditorPreferencesSync()

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
            {filtered.map(({ id, label }, index) => {
              const Icon = CATEGORY_DETAILS[id]?.icon ?? Settings
              const startsResearchGroup =
                researchSectionOfTab(id) !== null && researchSectionOfTab(filtered[index - 1]?.id) === null
              return (
                <div key={id} style={{ display: "contents" }}>
                  {startsResearchGroup && (
                    <p className="dai-settings-group" role="presentation">
                      Research agent
                    </p>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active === id}
                    onClick={() => selectTab(id)}
                    className="dai-settings-nav-item"
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                </div>
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
          {researchSectionOfTab(active) !== null ? (
            <ResearchSettingsTab section={researchSectionOfTab(active)!} />
          ) : active === MY_TEAM_TAB ? (
            <MyRankedTeamsSettings />
          ) : active === PREFERENCES_TAB ? (
            <>
              <TeamCoachingSection />
              <OwnAiKeySection />
              <UserSettingsPanel embedded />
            </>
          ) : (
            // One category at a time: the editor ties each row's store
            // subscription to the panel built last, so switching tabs
            // rebuilds from the store rather than revealing a stale render.
            ready ? (
              <CardMirrorSettingsSection category={active as SettingsCategory} onRowsRendered={noteRenderedKeys} />
            ) : (
              <p style={{ fontSize: 14, opacity: 0.7 }}>Loading…</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
