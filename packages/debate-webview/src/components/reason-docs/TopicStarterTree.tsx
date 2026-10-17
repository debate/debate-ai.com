"use client"

/**
 * The public Topic Starters catalogue as a tree in the docs sidebar.
 *
 * Read-only for readers, so its actions are about getting a file *out*:
 * open it, edit a copy of it, save a copy into your own Files (also by
 * dragging the row onto Files), copy its link, download it. A row dragged
 * from Files and dropped here is published to the catalogue, which the
 * server only allows for admins (`lib/reason-docs/drag-data.ts`).
 *
 * Right-click opens the same menu as the row's "…" button. Rows carry no
 * format badge — every file in the library is a CardMirror file.
 */

import { type DragEvent, type ReactNode, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderDown,
  FolderInput,
  Link2,
  MoreHorizontal,
  Pencil,
  Search,
} from "lucide-react"
import { Input } from "../../lib/ui/primitives/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../lib/ui/primitives/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../lib/ui/primitives/select"
import { cn } from "../../lib/ui/lib/utils"
import { DOCUMENT_DRAG_TYPE, TOPIC_DRAG_TYPE, draggedId } from "../../lib/reason-docs/drag-data"

/** A row of the public catalogue. `content` is the stored file — a base64
 *  `.cmir` for anything imported since the library switched to CardMirror's
 *  native format, HTML for rows older than that — and `format` says which,
 *  so a reader never has to guess (see `lib/topic-starters/format.ts`). */
export interface TopicStarterItem { id: number; title: string; content: string; format?: string; parentId: number | null; isFolder: boolean; tags: string; year?: number | null }
interface Node { item: TopicStarterItem; children: Node[]; tags: string[] }

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : []
  } catch {
    return []
  }
}

/**
 * Nests the catalogue under its folders, folders first. The catalogue is
 * capped server-side, so a row can arrive without its folder — it is shown at
 * the top level rather than dropped.
 */
function tree(items: TopicStarterItem[]): Node[] {
  const folderIds = new Set(items.filter((item) => item.isFolder).map((item) => item.id))
  const children = new Map<number | null, TopicStarterItem[]>()
  items.forEach((item) => {
    const parent = item.parentId != null && folderIds.has(item.parentId) && item.parentId !== item.id ? item.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), item])
  })
  const seen = new Set<number>()
  const make = (parentId: number | null): Node[] =>
    [...(children.get(parentId) ?? [])]
      .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.title.localeCompare(b.title))
      .filter((item) => !seen.has(item.id) && seen.add(item.id))
      .map((item) => ({ item, children: make(item.id), tags: parseTags(item.tags) }))
  return make(null)
}

/** True when the row's name or tags hold every word of `term`. */
function matchesTerm(node: Node, term: string): boolean {
  const haystack = `${node.item.title} ${node.tags.join(" ")}`.toLowerCase()
  return term.split(/\s+/).every((word) => haystack.includes(word))
}

/** True when the row or anything under it matches — what keeps a folder
 *  visible while a search is narrowing what's inside it. */
function subtreeMatches(node: Node, term: string): boolean {
  return matchesTerm(node, term) || node.children.some((child) => subtreeMatches(child, term))
}

export function TopicStarterTree({
  items,
  onSelect,
  onDownload,
  onSaveCopy,
  onEditCopy,
  onCopyLink,
  onPublish,
}: {
  items: TopicStarterItem[]
  onSelect: (item: TopicStarterItem) => void
  /** Downloads a file as `.docx`, without opening it in the editor first. Not
   *  offered for folders — there is nothing to convert. */
  onDownload?: (item: TopicStarterItem) => void
  /** "Save to my files": copies the row (a folder with its contents) into Files. */
  onSaveCopy?: (item: TopicStarterItem) => void
  /** "Edit a copy": saves a copy into Files and opens it to edit. */
  onEditCopy?: (item: TopicStarterItem) => void
  /** "Copy link": the file's public editor URL to the clipboard. */
  onCopyLink?: (item: TopicStarterItem) => void
  /** One of the reader's files dropped on the catalogue, to publish under
   *  `parentId` (top level when null). */
  onPublish?: (documentId: number, parentId: number | null) => void
}) {
  const [query, setQuery] = useState("")
  // Collapsed rather than expanded: the catalogue arrives after this mounts,
  // so a set seeded on mount used to start every folder closed.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const [menuId, setMenuId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null | "root">(null)
  const nodes = useMemo(() => tree(items), [items])
  const term = query.trim().toLowerCase()

  const handleDrop = (event: DragEvent, parentId: number | null) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverId(null)
    const documentId = draggedId(event.dataTransfer, DOCUMENT_DRAG_TYPE)
    if (documentId != null) onPublish?.(documentId, parentId)
  }

  const menu = (item: TopicStarterItem) => (
    <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
      {!item.isFolder && (
        <>
          <DropdownMenuItem onClick={() => onSelect(item)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open
          </DropdownMenuItem>
          {onEditCopy && (
            <DropdownMenuItem onClick={() => onEditCopy(item)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit a copy
            </DropdownMenuItem>
          )}
        </>
      )}
      {onSaveCopy && (
        <DropdownMenuItem onClick={() => onSaveCopy(item)}>
          <FolderDown className="mr-2 h-4 w-4" />
          Save to my files
        </DropdownMenuItem>
      )}
      {!item.isFolder && (onCopyLink || onDownload) && <DropdownMenuSeparator />}
      {!item.isFolder && onCopyLink && (
        <DropdownMenuItem onClick={() => onCopyLink(item)}>
          <Link2 className="mr-2 h-4 w-4" />
          Copy link
        </DropdownMenuItem>
      )}
      {!item.isFolder && onDownload && (
        <DropdownMenuItem onClick={() => onDownload(item)}>
          <Download className="mr-2 h-4 w-4" />
          Download as .docx
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  )

  const hasMenu = (item: TopicStarterItem) =>
    Boolean(onSaveCopy) || (!item.isFolder && Boolean(onDownload || onEditCopy || onCopyLink))

  const render = (node: Node, depth: number): ReactNode => {
    if (term && !subtreeMatches(node, term)) return null
    const { item } = node
    const open = !collapsed.has(item.id) || Boolean(term)
    return <div key={item.id} className="group">
      <div
        className={cn("flex items-center gap-1 rounded pr-1 hover:bg-muted", dragOverId === item.id && "ring-1 ring-primary")}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(TOPIC_DRAG_TYPE, String(item.id))
          event.dataTransfer.effectAllowed = "copy"
        }}
        onDragOver={(event) => {
          if (!item.isFolder || !onPublish) return
          event.preventDefault()
          event.stopPropagation()
          setDragOverId(item.id)
        }}
        onDragLeave={() => setDragOverId((prev) => (prev === item.id ? null : prev))}
        onDrop={(event) => handleDrop(event, item.isFolder ? item.id : item.parentId)}
        onContextMenu={(event) => {
          if (!hasMenu(item)) return
          event.preventDefault()
          event.stopPropagation()
          setMenuId(item.id)
        }}
      >
        <button type="button" onClick={() => item.isFolder ? setCollapsed((old) => { const next = new Set(old); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next }) : onSelect(item)} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5 text-left text-sm" style={{ paddingLeft: 8 + depth * 14 }}>
          {item.isFolder ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
          {item.isFolder ? <Folder className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
        </button>
        {hasMenu(item) && (
          <DropdownMenu open={menuId === item.id} onOpenChange={(next) => setMenuId(next ? item.id : null)}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${item.title}`}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            {menu(item)}
          </DropdownMenu>
        )}
      </div>
      {item.isFolder && open && node.children.map((child) => render(child, depth + 1))}
    </div>
  }
  return <div className="flex min-h-0 flex-1 flex-col border-t">
    <div className="relative m-2"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 pl-7 text-xs" placeholder="Search topic files" /></div>
    <div
      className={cn("min-h-0 flex-1 overflow-auto pb-2", dragOverId === "root" && "ring-1 ring-inset ring-primary")}
      onDragOver={(event) => {
        if (!onPublish) return
        event.preventDefault()
        setDragOverId("root")
      }}
      onDragLeave={() => setDragOverId((prev) => (prev === "root" ? null : prev))}
      onDrop={(event) => handleDrop(event, null)}
    >
      {nodes.map((node) => render(node, 0))}
      {items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No public topic starters yet.</p>}
    </div>
  </div>
}
