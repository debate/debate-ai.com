"use client"

/**
 * @fileoverview App-wide `Ctrl`/`Cmd`-K search palette.
 *
 * The Reason Editor already has its own Search Everything palette
 * (`packages/debate-editor`'s `quick-card-search-ui.ts`), whose `t` prefix
 * jumps to any of the app's other tools — but that palette only exists inside
 * the Debate Editor engine, so every feature doc's "Nav: … in Ctrl/Cmd-K's
 * search palette" line was only true while the Reason Editor happened to be
 * open. Everywhere else in the app — `/tools`, `/settings`, `/practice/judges`, the
 * community and coaching hubs — the same shortcut did nothing.
 *
 * This is that shortcut's app-wide counterpart: a lighter palette (no quick
 * cards or ribbon commands — those stay the editor's own) built from the same
 * catalog `/tools` and the favorites
 * system already share (`app/tools/tool-groups.ts`'s `ALL_TOOLS`), so a
 * tool typed here, starred on `/tools`, or linked from the editor's
 * Workspace menu all resolve to the one list. Mounted once per document by
 * {@link AppShell} (in both its branches, matching
 * {@link ToolRecordSyncProvider}'s reach), so the shortcut works whether or
 * not another site has framed the app. On `/reason-editor` the Debate Editor
 * engine's own palette keeps Ctrl/Cmd-P; this one answers Ctrl/Cmd-K there.
 *
 * It also searches the docs sidebar's files — the reader's own and the public
 * Topic Starters — by name, outline heading *and* contents
 * (`lib/reason-docs/file-search.ts`), listed under "Files" below the tools;
 * picking one opens it in the editor. The text of a `.cmir` file comes from
 * Debate Editor's engine, which is loaded on demand the first time a query needs
 * it. And it searches the whole video library — rounds and lectures — through
 * the Videos page's own `/api/videos` feed (`lib/videos/video-palette-search.ts`),
 * listed under "Videos & Lectures"; picking one opens its watch page.
 *
 * Two views: with an empty query it browses (Favorites, Recent, Go to, then
 * the catalog by group); once something is typed it switches to one flat
 * list ranked by fuse.js with the matched characters marked, and starred
 * tools rank like any other rather than being pinned or re-listed.
 *
 * @module components/layout/command-palette/GlobalCommandPalette
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { BookOpen, Clock, CornerDownLeft, FileText, GraduationCap, LayoutGrid, PlayCircle, Rss, SearchX, Settings as SettingsIcon, Star } from "lucide-react"
import { playUISoundEffect } from "@debate-ai/timer"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@debate-ai/ui/primitives/command"
import { cn } from "@debate-ai/ui/lib/utils"
import { TOOL_GROUPS, ALL_TOOLS, type Tool } from "../../../routes/tools/tool-groups"
import { useFavoriteTools } from "../../../lib/hooks/useFavoriteTools"
import { useRecentTools } from "../../../lib/hooks/useRecentTools"
import { onQuickLaunchText } from "../../../lib/native/tauri"
import { useOptionalReasonDocs } from "../../reason-docs/ReasonDocsProvider"
import type { TopicStarterItem } from "../../reason-docs/topic-starters/TopicStarterTree"
import type { ReasonDocument } from "../../reason-docs/types"
import {
  folderPathOf,
  htmlHeadings,
  htmlToPlainText,
  searchFiles,
  type FileSearchEntry,
} from "../../../lib/reason-docs/file-search"
import { editorHrefForSelection, isEditorPathname } from "../../../lib/reason-docs/route-selection"
import { isCmirContent } from "../../../lib/debate-editor/content-format"
import { loadStoredCmir, storedCmirIfLoaded, type StoredCmir } from "../../../lib/debate-editor/lazy-stored-cmir"
import { fetchPaletteVideos, type PaletteVideo } from "../../../lib/videos/video-palette-search"
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
  { href: "/news", label: "News & Forums", description: "Product updates, community announcements and forum threads", icon: Rss },
  { href: "/settings", label: "Settings", description: "Card editor settings — files, editing, appearance, shortcuts, AI", icon: SettingsIcon },
]

/** Routes where Debate Editor engine mounts its own, richer
 *  Ctrl/Cmd-P palette — this one leaves Ctrl/Cmd-P to it there and answers
 *  only Ctrl/Cmd-K, so the two never fight over one chord. */
function ownedByEditor(pathname: string): boolean {
  return isEditorPathname(pathname)
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

/** True for the K half of {@link isPaletteShortcut} — the only chord this
 *  palette answers on the editor route, where Ctrl/Cmd-P is the engine's. */
export function isKShortcut(e: Pick<KeyboardEvent, "code" | "key">): boolean {
  return e.code === "KeyK" || e.key.toLowerCase() === "k"
}

/** Text and outline headings of one file. */
interface FileBody {
  text: string
  headings: string[]
}

const EMPTY_BODY: FileBody = { text: "", headings: [] }

/** The sidebar files as search rows, text and outline included. Each row's
 *  body is cached on the row object, so a keystroke re-ranks without
 *  re-converting every file; a changed row is a new object and is converted
 *  again. */
const fileBodyCache = new WeakMap<object, FileBody>()

function fileBody(row: object, toHtml: () => string): FileBody {
  const cached = fileBodyCache.get(row)
  if (cached !== undefined) return cached
  const html = toHtml()
  const body = { text: htmlToPlainText(html), headings: htmlHeadings(html) }
  // An empty result while the engine is still loading isn't cached, so the
  // row is converted properly once it arrives.
  if (body.text) fileBodyCache.set(row, body)
  return body
}

function buildFileEntries(
  documents: readonly ReasonDocument[],
  topics: readonly TopicStarterItem[],
  documentHtml: (doc: ReasonDocument) => string,
  engine: StoredCmir | null,
): FileSearchEntry[] {
  const entries: FileSearchEntry[] = []
  for (const doc of documents) {
    if (doc.isFolder) continue
    entries.push({
      kind: "document",
      id: doc.id,
      title: doc.title || "Untitled",
      folder: folderPathOf(documents, doc),
      ...fileBody(doc, () => documentHtml(doc)),
    })
  }
  for (const item of topics) {
    if (item.isFolder) continue
    const body = isCmirContent(item)
      ? engine
        ? fileBody(item, () => engine.storedContentToHtml(item))
        : EMPTY_BODY
      : fileBody(item, () => item.content ?? "")
    entries.push({ kind: "topic", id: item.id, title: item.title, folder: folderPathOf(topics, item), ...body })
  }
  return entries
}

/** How long typing must pause before the palette asks for videos. */
const VIDEO_SEARCH_DELAY_MS = 200

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
  const docs = useOptionalReasonDocs()
  const [engine, setEngine] = useState<StoredCmir | null>(storedCmirIfLoaded)

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
      // On the editor, Ctrl/Cmd-P is the engine's palette, and a Ctrl/Cmd-K
      // the editor already handled (a chord pad) is left to it.
      if (ownedByEditor(pathname) && (!isKShortcut(e) || e.defaultPrevented)) return
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pathname])

  useEffect(() => {
    const onOpenEvent = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpenEvent)
    return () => window.removeEventListener(OPEN_EVENT, onOpenEvent)
  }, [])

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

  // The files only matter once the palette is open; opening it is what
  // fetches them, the same lazy load the sidebar does when it is expanded.
  const ensureDocsLoaded = docs?.ensureLoaded
  useEffect(() => {
    if (open) ensureDocsLoaded?.()
  }, [open, ensureDocsLoaded])

  const documents = docs?.documents
  const topicItems = docs?.topicItems
  const documentHtml = docs?.documentHtml
  // A `.cmir` file's text needs Debate Editor's engine; it is fetched the first
  // time a query could match one, not when the palette opens.
  const needsEngine =
    open &&
    Boolean(query) &&
    !engine &&
    Boolean(documents?.some(isCmirContent) || topicItems?.some(isCmirContent))
  useEffect(() => {
    if (!needsEngine) return
    let cancelled = false
    void loadStoredCmir()
      .then((loaded) => {
        if (!cancelled) setEngine(loaded)
      })
      .catch(() => {
        // Names still match without the engine; only `.cmir` bodies don't.
      })
    return () => {
      cancelled = true
    }
  }, [needsEngine])

  const fileEntries = useMemo(
    () =>
      open && query && documentHtml
        ? buildFileEntries(documents ?? [], topicItems ?? [], documentHtml, engine)
        : [],
    [open, query, documents, topicItems, documentHtml, engine],
  )
  const fileResults = useMemo(() => searchFiles(fileEntries, query), [fileEntries, query])

  // Videos come from the server one small page per query, a beat after the
  // typing stops so a word typed letter by letter is one request, not five.
  const [videoResults, setVideoResults] = useState<{ query: string; videos: PaletteVideo[] }>({ query: "", videos: [] })
  useEffect(() => {
    if (!open || query.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchPaletteVideos(query, controller.signal)
        .then((videos) => setVideoResults({ query, videos }))
        .catch(() => {
          if (!controller.signal.aborted) setVideoResults({ query, videos: [] })
        })
    }, VIDEO_SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])
  // Results for an older query are dropped rather than shown under a new one.
  const videos = open && videoResults.query === query ? videoResults.videos : []

  const openFile = useCallback(
    (entry: FileSearchEntry) => {
      setOpen(false)
      if (!docs) return
      if (entry.kind === "document") {
        docs.openDocument(entry.id)
        router.push(editorHrefForSelection({ kind: "document", id: entry.id }, docs.documents))
      } else {
        const item = docs.topicItems.find((t) => t.id === entry.id)
        if (item) docs.selectTopicDocument(item)
        router.push(editorHrefForSelection({ kind: "topic", id: entry.id }, docs.topicItems))
      }
    },
    [docs, router],
  )

  // cmdk's own filter is off (we rank), so keep its selection on the best
  // hit as results change rather than on a row that may have moved.
  const firstBrowseValue = favoriteTools[0]
    ? `fav-${favoriteTools[0].href}`
    : recentTools[0]
      ? `recent-${recentTools[0].href}`
      : `go-${QUICK_ACTIONS[0].href}`
  const firstFileValue = fileResults[0] ? `file-${fileResults[0].entry.kind}-${fileResults[0].entry.id}` : ""
  const firstVideoValue = videos[0] ? `video-${videos[0].id}` : ""
  useEffect(() => {
    setSelected(query ? (results[0]?.entry.href ?? (firstFileValue || firstVideoValue)) : firstBrowseValue)
  }, [query, results, firstFileValue, firstVideoValue, firstBrowseValue])

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
      description="Jump to any tool, workspace, settings page, file, or video"
      showCloseButton={false}
      className="top-[12%] translate-y-0 gap-0 rounded-xl border shadow-2xl sm:max-w-2xl"
      commandProps={{ shouldFilter: false, loop: true, value: selected, onValueChange: setSelected }}
    >
      <div className="relative">
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search tools, files, videos, and lectures…"
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
            {fileResults.length > 0 && (
              <CommandGroup heading="Files">
                {fileResults.map(({ entry, snippet, heading }) => {
                  const location = [entry.kind === "topic" ? "Topic Starters" : "My files", entry.folder]
                    .filter(Boolean)
                    .join(" / ")
                  return (
                    <PaletteRow
                      key={`file-${entry.kind}-${entry.id}`}
                      value={`file-${entry.kind}-${entry.id}`}
                      icon={entry.kind === "topic" ? <BookOpen /> : <FileText />}
                      label={entry.title}
                      description={heading ? `§ ${heading}${location ? ` · ${location}` : ""}` : (snippet ?? location)}
                      trailing={
                        <span className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                          {entry.kind === "topic" ? "Topic" : "File"}
                        </span>
                      }
                      onSelect={() => openFile(entry)}
                    />
                  )
                })}
              </CommandGroup>
            )}
            {videos.length > 0 && (
              <CommandGroup heading="Videos & Lectures">
                {videos.map((video) => (
                  <PaletteRow
                    key={`video-${video.id}`}
                    value={`video-${video.id}`}
                    icon={video.kind === "lecture" ? <GraduationCap /> : <PlayCircle />}
                    label={video.title}
                    description={video.detail}
                    trailing={
                      <span className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                        {video.kind === "lecture" ? "Lecture" : "Round"}
                      </span>
                    }
                    onSelect={() => {
                      setOpen(false)
                      router.push(video.href)
                    }}
                  />
                ))}
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
