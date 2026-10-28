"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Brain, BrainCog, HardDrive, Plug, Search, Server, Settings, ShieldCheck, SlidersHorizontal, UserCircle, Volume2, Wand2 } from "lucide-react"
// Static import so bundling confines this ~15k-line global stylesheet to
// the settings routes' own chunk — never loaded by the host app's main bundle.
import "@debate-ai/editor/styles.css"
import { DebateEditorSettingsSection } from "@debate-ai/editor/settings-section"
import type { SettingsCategory } from "@debate-ai/editor/settings"
import { DEBATE_EDITOR_SETTINGS_TABS } from "@debate-ai/editor/settings-tabs"
import { UserSettingsPanel } from "@debate-ai/round"
import { MyRankedTeamsSettings } from "@debate-ai/rankings-adapter/leaderboard"
import { TeamCoachingSection } from "./sections/TeamCoachingSection"
import { MySchoolSettings } from "@debate-ai/rankings-adapter/src/schools/ui/MySchoolSettings"
import { OwnAiKeySection } from "./sections/OwnAiKeySection"
import { SoundEffectsSection } from "./sections/SoundEffectsSection"
import { SavedDataSection } from "./sections/SavedDataSection"
import { OnDeviceModelsSection } from "./sections/OnDeviceModelsSection"
import { ReadAloudVoiceSection } from "./sections/ReadAloudVoiceSection"
import { SidebarIconAnimationsSection } from "./sections/SidebarIconAnimationsSection"
import { PrivacySettingsSection } from "./sections/PrivacySettingsSection"
import { McpServerSection } from "./sections/McpServerSection"
import { useSession } from "../../lib/hooks/useSession"
import { EDITOR_SETTINGS_TABS } from "../../lib/editor-preferences"
import { useEditorPreferencesSync } from "../../lib/hooks/useEditorPreferencesSync"
import { DEBATE_EDITOR_TAB_ICONS } from "./debate-editor/debate-editor-tab-icons"
import { ResearchSettingsTab } from "./ResearchSettingsTab"
import { researchSectionOfTab, researchSettingsPages } from "../../lib/qwksearch/settings-paths"
import { SITE_LINKS } from "../../lib/nav/dock-menu-sections"
import { getHostConfig } from "../../host/config"

// The General tab (id kept as `preferences` so old links still land on it):
// the app's own account-linked preferences (debate style, font size, font
// family, color theme, light/dark) — rendered by `UserSettingsPanel`, which
// syncs itself via `/api/settings` — plus the viewer's own AI key and the
// team and school they claim. It used to be its own page, `/settings/preferences` (now a redirect here).
const PREFERENCES_TAB = "preferences"
// UI sound effects, the read-aloud voice and the on-device speech models.
const SOUND_SPEECH_TAB = "sound-speech"
// Tabs folded into General, with the block each one now scrolls to:
// My team (`@debate-ai/rankings-adapter/leaderboard`' MyRankedTeamsSettings) and My school
// (`components/schools/MySchoolSettings`).
const TAB_ALIASES: Record<string, { tab: TabId; anchor: string }> = {
  "my-team": { tab: PREFERENCES_TAB, anchor: "settings-my-team" },
  "my-school": { tab: PREFERENCES_TAB, anchor: "settings-my-school" },
}
// The editor's own General category (workspace, word counts, backup, about
// this install…), listed first under the Editor heading. Its id stays
// `general`, so `?category=general` links land on it; only the label
// changes, to keep it apart from the site's General tab.
const EDITOR_PREFS_LABEL = "Editor prefs"
// The recording release (publish or not, audio only, how the viewer is
// credited), the privacy policy link and data deletion requests
// (`PrivacySettingsSection`).
const PRIVACY_TAB = "privacy"
// The hosted MCP server's URL, its setup guide and the account's API keys
// (`McpServerSection`).
const MCP_TAB = "mcp"
/** A research section's tab id: `research-<section key>` (see `researchTabId`). */
type ResearchTabId = `research-${string}`
type TabId = SettingsCategory | typeof PREFERENCES_TAB | typeof SOUND_SPEECH_TAB | typeof PRIVACY_TAB | typeof MCP_TAB | ResearchTabId
/** A sidebar entry; `group` is the heading it sits under (none for the top block). */
type Category = { id: TabId; label: string; group?: string }

// The research agent's settings sections (`research-agent-ui/settings`'s
// list), listed after the editor's tabs under their own heading. Each renders
// that section's pane in place (`ResearchSettingsTab`); they used to be a
// separate page, `/settings/research/<section>` (now a redirect here).
const RESEARCH_PAGES = researchSettingsPages()
const RESEARCH_TABS: readonly Category[] = RESEARCH_PAGES.map((page) => ({
  id: page.tabId as ResearchTabId,
  label: page.name,
  group: "Research agent",
}))

// Three blocks: the site-wide tabs (General, Sound & speech, Privacy, MCP), the
// editor's tabs under an Editor heading, and the research agent's sections.
// The editor tabs and their order come from `lib/editor-preferences.ts`, so
// the set of categories shown here and the set mirrored to the account
// cannot drift; its General category is relabelled "Editor prefs" rather
// than shown as a second "General".
const CATEGORIES: readonly Category[] = [
  { id: PREFERENCES_TAB, label: "General" },
  { id: SOUND_SPEECH_TAB, label: "Sound & speech" },
  { id: PRIVACY_TAB, label: "Privacy" },
  { id: MCP_TAB, label: "MCP server & API" },
  ...EDITOR_SETTINGS_TABS.map((tab) => ({
    ...tab,
    label: tab.id === "general" ? EDITOR_PREFS_LABEL : tab.label,
    group: "Editor",
  })),
  ...RESEARCH_TABS,
]

/** A `?category=` value as the tab to open and, for a folded-in tab, the block to scroll to. */
function resolveCategory(value: string | null): { tab: string | null; anchor: string | null } {
  const alias = value ? TAB_ALIASES[value] : undefined
  return alias ? alias : { tab: value, anchor: null }
}

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
// categories' descriptions come with Debate Editor's exported tab list.
const CATEGORY_DETAILS: Record<string, { icon: ComponentType<{ size?: number }>; description: string }> = {
  preferences: {
    icon: SlidersHorizontal,
    description:
      "Your plan, debate style, font, theme, tool data sync and own AI key, sidebar animations; your team and school claims.",
  },
  [SOUND_SPEECH_TAB]: {
    icon: Volume2,
    description: "UI sound effects, the read-aloud voice, and the speech models that run on this device.",
  },
  [PRIVACY_TAB]: {
    icon: ShieldCheck,
    description:
      "Whether your recordings can be published, audio only or with video, how you are credited, the privacy policy, and deleting your data.",
  },
  [MCP_TAB]: {
    icon: Plug,
    description: "Connect Claude, ChatGPT, Cursor or another AI tool to Debate AI, and create the API key it signs in with.",
  },
  ...Object.fromEntries(
    DEBATE_EDITOR_SETTINGS_TABS.map((tab) => [tab.id, { icon: DEBATE_EDITOR_TAB_ICONS[tab.id] ?? Settings, description: tab.description }]),
  ),
  ...Object.fromEntries(
    RESEARCH_PAGES.map((page) => [page.tabId, { icon: RESEARCH_ICONS[page.key] ?? Search, description: page.description }]),
  ),
}

// `dai-` rather than the editor's `pmd-` prefix: its stylesheet already
// styles `.pmd-settings-sidebar` for its own modal.
const SIDEBAR_CSS = `
.dai-settings-shell { display: flex; height: 100%; min-height: 0; }
.dai-settings-sidebar { width: 240px; flex-shrink: 0; height: 100%; display: flex; flex-direction: column;
  box-sizing: border-box; padding: 12px; overflow-y: auto;
  border-right: 1px solid var(--pmd-border, rgba(127, 127, 127, 0.25)); }
.dai-settings-sidebar-nav { flex: 1; }
.dai-settings-main { flex: 1; min-width: 0; height: 100%; overflow-y: auto; box-sizing: border-box; padding: 12px 24px 24px; }
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
.dai-settings-footer { margin-top: 16px; padding-top: 10px; display: flex; flex-wrap: wrap; gap: 2px 4px;
  border-top: 1px solid var(--pmd-border, rgba(127, 127, 127, 0.25)); }
.dai-settings-footer-link { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 6px;
  color: inherit; font-size: 12px; text-decoration: none; opacity: 0.65; }
.dai-settings-footer-link:hover { background: rgba(127, 127, 127, 0.12); opacity: 1; }
@media (max-width: 640px) {
  .dai-settings-shell { flex-direction: column; height: auto; }
  .dai-settings-sidebar { width: 100%; height: auto; border-right: none;
    border-bottom: 1px solid var(--pmd-border, rgba(127, 127, 127, 0.25)); }
  .dai-settings-main { height: auto; overflow: visible; padding: 12px 16px 24px; }
}
`

/**
 * The host's own tabs, slotted in right after General. Read when the
 * panel renders, since hosts configure themselves before the first render.
 */
function useCategories() {
  return useMemo(() => {
    const sections = getHostConfig().settingsSections ?? []
    const categories: Category[] = [...CATEGORIES]
    categories.splice(1, 0, ...sections.map(({ id, label }) => ({ id: id as TabId, label })))
    const details = { ...CATEGORY_DETAILS }
    for (const section of sections) {
      details[section.id] = { icon: section.icon ?? Settings, description: section.description }
    }
    return { categories, details, sections }
  }, [])
}

/**
 * The site's footer links (`FOOTER_LINKS` from `@debate-ai/videos`, the same
 * list the app sidebar's footer and the dock's Site Links menu read), pinned
 * to the bottom of the settings sidebar. App routes go through `Link`; the
 * help docs and outside sites get a real page load (see `hardNavigate`).
 */
function SettingsSidebarFooter() {
  return (
    <nav className="dai-settings-footer" aria-label="Site links">
      {SITE_LINKS.map((link) => {
        const isExternal = link.url.startsWith("http")
        const content = (
          <>
            <link.icon size={13} className="h-[13px] w-[13px]" />
            <span>{link.text}</span>
          </>
        )
        return isExternal || link.hardNavigate ? (
          <a
            key={link.text}
            href={link.url}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="dai-settings-footer-link"
          >
            {content}
          </a>
        ) : (
          <Link key={link.text} href={link.url} className="dai-settings-footer-link">
            {content}
          </Link>
        )
      })}
    </nav>
  )
}

/** A titled block inside a tab, with an id `?category=` aliases scroll to. */
function SettingsGroup({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} style={{ marginBottom: 24, scrollMarginTop: 12 }}>
      <h3
        style={{
          margin: "0 0 10px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          opacity: 0.55,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

/**
 * @param sidebarHeader Rendered above the search box at the top of the
 *   sidebar (the settings page puts its Back link there).
 */
export function EditorSettingsPanel({ sidebarHeader }: { sidebarHeader?: ReactNode } = {}) {
  // The panel reads `?category=` with useSearchParams(), which needs a
  // Suspense boundary or a statically rendered page fails to render.
  return (
    <Suspense fallback={null}>
      <EditorSettingsPanelContent sidebarHeader={sidebarHeader} />
    </Suspense>
  )
}

function EditorSettingsPanelContent({ sidebarHeader }: { sidebarHeader?: ReactNode }) {
  const searchParams = useSearchParams()
  const { categories, details, sections } = useCategories()
  const isTabId = (value: string | null): value is TabId => categories.some((category) => category.id === value)
  const requestedCategory = searchParams.get("category")
  const requested = resolveCategory(requestedCategory)
  const [active, setActive] = useState<TabId>(isTabId(requested.tab) ? requested.tab : PREFERENCES_TAB)
  // Follow `?category=` when it changes under a mounted page — the research
  // agent's "open settings" pushes `/settings?category=research-…`.
  useEffect(() => {
    if (isTabId(requested.tab)) setActive(requested.tab)
  }, [requestedCategory])
  // A folded-in tab (`?category=my-school`, …) opens General scrolled to its
  // block. Retried briefly, since some blocks render only once data loads.
  useEffect(() => {
    if (!requested.anchor) return
    let tries = 0
    const timer = window.setInterval(() => {
      const el = document.getElementById(requested.anchor!)
      if (el || ++tries > 20) window.clearInterval(timer)
      el?.scrollIntoView({ block: "start" })
    }, 100)
    return () => window.clearInterval(timer)
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
  const { user } = useSession()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      ({ id, label }) => label.toLowerCase().includes(q) || details[id]?.description.toLowerCase().includes(q),
    )
  }, [query, categories, details])
  const activeCategory = categories.find((category) => category.id === active)
  const activeHostSection = sections.find((section) => section.id === active)

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "100%" }}>
      <style>{SIDEBAR_CSS}</style>
      <div className="dai-settings-shell">
        <div className="dai-settings-sidebar" role="navigation" aria-label="Settings">
          {sidebarHeader}
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
            className="dai-settings-sidebar-nav"
            style={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            {filtered.length === 0 && (
              <p style={{ fontSize: 13, opacity: 0.6, padding: "6px 10px", margin: 0 }}>
                No settings match &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
            {filtered.map(({ id, label }, index) => {
              const Icon = details[id]?.icon ?? Settings
              const group = filtered[index].group
              const startsGroup = group !== undefined && group !== filtered[index - 1]?.group
              return (
                <div key={id} style={{ display: "contents" }}>
                  {startsGroup && (
                    <p className="dai-settings-group" role="presentation">
                      {group}
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
          <SettingsSidebarFooter />
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
            <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.6 }}>{details[active]?.description}</p>
          </div>
          {activeHostSection ? (
            <activeHostSection.component />
          ) : researchSectionOfTab(active) !== null ? (
            <ResearchSettingsTab section={researchSectionOfTab(active)!} />
          ) : active === MCP_TAB ? (
            <McpServerSection signedIn={Boolean(user)} />
          ) : active === PRIVACY_TAB ? (
            <PrivacySettingsSection accountName={user?.name ?? null} />
          ) : active === SOUND_SPEECH_TAB ? (
            <>
              <SoundEffectsSection />
              <ReadAloudVoiceSection />
              <OnDeviceModelsSection />
            </>
          ) : active === PREFERENCES_TAB ? (
            <>
              <SettingsGroup title="Account & display">
                <UserSettingsPanel embedded />
                <SavedDataSection />
                <OwnAiKeySection />
                <SidebarIconAnimationsSection />
              </SettingsGroup>
              <SettingsGroup id="settings-my-team" title="My team">
                <MyRankedTeamsSettings />
                <TeamCoachingSection />
              </SettingsGroup>
              <SettingsGroup id="settings-my-school" title="My school">
                <MySchoolSettings />
              </SettingsGroup>
            </>
          ) : (
            // One category at a time: the editor ties each row's store
            // subscription to the panel built last, so switching tabs
            // rebuilds from the store rather than revealing a stale render.
            ready ? (
              <DebateEditorSettingsSection category={active as SettingsCategory} onRowsRendered={noteRenderedKeys} />
            ) : (
              <p style={{ fontSize: 14, opacity: 0.7 }}>Loading…</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
