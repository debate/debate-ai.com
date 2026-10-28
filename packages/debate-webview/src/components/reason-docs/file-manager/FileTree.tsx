"use client"

/**
 * Folder/file tree for the REASON editor sidebar — ported from quick
 * search's REASON editor sidebar (`packages/reason-editor-sidebar`,
 * `packages/reason-editor/src/file-tree`), simplified to this app's flat
 * `parentId`/`isFolder` document model (no drag library, no tags/file
 * sources) and rebuilt on this app's own local UI primitives.
 *
 * The tree is also a drop target for files from the desktop, not just for
 * rows being re-filed: dropping a `.docx` on a folder imports it there (as a
 * Debate Editor `.cmir` — see `lib/debate-editor/stored-cmir.ts`), and clicking the
 * row that appears opens it in Debate Editor. Rows keep the name they were
 * uploaded under, extension included, so the file you dropped is the file you
 * see. No row carries a format badge: everything stored here is a Debate Editor
 * file whatever it was uploaded as.
 *
 * Rows drag both ways between this tree and Topic Starters
 * (`lib/reason-docs/drag-data.ts`): a topic starter dropped here becomes your
 * own copy, and a row dragged from here onto Topic Starters is published.
 *
 * Right-clicking a row opens the same menu as its "…" button — open, edit,
 * share, rename, duplicate, move to a folder, download, publish, delete — so
 * every way of organising a file is one gesture from the file itself.
 */

import { type DragEvent, type ReactNode, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderIcon,
  FolderInput,
  FolderOpenIcon,
  FolderPlus,
  Globe,
  MoreHorizontal,
  Pencil,
  Share2,
  Tag,
  TextCursorInput,
  Trash2,
} from "lucide-react"
import { cn } from "@debate-ai/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@debate-ai/ui/primitives/dropdown-menu"
import { Input } from "@debate-ai/ui/primitives/input"
import { Badge } from "@debate-ai/ui/primitives/badge"
import { getSampleReasonDocuments } from "../../../lib/reason-docs/sample-documents"
import { compareRows, type FileSort } from "../../../lib/reason-docs/file-sort"
import { folderPathOf } from "../../../lib/reason-docs/file-search"
import { DOCUMENT_DRAG_TYPE, TOPIC_DRAG_TYPE, draggedId } from "../../../lib/reason-docs/drag-data"
import type { ReasonDocument } from "../types"

interface TreeNode {
  doc: ReasonDocument
  children: TreeNode[]
}

/**
 * Nests the flat rows under their folders, siblings ordered by `sort`. A row
 * whose parent isn't in the list (deleted elsewhere, or not a folder) is shown
 * at the top level rather than silently dropped from the tree.
 */
export function buildTree(documents: ReasonDocument[], sort: FileSort = "name"): TreeNode[] {
  const folderIds = new Set(documents.filter((d) => d.isFolder).map((d) => d.id))
  const byParent = new Map<number | null, ReasonDocument[]>()
  for (const doc of documents) {
    const key = doc.parentId != null && folderIds.has(doc.parentId) && doc.parentId !== doc.id ? doc.parentId : null
    const siblings = byParent.get(key) ?? []
    siblings.push(doc)
    byParent.set(key, siblings)
  }
  const compare = compareRows(sort)
  const seen = new Set<number>()
  const build = (parentId: number | null): TreeNode[] =>
    [...(byParent.get(parentId) ?? [])]
      .sort(compare)
      .filter((doc) => !seen.has(doc.id) && seen.add(doc.id))
      .map((doc) => ({
        doc,
        children: doc.isFolder ? build(doc.id) : [],
      }))

  return build(null)
}

/** True if `maybeAncestorId` is `id` itself or one of its ancestors — used to
 *  block a folder from being dropped into its own subtree. */
function isSelfOrDescendant(documents: ReasonDocument[], id: number, targetId: number): boolean {
  if (id === targetId) return true
  const byId = new Map(documents.map((d) => [d.id, d]))
  let cur = byId.get(targetId)
  const seen = new Set<number>()
  while (cur?.parentId != null && !seen.has(cur.id)) {
    if (cur.parentId === id) return true
    seen.add(cur.id)
    cur = byId.get(cur.parentId)
  }
  return false
}

interface FileTreeProps {
  documents: ReasonDocument[]
  activeId: number | null
  onSelect: (id: number) => void
  onAdd: (parentId: number | null, isFolder: boolean) => void
  onRename: (id: number, title: string) => void
  onDelete: (id: number) => void
  onMove: (id: number, parentId: number | null) => void
  /** Files dropped from outside the browser, to import into `parentId`. */
  onUpload?: (files: File[], parentId: number | null) => void
  /** Downloads a file as `.docx`, without opening it in Debate Editor first. Not
   *  offered for folders — there is nothing to convert. */
  onDownload?: (id: number) => void
  /** How siblings are ordered. Folders always come first. */
  sort?: FileSort
  /** "Duplicate": a copy of the row (and, for a folder, its contents). */
  onDuplicate?: (id: number) => void
  /** "Share…": opens the file and the share-with-contacts dialog. */
  onShare?: (id: number) => void
  /** "Sell…": opens the dialog that lists the file for sale. */
  onSell?: (id: number) => void
  /** "Add to Topic Starters": publishes the file to the public catalogue. */
  onPublish?: (id: number) => void
  /** A row dragged in from Topic Starters, to copy into `parentId`. */
  onImportTopic?: (topicId: number, parentId: number | null) => void
}

export function FileTree({
  documents,
  activeId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onMove,
  onUpload,
  onDownload,
  sort = "name",
  onDuplicate,
  onShare,
  onSell,
  onPublish,
  onImportTopic,
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(documents, sort), [documents, sort])
  // Collapsed rather than expanded: the documents arrive after this mounts,
  // so an "expanded" set seeded on mount started every folder closed. A
  // folder is open until the reader closes it.
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)
  /** The row whose menu a right-click opened. The same menu as the row's
   *  "…" button, so the two can never offer different actions. */
  const [menuId, setMenuId] = useState<number | null>(null)

  /** Every folder, with its path, for the "Move to" submenu. */
  const folders = useMemo(
    () =>
      documents
        .filter((d) => d.isFolder)
        .map((d) => ({ doc: d, label: [folderPathOf(documents, d), d.title || "Untitled"].filter(Boolean).join(" / ") }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [documents],
  )

  const toggleExpanded = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startRename = (doc: ReasonDocument) => {
    setRenamingId(doc.id)
    setRenameValue(doc.title)
  }

  const commitRename = (id: number) => {
    const title = renameValue.trim()
    if (title) onRename(id, title)
    setRenamingId(null)
  }

  /** A move the tree allows: not into the row's own subtree, and not to
   *  where it already is. */
  const canMove = (id: number, targetFolderId: number | null) => {
    if (targetFolderId != null && isSelfOrDescendant(documents, id, targetFolderId)) return false
    const dragged = documents.find((d) => d.id === id)
    return Boolean(dragged) && (dragged!.parentId ?? null) !== targetFolderId
  }

  const handleDrop = (e: DragEvent, targetFolderId: number | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    setDragOverRoot(false)
    // A drop from the desktop carries files and no row id — import those into
    // the folder they landed on rather than treating the drop as a re-file.
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length > 0) {
      onUpload?.(files, targetFolderId)
      return
    }
    // A row from Topic Starters: the catalogue is read-only, so the drop
    // saves a copy here rather than moving anything out of it.
    const topicId = draggedId(e.dataTransfer, TOPIC_DRAG_TYPE)
    if (topicId != null) {
      onImportTopic?.(topicId, targetFolderId)
      return
    }
    const id = draggedId(e.dataTransfer, DOCUMENT_DRAG_TYPE)
    if (id == null || !canMove(id, targetFolderId)) return
    onMove(id, targetFolderId)
  }

  /** The actions on one row — shared by the "…" button and right-click. */
  const rowMenu = (doc: ReasonDocument) => (
    <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
      {doc.isFolder ? (
        <>
          <DropdownMenuItem onClick={() => onAdd(doc.id, false)}>
            <FilePlus2 className="mr-2 h-4 w-4" />
            New File
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd(doc.id, true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </DropdownMenuItem>
        </>
      ) : (
        <>
          <DropdownMenuItem onClick={() => onSelect(doc.id)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSelect(doc.id)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          {onShare && (
            <DropdownMenuItem onClick={() => onShare(doc.id)}>
              <Share2 className="mr-2 h-4 w-4" />
              Share…
            </DropdownMenuItem>
          )}
          {onSell && (
            <DropdownMenuItem onClick={() => onSell(doc.id)}>
              <Tag className="mr-2 h-4 w-4" />
              Sell…
            </DropdownMenuItem>
          )}
        </>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => startRename(doc)}>
        <TextCursorInput className="mr-2 h-4 w-4" />
        Rename
      </DropdownMenuItem>
      {onDuplicate && (
        <DropdownMenuItem onClick={() => onDuplicate(doc.id)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FolderInput className="mr-2 h-4 w-4" />
          Move to
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="max-h-72 overflow-auto">
          <DropdownMenuItem disabled={!canMove(doc.id, null)} onClick={() => onMove(doc.id, null)}>
            Top level
          </DropdownMenuItem>
          {folders.map(({ doc: folder, label }) => (
            <DropdownMenuItem
              key={folder.id}
              disabled={!canMove(doc.id, folder.id)}
              onClick={() => onMove(doc.id, folder.id)}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {!doc.isFolder && (onDownload || onPublish) && <DropdownMenuSeparator />}
      {!doc.isFolder && onDownload && (
        <DropdownMenuItem onClick={() => onDownload(doc.id)}>
          <Download className="mr-2 h-4 w-4" />
          Download as .docx
        </DropdownMenuItem>
      )}
      {!doc.isFolder && onPublish && (
        <DropdownMenuItem onClick={() => onPublish(doc.id)}>
          <Globe className="mr-2 h-4 w-4" />
          Add to Topic Starters
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onDelete(doc.id)} className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  )

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const { doc } = node
    const isOpen = !collapsed.has(doc.id)
    const isRenaming = renamingId === doc.id

    return (
      <div key={doc.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-md py-1.5 pr-1 text-sm truncate cursor-pointer",
            activeId === doc.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
            dragOverId === doc.id && doc.isFolder && "ring-1 ring-primary",
          )}
          style={{ paddingLeft: 8 + depth * 16 }}
          draggable={!isRenaming}
          onDragStart={(e) => {
            e.dataTransfer.setData(DOCUMENT_DRAG_TYPE, String(doc.id))
            e.dataTransfer.effectAllowed = "copyMove"
          }}
          onDragOver={(e) => {
            if (!doc.isFolder) return
            e.preventDefault()
            e.stopPropagation()
            setDragOverId(doc.id)
          }}
          onDragEnter={(e) => {
            if (doc.isFolder) e.preventDefault()
          }}
          onDragLeave={() => setDragOverId((prev) => (prev === doc.id ? null : prev))}
          onDrop={(e) => handleDrop(e, doc.isFolder ? doc.id : (doc.parentId ?? null))}
          onClick={() => {
            if (doc.isFolder) toggleExpanded(doc.id)
            else onSelect(doc.id)
          }}
          onDoubleClick={() => startRename(doc)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenuId(doc.id)
          }}
        >
          {doc.isFolder ? (
            <button
              type="button"
              className="shrink-0 p-0.5 -ml-0.5"
              onClick={(e) => {
                e.stopPropagation()
                toggleExpanded(doc.id)
              }}
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {doc.isFolder ? (
            isOpen ? (
              <FolderOpenIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            )
          ) : (
            <FileText className="h-4 w-4 shrink-0 opacity-60" />
          )}

          {isRenaming ? (
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => commitRename(doc.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename(doc.id)
                if (e.key === "Escape") setRenamingId(null)
              }}
              className="h-6 flex-1 px-1 text-sm"
            />
          ) : (
            // Every file is a Debate Editor file however it arrived, so the row
            // carries no ".docx"/".cmir" badge — the name is the whole label.
            <span className="flex-1 truncate">{doc.title || "Untitled"}</span>
          )}

          <DropdownMenu open={menuId === doc.id} onOpenChange={(open) => setMenuId(open ? doc.id : null)}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${doc.title || "Untitled"}`}
                className="shrink-0 h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent data-[state=open]:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            {rowMenu(doc)}
          </DropdownMenu>
        </div>

        {doc.isFolder && isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  /** A read-only preview row for the "no documents yet" sample tree — no
   *  click/drag/rename/delete affordances, since these rows aren't real. */
  const renderSampleNode = (node: TreeNode, depth: number): ReactNode => {
    const { doc } = node
    return (
      <div key={doc.id}>
        <div
          className="flex items-center gap-1 rounded-md py-1.5 pr-1 text-sm truncate text-muted-foreground"
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <span className="w-4 shrink-0" />
          {doc.isFolder ? (
            <FolderOpenIcon className="h-4 w-4 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 opacity-60" />
          )}
          <span className="flex-1 truncate">{doc.title}</span>
        </div>
        {node.children.map((child) => renderSampleNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div
      className={cn("flex-1 overflow-auto py-1", dragOverRoot && "ring-1 ring-inset ring-primary")}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOverRoot(true)
      }}
      data-testid="file-tree"
      onDragLeave={() => setDragOverRoot(false)}
      onDrop={(e) => handleDrop(e, null)}
    >
      {documents.length === 0 ? (
        <div className="px-3 py-4">
          <p className="text-sm text-muted-foreground">
            No documents yet. Create one, drop a .docx here, or drag a topic starter in to keep your own copy.
          </p>
          <div className="mt-3 rounded-lg border border-dashed border-border p-2">
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-semibold text-foreground">Example file tree</span>
              <Badge variant="outline">Sample</Badge>
            </div>
            {buildTree(getSampleReasonDocuments()).map((node) => renderSampleNode(node, 0))}
          </div>
        </div>
      ) : (
        tree.map((node) => renderNode(node, 0))
      )}
    </div>
  )
}
