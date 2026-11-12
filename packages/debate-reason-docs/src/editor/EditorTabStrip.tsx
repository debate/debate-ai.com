"use client"

/**
 * The tab strip above Debate Editor on `/reason-editor`: one tab per open file
 * — an owned document or a public Topic Starter (`lib/reason-docs/tab-ids.ts`),
 * with a × to close it and a right-click menu — Close, Close others, Close to
 * the right, Close all, Undo close — like a browser's or code editor's tab
 * bar. What each of those does to the open tabs is
 * `lib/reason-docs/tab-actions.ts`; the state is `ReasonDocsProvider`'s.
 *
 * Past five open tabs the least recently used are suspended to save memory
 * (`lib/reason-docs/tab-suspension.ts`): they stay in the strip, dimmed with a
 * moon, and are listed in the "Suspended" dropdown at the strip's end.
 * Clicking one reloads it from its stored content.
 *
 * The menu opens where the pointer was: an invisible trigger inside the tab
 * is moved under the cursor before the menu opens, so Radix anchors the menu
 * there rather than at the tab's corner.
 */

import { useState, type MouseEvent } from "react"
import { ChevronDown, Moon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/primitives/dropdown-menu"
import { cn } from "../ui/lib/utils"
import type { ReasonDocument } from "../docs/types"

export interface EditorTabStripProps {
  documents: readonly ReasonDocument[]
  /** Names a tab. Defaults to the matching document's title, which only
   *  covers owned documents; the provider's version names Topic Starters too. */
  tabTitle?: (id: number) => string
  openTabs: readonly number[]
  activeId: number | null
  canReopen: boolean
  /** Open tabs suspended to save memory — shown dimmed, and listed in the
   *  strip's "Suspended" dropdown. */
  suspendedTabs?: readonly number[]
  onSelect: (id: number) => void
  onClose: (id: number) => void
  onCloseOthers: (id: number) => void
  onCloseToRight: (id: number) => void
  onCloseAll: () => void
  /** "Close suspended tabs" in the Suspended dropdown; hidden when absent. */
  onCloseSuspended?: () => void
  onReopen: () => void
}

export function EditorTabStrip({
  documents,
  tabTitle,
  openTabs,
  activeId,
  canReopen,
  suspendedTabs = [],
  onSelect,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onCloseSuspended,
  onReopen,
}: EditorTabStripProps) {
  const nameOf = (id: number) => (tabTitle ? tabTitle(id) : documents.find((d) => d.id === id)?.title || "Untitled")
  const suspended = new Set(suspendedTabs)
  const suspendedOpen = openTabs.filter((id) => suspended.has(id))
  /** The tab whose menu is open, and where in it the pointer was. */
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null)

  const openMenu = (event: MouseEvent<HTMLElement>, id: number) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ id, x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  return (
    <div className="flex items-stretch border-b shrink-0">
      <div className="flex flex-1 min-w-0 items-center overflow-x-auto" role="tablist" aria-label="Open documents">
        {openTabs.map((id, index) => {
          const title = nameOf(id)
          const isSuspended = suspended.has(id)
          const isMenuTab = menu?.id === id
          return (
            <div
              key={id}
              role="tab"
              tabIndex={0}
              aria-selected={id === activeId}
              onClick={() => onSelect(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSelect(id)
                }
              }}
              onContextMenu={(e) => openMenu(e, id)}
              data-suspended={isSuspended || undefined}
              title={isSuspended ? `${title} (suspended to save memory; click to reload)` : undefined}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2 px-3 py-2 text-sm border-r shrink-0 max-w-[180px]",
                id === activeId ? "bg-background font-medium" : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                isSuspended && "italic opacity-60",
              )}
            >
              {isSuspended && <Moon aria-label="Suspended" className="h-3 w-3 shrink-0" />}
              <span className="truncate">{title}</span>
              <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(id)
                }}
                className="shrink-0 h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              >
                ×
              </button>
              <DropdownMenu open={isMenuTab} onOpenChange={(open) => !open && setMenu(null)}>
                <DropdownMenuTrigger asChild>
                  <span
                    aria-hidden
                    tabIndex={-1}
                    className="pointer-events-none absolute h-0 w-0"
                    style={menu && isMenuTab ? { left: menu.x, top: menu.y } : { left: 0, bottom: 0 }}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onClose(id)}>Close</DropdownMenuItem>
                  <DropdownMenuItem disabled={openTabs.length < 2} onClick={() => onCloseOthers(id)}>
                    Close others
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={index === openTabs.length - 1} onClick={() => onCloseToRight(id)}>
                    Close to the right
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onCloseAll}>Close all</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!canReopen} onClick={onReopen}>
                    Undo close
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
      {suspendedOpen.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`${suspendedOpen.length} suspended tab${suspendedOpen.length === 1 ? "" : "s"}`}
              title="Tabs suspended to save memory"
              className="flex shrink-0 items-center gap-1 border-l px-2 text-xs text-muted-foreground hover:bg-muted/70"
            >
              <Moon className="h-3 w-3" />
              {suspendedOpen.length}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Suspended to save memory. Open one to reload it.
            </div>
            {suspendedOpen.map((id) => (
              <DropdownMenuItem key={id} onClick={() => onSelect(id)}>
                <span className="truncate max-w-[240px]">{nameOf(id)}</span>
              </DropdownMenuItem>
            ))}
            {onCloseSuspended && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onCloseSuspended}>Close suspended tabs</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
