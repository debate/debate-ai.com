"use client"

/**
 * @fileoverview Navigation chrome shared by the tabbed workspace hubs
 * (`ResearchHub.tsx`, `CoachHub.tsx`).
 *
 * The hubs used to render a bare row of pill buttons and then a wall of
 * panels, with no way to link to a section, no hint of what each section
 * was for, and no route from a panel inside the hub back to that panel's
 * own page. This module supplies the missing pieces:
 *
 * - {@link useHubSection}: the active section, synced to `?section=` in the
 *   URL (so a section is shareable and survives reload) and remembered in
 *   localStorage as the fallback when the URL doesn't say.
 * - {@link HubSectionNav}: a sticky, keyboard-navigable tab strip
 *   (`role="tablist"`, arrow keys move between tabs) with an icon per
 *   section; scrolls horizontally on narrow screens instead of wrapping.
 * - {@link HubSectionIntro}: a heading card for the active section — what
 *   it's for, a chip per panel that scrolls to it, an "open as its own page"
 *   link per panel that has one, and a link to the docs guide.
 * - {@link HubPanelAnchor}: the wrapper that gives each panel its chip target.
 *
 * @module components/hubs/HubSectionNav
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BookOpen, ExternalLink } from "lucide-react"
import { cn, setStateInURL } from "@/lib/ui/lib/utils"
import { DOCS_GUIDE_TITLES, guideDocsUrl } from "@/lib/docs-links"
import { resolveSectionId, type HubSection } from "./hub-sections"

/** URL query parameter carrying the active section. */
const SECTION_PARAM = "section"

/**
 * Active-section state for a hub, read from `?section=` first, then from
 * localStorage, then the first section.
 *
 * @param sections - The hub's sections.
 * @param storageKey - localStorage key remembering the last section.
 */
export function useHubSection<Id extends string>(
  sections: readonly HubSection<Id>[],
  storageKey: string,
): [Id, (id: Id) => void] {
  const params = useSearchParams()
  const fromUrl = params?.get(SECTION_PARAM) ?? null
  const [section, setSectionState] = useState<Id>(() => resolveSectionId(sections, fromUrl))

  // Only the URL is available during render; the remembered section is a
  // client-only fallback, applied after mount so the server markup matches.
  useEffect(() => {
    if (fromUrl) return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setSectionState(resolveSectionId(sections, saved))
    } catch {
      // Private mode or blocked storage: keep the default.
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSection = useCallback(
    (id: Id) => {
      setSectionState(id)
      setStateInURL({ [SECTION_PARAM]: id })
      try {
        localStorage.setItem(storageKey, id)
      } catch {
        // Ignore storage failures; the URL still carries the section.
      }
    },
    [storageKey],
  )

  return [section, setSection]
}

/** Props for {@link HubSectionNav}. */
export interface HubSectionNavProps<Id extends string> {
  /** Sections to render, in tab order. */
  sections: readonly HubSection<Id>[]
  /** Currently active section id. */
  active: Id
  /** Called with the id of the tab the user picked. */
  onChange: (id: Id) => void
  /** Accessible name for the tab list. */
  label: string
}

/**
 * Sticky tab strip over a hub's sections.
 *
 * @param props - See {@link HubSectionNavProps}.
 */
export function HubSectionNav<Id extends string>({ sections, active, onChange, label }: HubSectionNavProps<Id>) {
  const tabRefs = useRef<Map<Id, HTMLButtonElement>>(new Map())

  const focusTab = (id: Id) => {
    tabRefs.current.get(id)?.focus()
    onChange(id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = sections.length - 1
    let next: number | null = null
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = last
    if (next === null) return
    event.preventDefault()
    focusTab(sections[next].id)
  }

  return (
    <div className="sticky top-0 z-20 -mx-3 border-b border-border bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6">
      <div role="tablist" aria-label={label} className="scrollbar-hide flex gap-1 overflow-x-auto">
        {sections.map((section, index) => {
          const selected = section.id === active
          const Icon = section.icon
          return (
            <button
              key={section.id}
              ref={(node) => {
                if (node) tabRefs.current.set(section.id, node)
                else tabRefs.current.delete(section.id)
              }}
              type="button"
              role="tab"
              id={`hub-tab-${section.id}`}
              aria-selected={selected}
              aria-controls={`hub-panel-${section.id}`}
              tabIndex={selected ? 0 : -1}
              title={section.description}
              onClick={() => onChange(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {section.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  selected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                )}
                aria-label={`${section.panels.length} panels`}
              >
                {section.panels.length}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Props for {@link HubSectionIntro}. */
export interface HubSectionIntroProps {
  /** The active section. */
  section: HubSection
  /** Extra controls rendered on the right of the heading (e.g. a round picker). */
  actions?: ReactNode
}

/**
 * Heading card for the active section: purpose, panel chips, docs link.
 *
 * @param props - See {@link HubSectionIntroProps}.
 */
export function HubSectionIntro({ section, actions }: HubSectionIntroProps) {
  const Icon = section.icon
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold leading-tight">{section.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {section.guide ? (
            <a
              href={guideDocsUrl(section.guide)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {DOCS_GUIDE_TITLES[section.guide]}
            </a>
          ) : null}
        </div>
      </div>

      <nav aria-label={`Panels in ${section.label}`} className="flex flex-wrap gap-1.5">
        {section.panels.map((item) => (
          <span
            key={item.anchor}
            className="inline-flex items-stretch overflow-hidden rounded-full border border-border bg-background text-xs font-medium"
          >
            <a href={`#${item.anchor}`} className="px-2.5 py-1 text-foreground transition-colors hover:bg-accent">
              {item.label}
            </a>
            {item.href ? (
              <Link
                href={item.href}
                title={`Open ${item.label} as its own page`}
                aria-label={`Open ${item.label} as its own page`}
                className="flex items-center border-l border-border px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : null}
          </span>
        ))}
      </nav>
    </div>
  )
}

/** Props for {@link HubPanelAnchor}. */
export interface HubPanelAnchorProps {
  /** Anchor id, from the section's {@link HubPanelLink.anchor}. */
  anchor: string
  /** The panel. */
  children: ReactNode
}

/**
 * Wraps a panel so the section intro's chips can scroll to it, leaving
 * room for the sticky tab strip above.
 *
 * @param props - See {@link HubPanelAnchorProps}.
 */
export function HubPanelAnchor({ anchor, children }: HubPanelAnchorProps) {
  return (
    <div id={anchor} className="scroll-mt-20">
      {children}
    </div>
  )
}

/** Props for {@link HubSectionPanel}. */
export interface HubSectionPanelProps {
  /** Section id this panel belongs to (pairs with the tab's `aria-controls`). */
  id: string
  /** Section content. */
  children: ReactNode
}

/**
 * The `role="tabpanel"` region a section's panels render into.
 *
 * @param props - See {@link HubSectionPanelProps}.
 */
export function HubSectionPanel({ id, children }: HubSectionPanelProps) {
  return (
    <div role="tabpanel" id={`hub-panel-${id}`} aria-labelledby={`hub-tab-${id}`} className="flex flex-col gap-4">
      {children}
    </div>
  )
}
