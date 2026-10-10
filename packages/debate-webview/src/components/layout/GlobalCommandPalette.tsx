"use client"

/**
 * @fileoverview App-wide `Ctrl`/`Cmd`-K search palette.
 *
 * The Reason Editor already has its own Search Everything palette
 * (`packages/debate-editor`'s `quick-card-search-ui.ts`), whose `t` prefix
 * jumps to any of the app's other tools — but that palette only exists inside
 * the CardMirror engine, so every feature doc's "Nav: … in Ctrl/Cmd-K's
 * search palette" line was only true while the Reason Editor happened to be
 * open. Everywhere else in the app — `/tools`, `/settings`, `/practice/judges`, the
 * community and coaching hubs — the same shortcut did nothing.
 *
 * This is that shortcut's app-wide counterpart: a lighter, navigation-only
 * palette (no quick cards, no ribbon commands, no file search — those stay
 * the editor's own) built from the same catalog `/tools` and the favorites
 * system already share (`app/tools/tool-groups.ts`'s `ALL_TOOLS`), so a
 * tool typed here, starred on `/tools`, or linked from the editor's
 * Workspace menu all resolve to the one list. Mounted once per document by
 * {@link AppShell} (in both its branches, matching
 * {@link ToolRecordSyncProvider}'s reach), so the shortcut works whether or
 * not another site has framed the app — except on
 * `/reason-editor`, where the CardMirror engine's own richer palette already
 * owns it.
 *
 * Two views: with an empty query it browses (Favorites, Recent, Go to, then
 * the catalog by group); once something is typed it switches to one flat
 * list ranked by fuse.js with the matched characters marked, and starred
 * tools rank like any other rather than being pinned or re-listed.
 *
 * @module components/layout/GlobalCommandPalette
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Clock, CornerDownLeft, LayoutGrid, Rss, SearchX, Settings as SettingsIcon, Star } from "lucide-react"
import { playUISoundEffect } from "@debate/timer"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../lib/ui/primitives/command"
import { cn } from "../../lib/ui/lib/utils"
import { TOOL_GROUPS, ALL_TOOLS, type Tool } from "../../routes/tools/tool-groups"
import { useFavoriteTools } from "../../lib/hooks/useFavoriteTools"
import { useRecentTools } from "../../lib/hooks/useRecentTools"
import { onQuickLaunchText } from "../../lib/native/tauri"
import {
  createPaletteIndex,
  searchPalette,
  splitByRanges,
  type MatchRange,
  type PaletteEntry,
} from "./command-palette-search"

/** Meta destinations that aren't themselves a `/tools` catalog entry. */
const QUICK_ACTIONS: Tool[] = [
  { href: "/practice/features", label: "All Features", description: "Every user-facing surface in the app, with docs", icon: LayoutGrid },
  { href: "/news", label: "News Stream", description: "Product updates and community announcements", icon: Rss },
  { href: "/settings", label: "Settings", description: "Card editor settings — files, editing, appearance, shortcuts, AI", icon: SettingsIcon },
]

/** Routes where the CardMirror editor engine mounts its own, richer
 *  Ctrl/Cmd-P palette — this one stands down there rather than
 *  fighting over the same shortcut. */
function ownedByEditor(pathname: string): boolean {
  return pathname === "/reason-editor" || pathname.startsWith("/reason-editor/")
}

/** Fired to open the palette from somewhere that isn't the keyboard shortcut
 *  itself — the dock's Settings menu, so a mouse-only user can find it too. */
const OPEN_EVENT = "debate-ai:open-command-palette"

/** Opens the app-wide command palette from any component in the tree,
 *  without threading its `open` state through props. Safe to call before
 *  {@link GlobalCommandPalette} has mounted (or on a route where it stands
 *  down for the editor) — nothing is listening yet, so it's a no-op. */
export function openGlobalCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** True for the palette-opening chord: Cmd-K on a Mac, Ctrl-K elsewhere.
 *
 *  K, not P: the palette is a search box first (every entry is a destination,
 *  and `CommandInput` has focus the moment it opens), and Cmd-K is the chord
 *  readers already reach for from Raycast/Slack/Linear and most browser
 *  extensions. Cmd-P is still accepted as an alias so the chord the docs used
 *  to advertise keeps working. Shift/Alt variants are left alone. */
export function isPaletteShortcut(e: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "code" | "key">): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return false
  const code = e.code
  const key = e.key.toLowerCase()
  return code === "KeyK" || key === "k" || code === "KeyP" || key === "p"
}

/** Heading for {@link QUICK_ACTIONS} — both as a browse-view group and as
 *  the group badge on a search result. */
const QUICK_ACTIONS_GROUP = "Go to"

/** Renders `text` with its matched ranges as `<mark>`s. */
function Highlighted({ text, ranges }: { text: string; ranges: MatchRange[] }) {
  if (ranges.length === 0) return <>{text}</>
  return (
    <>
      {splitByRanges(text, ranges).map((seg, i) =>
        seg.match ? (
          <mark key={i} className="rounded-[3px] bg-amber-200/70 px-px text-foreground dark:bg-amber-400/25 dark:text-amber-100">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

/** One palette row: icon tile, label + description, an optional trailing
 *  badge, and an Enter hint that appears on the selected row. */
function PaletteRow({
  value,
  icon,
  label,
  description,
  trailing,
  onSelect,
}: {
  value: string
  icon: ReactNode
  label: ReactNode
  description: ReactNode
  trailing?: ReactNode
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      className="group/row gap-3 rounded-lg !px-2.5 !py-2 data-[selected=true]:bg-accent/70"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background shadow-xs group-data-[selected=true]/row:border-primary/30 group-data-[selected=true]/row:text-primary [&_svg]:!size-[18px]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight">{label}</span>
        <span className="mt-0.5 block truncate text-xs leading-tight text-muted-foreground">{description}</span>
      </span>
      {trailing}
      <CornerDownLeft className="hidden !size-3.5 shrink-0 text-muted-foreground group-data-[selected=true]/row:block" />
    </CommandItem>
  )
}

function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground", className)}>
      {children}
    </kbd>
  )
}

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState("")
  const router = useRouter()
  const pathname = usePathname()
  const { favorites } = useFavoriteTools()
  const { recent, recordVisit } = useRecentTools()

  useEffect(() => {
    return onQuickLaunchText((text) => {
      if (text) {
        setSearch(text)
      }
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return
      if (ownedByEditor(pathname)) return
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pathname])

  useEffect(() => {
    if (ownedByEditor(pathname)) return
    const onOpenEvent = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpenEvent)
    return () => window.removeEventListener(OPEN_EVENT, onOpenEvent)
  }, [pathname])

  // Each opening starts from the browse view, not the last query.
  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  // A sound confirms the palette opening or closing — the
  // Ctrl/Cmd-K chord, the dock's Search row and the Esc key
  // all land here. The first run (mount) is skipped.
  const prevOpen = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevOpen.current === null) {
      prevOpen.current = open
      return
    }
    if (prevOpen.current !== open) {
      playUISoundEffect(open ? "popUpOn" : "popDown")
      prevOpen.current = open
    }
  }, [open])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
      // Only cataloged tools build "Recent" — QUICK_ACTIONS destinations
      // (Settings, News, …) aren't themselves a tool to resurface here.
      if (ALL_TOOLS.some((t) => t.href === href)) recordVisit(href)
    },
    [router, recordVisit],
  )

  const favoriteTools = useMemo(
    () => favorites.map((href) => ALL_TOOLS.find((t) => t.href === href)).filter((t): t is Tool => t !== undefined),
    [favorites],
  )

  const recentTools = useMemo(
    () =>
      recent
        .filter((href) => !favorites.includes(href))
        .map((href) => ALL_TOOLS.find((t) => t.href === href))
        .filter((t): t is Tool => t !== undefined)
        .slice(0, 5),
    [recent, favorites],
  )

  // One entry per destination (a tool listed under two headings is still
  // one result), searched by fuse.js — see `command-palette-search.ts`.
  const index = useMemo(() => {
    const seen = new Set<string>()
    const entries: PaletteEntry<Tool>[] = []
    const add = (tool: Tool, group: string) => {
      if (seen.has(tool.href)) return
      seen.add(tool.href)
      entries.push({ href: tool.href, label: tool.label, description: tool.description, highlights: tool.highlights, group, data: tool })
    }
    QUICK_ACTIONS.forEach((tool) => add(tool, QUICK_ACTIONS_GROUP))
    TOOL_GROUPS.forEach((group) => group.tools.forEach((tool) => add(tool, group.heading)))
    return createPaletteIndex(entries)
  }, [])

  const query = search.trim()
  const results = useMemo(() => searchPalette(index, query), [index, query])

  // cmdk's own filter is off (we rank), so keep its selection on the best
  // hit as results change rather than on a row that may have moved.
  const firstBrowseValue = favoriteTools[0]
    ? `fav-${favoriteTools[0].href}`
    : recentTools[0]
      ? `recent-${recentTools[0].href}`
      : `go-${QUICK_ACTIONS[0].href}`
  useEffect(() => {
    setSelected(query ? (results[0]?.entry.href ?? "") : firstBrowseValue)
  }, [query, results, firstBrowseValue])

  if (ownedByEditor(pathname)) return null

  const browseRow = (tool: Tool, prefix: string, icon: ReactNode) => (
    <PaletteRow
      key={`${prefix}-${tool.href}`}
      value={`${prefix}-${tool.href}`}
      icon={icon}
      label={tool.label}
      description={tool.description}
      onSelect={() => go(tool.href)}
    />
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Jump to any tool, workspace, or settings page"
      showCloseButton={false}
      className="top-[12%] translate-y-0 gap-0 rounded-xl border shadow-2xl sm:max-w-2xl"
      commandProps={{ shouldFilter: false, loop: true, value: selected, onValueChange: setSelected }}
    >
      <div className="relative">
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search tools, workspaces, and settings…"
          className="h-12 pr-12 text-base"
        />
        <Kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">Esc</Kbd>
      </div>
      <CommandList className="max-h-[min(60vh,480px)] px-1 py-1.5">
        {query ? (
          <>
            <CommandEmpty className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
              <SearchX className="size-8 opacity-40" />
              <span>
                No results for <span className="font-medium text-foreground">“{query}”</span>
              </span>
            </CommandEmpty>
            {results.length > 0 && (
              <CommandGroup heading={`${results.length} result${results.length === 1 ? "" : "s"}`}>
                {results.map(({ entry, labelRanges, descriptionRanges }) => {
                  const Icon = entry.data.icon
                  return (
                    <PaletteRow
                      key={entry.href}
                      value={entry.href}
                      icon={<Icon />}
                      label={<Highlighted text={entry.label} ranges={labelRanges} />}
                      description={<Highlighted text={entry.description} ranges={descriptionRanges} />}
                      trailing={
                        <span className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                          {entry.group}
                        </span>
                      }
                      onSelect={() => go(entry.href)}
                    />
                  )
                })}
              </CommandGroup>
            )}
          </>
        ) : (
          <>
            {favoriteTools.length > 0 && (
              <CommandGroup heading="Favorites">
                {favoriteTools.map((tool) => browseRow(tool, "fav", <Star className="fill-amber-400 text-amber-500" />))}
              </CommandGroup>
            )}
            {recentTools.length > 0 && (
              <CommandGroup heading="Recent">
                {recentTools.map((tool) => browseRow(tool, "recent", <Clock />))}
              </CommandGroup>
            )}
            <CommandGroup heading={QUICK_ACTIONS_GROUP}>
              {QUICK_ACTIONS.map((tool) => browseRow(tool, "go", <tool.icon />))}
            </CommandGroup>
            {TOOL_GROUPS.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.tools.map((tool) => browseRow(tool, group.heading, <tool.icon />))}
              </CommandGroup>
            ))}
          </>
        )}
      </CommandList>
      <div className="flex items-center gap-4 border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd> toggle
        </span>
      </div>
    </CommandDialog>
  )
}
