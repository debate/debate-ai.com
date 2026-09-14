"use client"

/**
 * @fileoverview App-wide `Ctrl`/`Cmd`-Shift-Space command palette.
 *
 * The Reason Editor already has its own Search Everything palette on this
 * shortcut (`packages/debate-editor`'s `quick-card-search-ui.ts`), whose `t`
 * prefix jumps to any of the app's other tools — but that palette only
 * exists inside the CardMirror engine, so every feature doc's "Nav: … in
 * Ctrl/Cmd-Shift-Space's command palette" line was only true while the
 * Reason Editor happened to be open. Everywhere else in the app — `/tools`,
 * `/settings`, `/judges`, the community and coaching hubs — the same
 * shortcut did nothing.
 *
 * This is that shortcut's app-wide counterpart: a lighter, navigation-only
 * palette (no quick cards, no ribbon commands, no file search — those stay
 * the editor's own) built from the same catalog `/tools` and the favorites
 * system already share (`app/tools/tool-groups.ts`'s `ALL_TOOLS`), so a
 * tool typed here, starred on `/tools`, or linked from the editor's
 * Workspace menu all resolve to the one list. Mounted once per document by
 * {@link AppShell} (both the top-level shell and each framed dock
 * destination, matching {@link ToolRecordSyncProvider}'s reach), so the
 * shortcut works whichever document currently has focus — except on
 * `/reason-editor`, where the CardMirror engine's own richer palette already
 * owns it.
 *
 * @module components/layout/GlobalCommandPalette
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Clock, LayoutGrid, Rss, Settings as SettingsIcon, Star } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/lib/ui/primitives/command"
import { TOOL_GROUPS, ALL_TOOLS, type Tool } from "@/app/tools/tool-groups"
import { useFavoriteTools } from "@/lib/hooks/useFavoriteTools"
import { useRecentTools } from "@/lib/hooks/useRecentTools"
import { onQuickLaunchText } from "@/lib/native/tauri"

/** Meta destinations that aren't themselves a `/tools` catalog entry. */
const QUICK_ACTIONS: Tool[] = [
  { href: "/tools", label: "All Tools", description: "Every workspace, research, and practice tool", icon: LayoutGrid },
  { href: "/features", label: "All Features", description: "Every user-facing surface in the app, with docs", icon: LayoutGrid },
  { href: "/news", label: "News Stream", description: "Product updates and community announcements", icon: Rss },
  { href: "/settings", label: "Settings", description: "Account, favorite tools, and preferences", icon: SettingsIcon },
]

/** Routes where the CardMirror editor engine mounts its own, richer
 *  Ctrl/Cmd-Shift-Space palette — this one stands down there rather than
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

/** True for the palette-opening chord: Ctrl/Cmd + Shift + Space. */
function isPaletteShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey && (e.code === "Space" || e.key === " ")
}

function toolHaystack(tool: Tool): string {
  return [tool.label, tool.description, tool.href, ...(tool.highlights ?? [])].join(" ").toLowerCase()
}

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
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
    () => recent.map((href) => ALL_TOOLS.find((t) => t.href === href)).filter((t): t is Tool => t !== undefined),
    [recent],
  )

  // Rendered as-typed by cmdk's own fuzzy filter for label/value, but tool
  // descriptions and highlights carry search terms (a paradigm name, a
  // package word) the visible label doesn't — cmdk only filters on the
  // item's `value`, so this builds that value from the whole haystack.
  const groupsWithHaystack = useMemo(
    () =>
      TOOL_GROUPS.map((group) => ({
        heading: group.heading,
        tools: group.tools.map((tool) => ({ tool, value: toolHaystack(tool) })),
      })),
    [],
  )

  if (ownedByEditor(pathname)) return null

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to any tool, workspace, or settings page"
      className="top-[12%] translate-y-0 sm:max-w-xl"
    >
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Jump to a tool… (Ctrl/Cmd-Shift-Space)"
      />
      <CommandList>
        <CommandEmpty>No matching tool.</CommandEmpty>
        {favoriteTools.length > 0 && (
          <>
            <CommandGroup heading="Favorites">
              {favoriteTools.map((tool) => (
                <CommandItem
                  key={`fav-${tool.href}`}
                  value={`favorite ${toolHaystack(tool)}`}
                  onSelect={() => go(tool.href)}
                >
                  <Star className="fill-current text-amber-500" />
                  <span className="flex-1 truncate">{tool.label}</span>
                  <CommandShortcut className="hidden sm:inline">{tool.href}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {recentTools.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentTools.map((tool) => (
                <CommandItem
                  key={`recent-${tool.href}`}
                  value={`recent ${toolHaystack(tool)}`}
                  onSelect={() => go(tool.href)}
                >
                  <Clock className="text-muted-foreground" />
                  <span className="flex-1 truncate">{tool.label}</span>
                  <CommandShortcut className="hidden sm:inline">{tool.href}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Go to">
          {QUICK_ACTIONS.map((tool) => (
            <CommandItem key={tool.href} value={toolHaystack(tool)} onSelect={() => go(tool.href)}>
              <tool.icon />
              <span className="flex-1 truncate">{tool.label}</span>
              <span className="text-muted-foreground hidden truncate text-xs sm:inline">{tool.description}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {groupsWithHaystack.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.tools.map(({ tool, value }) => (
              <CommandItem key={tool.href} value={value} onSelect={() => go(tool.href)}>
                <tool.icon />
                <span className="flex-1 truncate">{tool.label}</span>
                <span className="text-muted-foreground hidden truncate text-xs sm:inline">{tool.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
