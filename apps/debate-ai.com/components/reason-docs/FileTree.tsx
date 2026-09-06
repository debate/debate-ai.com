"use client"

/**
 * Folder/file tree for the REASON editor sidebar — ported from quick
 * search's REASON editor sidebar (`packages/reason-editor-sidebar`,
 * `packages/reason-editor/src/file-tree`), simplified to this app's flat
 * `parentId`/`isFolder` document model (no drag library, no tags/file
 * sources) and rebuilt on this app's own local UI primitives.
 */

import { type DragEvent, type ReactNode, useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  FolderIcon,
  FolderOpenIcon,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/lib/ui/primitives/dropdown-menu"
import { Input } from "@/lib/ui/primitives/input"
import type { ReasonDocument } from "./types"

interface TreeNode {
  doc: ReasonDocument
  children: TreeNode[]
}

function buildTree(documents: ReasonDocument[]): TreeNode[] {
  const byParent = new Map<number | null, ReasonDocument[]>()
  for (const doc of documents) {
    const key = doc.parentId ?? null
    const siblings = byParent.get(key) ?? []
    siblings.push(doc)
    byParent.set(key, siblings)
  }
  const sortSiblings = (docs: ReasonDocument[]) =>
    [...docs].sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.title.localeCompare(b.title)
    })

  const build = (parentId: number | null): TreeNode[] =>
    sortSiblings(byParent.get(parentId) ?? []).map((doc) => ({
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
}

export function FileTree({ documents, activeId, onSelect, onAdd, onRename, onDelete, onMove }: FileTreeProps) {
  const tree = useMemo(() => buildTree(documents), [documents])
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(documents.filter((d) => d.isFolder).map((d) => d.id)))
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [dragOverRoot, setDragOverRoot] = useState(false)

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
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

  const handleDrop = (e: DragEvent, targetFolderId: number | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    setDragOverRoot(false)
    const draggedId = Number(e.dataTransfer.getData("text/reason-document-id"))
    if (!draggedId) return
    if (targetFolderId != null && isSelfOrDescendant(documents, draggedId, targetFolderId)) return
    const dragged = documents.find((d) => d.id === draggedId)
    if (!dragged || dragged.parentId === targetFolderId) return
    onMove(draggedId, targetFolderId)
  }

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const { doc } = node
    const isOpen = expanded.has(doc.id)
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
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/reason-document-id", String(doc.id))}
          onDragOver={(e) => {
            if (!doc.isFolder) return
            e.preventDefault()
            e.stopPropagation()
            setDragOverId(doc.id)
          }}
          onDragLeave={() => setDragOverId((prev) => (prev === doc.id ? null : prev))}
          onDrop={(e) => handleDrop(e, doc.isFolder ? doc.id : (doc.parentId ?? null))}
          onClick={() => {
            if (doc.isFolder) toggleExpanded(doc.id)
            else onSelect(doc.id)
          }}
          onDoubleClick={() => startRename(doc)}
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
            <span className="flex-1 truncate">{doc.title || "Untitled"}</span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 h-5 w-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              {doc.isFolder && (
                <>
                  <DropdownMenuItem onClick={() => onAdd(doc.id, false)}>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAdd(doc.id, true)}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => startRename(doc)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(doc.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {doc.isFolder && isOpen && node.children.map((child) => renderNode(child, depth + 1))}
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
      onDragLeave={() => setDragOverRoot(false)}
      onDrop={(e) => handleDrop(e, null)}
    >
      {tree.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">No documents yet. Create one to get started.</p>
      ) : (
        tree.map((node) => renderNode(node, 0))
      )}
    </div>
  )
}
