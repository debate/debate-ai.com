"use client"

/**
 * @fileoverview Client component backing `/library` — one place to manage
 * everything linked to the signed-in account:
 *
 * - **Documents** — the Reason Editor's `documents` rows (`/api/doc/documents`):
 *   open, rename, duplicate, share to the library, delete, new doc/folder.
 * - **Flows** — `saved_flows`/`saved_rounds` (`/api/flows`, `/api/rounds`):
 *   open a saved flow in `/debate`, export/import flow JSON, delete.
 * - **Shared files** — the `topic_starter_items` library (`/api/shared-files`):
 *   your own shared files (publish/unpublish, rename, delete, upload a
 *   DOCX/ZIP) and the community library (open read-only, save a copy).
 *
 * All fetch logic lives in `debate-round`'s `*-client.ts` modules (unit-tested
 * there — this app has no vitest project of its own). Signed out, the page
 * still browses the public shared library and offers the demo account.
 *
 * @module app/library/LibraryPageContent
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  ListTree,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import {
  DEMO_ACCOUNT,
  buildSharedFileTree,
  collectDocumentDescendantIds,
  copySharedFileToDocuments,
  createDocument,
  deleteDocumentTree,
  deleteSavedFlow,
  deleteSavedRound,
  deleteSharedFile,
  duplicateDocument,
  fetchSavedFlow,
  filterSharedFiles,
  formatRelativeCloudTime,
  isDemoAccountEmail,
  isValidFlow,
  listDocuments,
  listMySharedFiles,
  listSavedFlows,
  listSavedRounds,
  listSharedFiles,
  parseCloudTimestamp,
  parseSharedFileTags,
  saveFlowToAccount,
  shareDocument,
  sharedFilePath,
  signInAsDemoAccount,
  updateDocument,
  updateSharedFile,
  uploadSharedFiles,
  type DocumentRecord,
  type Flow,
  type SavedFlowSummary,
  type SavedRoundSummary,
  type SharedFileItem,
} from "debate-round"
import { Badge } from "../../lib/ui/primitives/badge"
import { Button } from "../../lib/ui/primitives/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../lib/ui/primitives/card"
import { Input } from "../../lib/ui/primitives/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../lib/ui/primitives/tabs"
import { useSession } from "@/lib/hooks/useSession"

type LibraryTab = "documents" | "flows" | "shared"
const TABS: LibraryTab[] = ["documents", "flows", "shared"]

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Inline rename control: click the pencil, edit, Enter/blur to commit, Escape to cancel. */
function InlineRename({ value, onCommit, children }: { value: string; onCommit: (next: string) => void; children: ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  if (!editing) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        {children}
        <button type="button" onClick={() => setEditing(true)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Rename" aria-label="Rename">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    )
  }
  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    else setDraft(value)
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit()
        if (event.key === "Escape") {
          setDraft(value)
          setEditing(false)
        }
      }}
      className="h-7 max-w-xs text-sm"
    />
  )
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (next: string) => void; placeholder: string }) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="pl-8" placeholder={placeholder} />
    </div>
  )
}

// ── Documents ─────────────────────────────────────────────────────────────

function documentPath(documents: DocumentRecord[], doc: DocumentRecord): string {
  const byId = new Map(documents.map((d) => [d.id, d]))
  const parts: string[] = []
  const seen = new Set<number>()
  let current = doc.parentId
  while (current !== null && !seen.has(current)) {
    seen.add(current)
    const parent = byId.get(current)
    if (!parent) break
    parts.unshift(parent.title)
    current = parent.parentId
  }
  return parts.join("/")
}

function DocumentsTab({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<number | null>(null)

  const reload = useCallback(async () => {
    try {
      setDocuments(await listDocuments())
    } catch (error) {
      toast.error(errorMessage(error, "Could not load your documents."))
      setDocuments([])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const visible = useMemo(() => {
    if (!documents) return []
    const term = query.trim().toLowerCase()
    const rows = term ? documents.filter((doc) => `${doc.title} ${documentPath(documents, doc)}`.toLowerCase().includes(term)) : documents
    return [...rows].sort((a, b) => parseCloudTimestamp(b.updatedAt) - parseCloudTimestamp(a.updatedAt))
  }, [documents, query])

  const run = async (id: number | null, action: () => Promise<void>, success?: string) => {
    setBusy(id)
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error, "Something went wrong."))
    } finally {
      setBusy(null)
    }
  }

  const create = (isFolder: boolean) =>
    run(null, async () => {
      const created = await createDocument({ isFolder, title: isFolder ? "New Folder" : "Untitled" })
      setDocuments((prev) => [created, ...(prev ?? [])])
      if (!isFolder) router.push(`/reason-editor?doc=${created.id}`)
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Search documents and folders" />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => create(true)} disabled={busy !== null}>
            <FolderPlus className="mr-1.5 h-4 w-4" /> New folder
          </Button>
          <Button size="sm" onClick={() => create(false)} disabled={busy !== null}>
            <FilePlus2 className="mr-1.5 h-4 w-4" /> New document
          </Button>
        </div>
      </div>
      {!isAuthenticated && (
        <p className="text-xs text-muted-foreground">
          You&apos;re signed out, so these documents live only in this browser&apos;s anonymous workspace. Sign in to keep them on your account.
        </p>
      )}
      {documents === null ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <EmptyRow>{documents.length === 0 ? "No documents yet — create one, or save a copy of a shared file." : "No documents match your search."}</EmptyRow>
      ) : (
        <ul className="divide-y rounded-md border">
          {visible.map((doc) => {
            const path = documentPath(documents, doc)
            const childCount = doc.isFolder ? collectDocumentDescendantIds(documents, doc.id).length - 1 : 0
            return (
              <li key={doc.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                {doc.isFolder ? <Folder className="h-4 w-4 shrink-0 text-amber-500" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <InlineRename
                    value={doc.title}
                    onCommit={(title) =>
                      run(doc.id, async () => {
                        const updated = await updateDocument(doc.id, { title })
                        setDocuments((prev) => (prev ?? []).map((d) => (d.id === doc.id ? { ...d, title: updated.title } : d)))
                      })
                    }
                  >
                    {doc.isFolder ? (
                      <span className="truncate font-medium">{doc.title}</span>
                    ) : (
                      <Link href={`/reason-editor?doc=${doc.id}`} className="truncate font-medium hover:underline">{doc.title || "Untitled"}</Link>
                    )}
                  </InlineRename>
                  <span className="truncate text-xs text-muted-foreground">
                    {path && <span>{path} · </span>}
                    {doc.isFolder ? `${childCount} item${childCount === 1 ? "" : "s"}` : formatRelativeCloudTime(parseCloudTimestamp(doc.updatedAt))}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!doc.isFolder && (
                    <>
                      <Button size="sm" variant="ghost" title="Open in the Reason Editor" onClick={() => router.push(`/reason-editor?doc=${doc.id}`)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Duplicate"
                        disabled={busy === doc.id}
                        onClick={() =>
                          run(doc.id, async () => {
                            const copy = await duplicateDocument(doc.id, documents)
                            setDocuments((prev) => [copy, ...(prev ?? [])])
                          }, "Document duplicated.")
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={isAuthenticated ? "Share to the library" : "Sign in to share"}
                        disabled={busy === doc.id || !isAuthenticated}
                        onClick={() =>
                          run(doc.id, async () => {
                            await shareDocument(doc.id)
                          }, "Shared to the library — find it under Shared Files.")
                        }
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                    disabled={busy === doc.id}
                    onClick={() => {
                      const label = doc.isFolder ? `Delete the folder "${doc.title}" and the ${childCount} item${childCount === 1 ? "" : "s"} inside it?` : `Delete "${doc.title || "Untitled"}"?`
                      if (!window.confirm(label)) return
                      void run(doc.id, async () => {
                        const ids = await deleteDocumentTree(documents, doc.id)
                        setDocuments((prev) => (prev ?? []).filter((d) => !ids.includes(d.id)))
                      }, "Deleted.")
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Flows ─────────────────────────────────────────────────────────────────

/** Puts a saved flow into the browser-local flow list `/debate` loads on mount (replacing a same-id flow, else appending). */
function upsertLocalFlow(flow: Flow): void {
  let flows: Flow[] = []
  try {
    const raw = localStorage.getItem("flows")
    if (raw) flows = JSON.parse(raw) as Flow[]
  } catch {
    flows = []
  }
  const index = flows.findIndex((existing) => existing.id === flow.id)
  const next = index >= 0 ? flows.map((existing, i) => (i === index ? flow : existing)) : [...flows, flow]
  localStorage.setItem("flows", JSON.stringify(next))
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function safeFilename(label: string): string {
  return (label.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-") || "flow").slice(0, 60)
}

function FlowsTab({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter()
  const importRef = useRef<HTMLInputElement>(null)
  const [flows, setFlows] = useState<SavedFlowSummary[] | null>(null)
  const [rounds, setRounds] = useState<SavedRoundSummary[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [query, setQuery] = useState("")

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setFlows([])
      setRounds([])
      return
    }
    try {
      const [flowRows, roundRows] = await Promise.all([listSavedFlows(), listSavedRounds()])
      setFlows(flowRows ?? [])
      setRounds(roundRows ?? [])
    } catch (error) {
      toast.error(errorMessage(error, "Could not load your saved flows."))
      setFlows([])
      setRounds([])
    }
  }, [isAuthenticated])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = async (id: number | null, action: () => Promise<void>, success?: string) => {
    setBusy(id)
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error, "Something went wrong."))
    } finally {
      setBusy(null)
    }
  }

  const visibleFlows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return (flows ?? []).filter((flow) => !term || flow.label.toLowerCase().includes(term))
  }, [flows, query])

  const importFlow = async (file: File) => {
    await run(null, async () => {
      const parsed: unknown = JSON.parse(await file.text())
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      let imported = 0
      for (const candidate of candidates) {
        if (!isValidFlow(candidate)) continue
        await saveFlowToAccount(candidate)
        imported++
      }
      if (imported === 0) throw new Error("That file doesn't contain a valid flow export.")
      await reload()
      toast.success(`Imported ${imported} flow${imported === 1 ? "" : "s"} to your account.`)
    })
  }

  if (!isAuthenticated) {
    return <EmptyRow>Sign in to save flows to your account and manage them here. Flows you build in the Debate workspace stay in this browser until then.</EmptyRow>
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SearchBox value={query} onChange={setQuery} placeholder="Search saved flows" />
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importFlow(file)
                event.target.value = ""
              }}
            />
            <Button size="sm" variant="outline" onClick={() => importRef.current?.click()} disabled={busy !== null}>
              <Upload className="mr-1.5 h-4 w-4" /> Import flow JSON
            </Button>
            <Button size="sm" onClick={() => router.push("/debate")}>
              <ListTree className="mr-1.5 h-4 w-4" /> Open Debate workspace
            </Button>
          </div>
        </div>
        {flows === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : visibleFlows.length === 0 ? (
          <EmptyRow>{flows.length === 0 ? "No saved flows yet. In the Debate workspace, open Round History and click a flow's cloud icon to save it here." : "No flows match your search."}</EmptyRow>
        ) : (
          <ul className="divide-y rounded-md border">
            {visibleFlows.map((flow) => (
              <li key={flow.clientId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <ListTree className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{flow.label || "Untitled flow"}</span>
                  <span className="text-xs text-muted-foreground">Saved {formatRelativeCloudTime(parseCloudTimestamp(flow.updatedAt))}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === flow.clientId}
                    onClick={() =>
                      run(flow.clientId, async () => {
                        const full = await fetchSavedFlow(flow.clientId)
                        if (!full) throw new Error("That saved flow no longer exists.")
                        upsertLocalFlow(full)
                        router.push("/debate")
                      })
                    }
                  >
                    <ExternalLink className="mr-1.5 h-4 w-4" /> Open in Debate
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Download as JSON"
                    disabled={busy === flow.clientId}
                    onClick={() =>
                      run(flow.clientId, async () => {
                        const full = await fetchSavedFlow(flow.clientId)
                        if (!full) throw new Error("That saved flow no longer exists.")
                        downloadJson(`${safeFilename(flow.label)}.flow.json`, full)
                      })
                    }
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title="Remove from account"
                    disabled={busy === flow.clientId}
                    onClick={() => {
                      if (!window.confirm(`Remove "${flow.label || "Untitled flow"}" from your account? Any local copy in the Debate workspace stays.`)) return
                      void run(flow.clientId, async () => {
                        await deleteSavedFlow(flow.clientId)
                        setFlows((prev) => (prev ?? []).filter((f) => f.clientId !== flow.clientId))
                      }, "Removed from your account.")
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Saved rounds</h3>
        {rounds === null ? null : rounds.length === 0 ? (
          <EmptyRow>No saved rounds. Use Round History&apos;s &quot;Save all rounds&quot; in the Debate workspace to sync them here.</EmptyRow>
        ) : (
          <ul className="divide-y rounded-md border">
            {rounds.map((round) => (
              <li key={round.clientId} className="flex items-center gap-2 px-3 py-2 text-sm">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{round.label || "Untitled round"}</span>
                  <span className="text-xs text-muted-foreground">Saved {formatRelativeCloudTime(parseCloudTimestamp(round.updatedAt))} · load it from Round History&apos;s &quot;Saved to account&quot; tab</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  title="Remove from account"
                  disabled={busy === round.clientId}
                  onClick={() => {
                    if (!window.confirm(`Remove the round "${round.label || "Untitled round"}" from your account?`)) return
                    void run(round.clientId, async () => {
                      await deleteSavedRound(round.clientId)
                      setRounds((prev) => (prev ?? []).filter((r) => r.clientId !== round.clientId))
                    }, "Removed from your account.")
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Shared files ──────────────────────────────────────────────────────────

/** Flattens a shared-file tree into rows with a depth, for an indented list. */
function flattenTree(items: SharedFileItem[]): Array<{ item: SharedFileItem; depth: number }> {
  const rows: Array<{ item: SharedFileItem; depth: number }> = []
  const walk = (nodes: ReturnType<typeof buildSharedFileTree<SharedFileItem>>, depth: number) => {
    for (const node of nodes) {
      rows.push({ item: node.item, depth })
      walk(node.children, depth + 1)
    }
  }
  walk(buildSharedFileTree(items), 0)
  return rows
}

function SharedFileRow({
  item,
  depth,
  isOwner,
  busy,
  onOpen,
  onCopy,
  onRename,
  onTogglePublished,
  onDelete,
}: {
  item: SharedFileItem
  depth: number
  isOwner: boolean
  busy: boolean
  onOpen: () => void
  onCopy?: () => void
  onRename?: (title: string) => void
  onTogglePublished?: () => void
  onDelete?: () => void
}) {
  const tags = parseSharedFileTags(item.tags)
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" style={{ paddingLeft: 12 + depth * 18 }}>
      {item.isFolder ? <Folder className="h-4 w-4 shrink-0 text-amber-500" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <div className="flex min-w-0 flex-1 flex-col">
        {isOwner && onRename ? (
          <InlineRename value={item.title} onCommit={onRename}>
            {item.isFolder ? <span className="truncate font-medium">{item.title}</span> : <button type="button" onClick={onOpen} className="truncate text-left font-medium hover:underline">{item.title}</button>}
          </InlineRename>
        ) : item.isFolder ? (
          <span className="truncate font-medium">{item.title}</span>
        ) : (
          <button type="button" onClick={onOpen} className="truncate text-left font-medium hover:underline">{item.title}</button>
        )}
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {item.ownerId === null && <Badge variant="secondary" className="px-1 py-0 text-[10px]">Topic Starter</Badge>}
          {!item.published && <Badge variant="outline" className="px-1 py-0 text-[10px]">Private</Badge>}
          {tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-muted px-1">{tag}</span>)}
          {!item.isFolder && <span>{formatRelativeCloudTime(parseCloudTimestamp(item.updatedAt))}</span>}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!item.isFolder && (
          <Button size="sm" variant="ghost" title="Open in the Reason Editor" onClick={onOpen}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        {!item.isFolder && onCopy && (
          <Button size="sm" variant="ghost" title="Save a copy to my documents" disabled={busy} onClick={onCopy}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {isOwner && onTogglePublished && (
          <Button size="sm" variant="ghost" title={item.published ? "Make private" : "Publish to everyone"} disabled={busy} onClick={onTogglePublished}>
            {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
        )}
        {isOwner && onDelete && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Delete" disabled={busy} onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  )
}

function SharedFilesTab({ isAuthenticated, userId }: { isAuthenticated: boolean; userId: string | null }) {
  const router = useRouter()
  const uploadRef = useRef<HTMLInputElement>(null)
  const [mine, setMine] = useState<SharedFileItem[] | null>(null)
  const [community, setCommunity] = useState<SharedFileItem[] | null>(null)
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<number | null>(null)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadPublished, setUploadPublished] = useState(true)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [publicRows, myRows] = await Promise.all([listSharedFiles(), isAuthenticated ? listMySharedFiles() : Promise.resolve(null)])
      setMine(myRows ?? [])
      setCommunity(publicRows.filter((item) => !userId || item.ownerId !== userId))
    } catch (error) {
      toast.error(errorMessage(error, "Could not load the shared-file library."))
      setMine([])
      setCommunity([])
    }
  }, [isAuthenticated, userId])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = async (id: number | null, action: () => Promise<void>, success?: string) => {
    setBusy(id)
    try {
      await action()
      if (success) toast.success(success)
    } catch (error) {
      toast.error(errorMessage(error, "Something went wrong."))
    } finally {
      setBusy(null)
    }
  }

  const open = (item: SharedFileItem) => router.push(`/reason-editor?shared=${item.id}`)
  const copy = (item: SharedFileItem) =>
    run(item.id, async () => {
      const created = await copySharedFileToDocuments(item.id)
      toast.success(`Saved "${created.title}" to your documents.`, {
        action: { label: "Open", onClick: () => router.push(`/reason-editor?doc=${created.id}`) },
      })
    })

  const myRows = useMemo(() => flattenTree(filterSharedFiles(mine ?? [], query)), [mine, query])
  const communityRows = useMemo(() => flattenTree(filterSharedFiles(community ?? [], query)), [community, query])

  const upload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const result = await uploadSharedFiles(uploadFile, { title: uploadTitle, published: uploadPublished })
      toast.success(`Imported ${result.imported} file${result.imported === 1 ? "" : "s"} into "${result.root.title}".`)
      setUploadFile(null)
      setUploadTitle("")
      if (uploadRef.current) uploadRef.current.value = ""
      await reload()
    } catch (error) {
      toast.error(errorMessage(error, "Upload failed."))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SearchBox value={query} onChange={setQuery} placeholder="Search shared files by title, tag, or folder" />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">My shared files</h3>
        {!isAuthenticated ? (
          <EmptyRow>Sign in to share your own documents and uploads with everyone — or keep them private until they&apos;re ready.</EmptyRow>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Upload DOCX or ZIP</CardTitle>
                <CardDescription>One Word file, or a zip of up to 25 — folder names inside the zip are kept. Uncheck &quot;Publish&quot; to keep the upload private to you.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                  Folder name (optional)
                  <Input value={uploadTitle} onChange={(event) => setUploadTitle(event.target.value)} placeholder="e.g. My 2026 topic files" />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                  File
                  <Input ref={uploadRef} type="file" accept=".docx,.zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={uploadPublished} onChange={(event) => setUploadPublished(event.target.checked)} /> Publish
                </label>
                <Button onClick={upload} disabled={!uploadFile || uploading}>
                  <Upload className="mr-2 h-4 w-4" />
                  {uploading ? "Importing…" : "Upload"}
                </Button>
              </CardContent>
            </Card>
            {mine === null ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : myRows.length === 0 ? (
              <EmptyRow>{mine.length === 0 ? "Nothing shared yet. Share a document from the Documents tab or upload a file above." : "None of your shared files match your search."}</EmptyRow>
            ) : (
              <ul className="divide-y rounded-md border">
                {myRows.map(({ item, depth }) => (
                  <SharedFileRow
                    key={item.id}
                    item={item}
                    depth={depth}
                    isOwner
                    busy={busy === item.id}
                    onOpen={() => open(item)}
                    onRename={(title) =>
                      run(item.id, async () => {
                        const updated = await updateSharedFile(item.id, { title })
                        setMine((prev) => (prev ?? []).map((row) => (row.id === item.id ? updated : row)))
                      })
                    }
                    onTogglePublished={() =>
                      run(item.id, async () => {
                        const updated = await updateSharedFile(item.id, { published: !item.published })
                        setMine((prev) => (prev ?? []).map((row) => (row.id === item.id ? updated : row)))
                      }, item.published ? "Now private — only you can see it." : "Published to everyone.")
                    }
                    onDelete={() => {
                      if (!window.confirm(item.isFolder ? `Delete the shared folder "${item.title}" and everything inside it?` : `Delete the shared file "${item.title}"?`)) return
                      void run(item.id, async () => {
                        await deleteSharedFile(item.id)
                        await reload()
                      }, "Deleted.")
                    }}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Globe className="h-4 w-4" /> Community library
        </h3>
        <p className="text-xs text-muted-foreground">Topic Starter packs curated by the site, plus everything other users have published. Open a file read-only, or save a copy to edit it as your own.</p>
        {community === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : communityRows.length === 0 ? (
          <EmptyRow>{community.length === 0 ? "No public files yet." : "No public files match your search."}</EmptyRow>
        ) : (
          <ul className="divide-y rounded-md border">
            {communityRows.map(({ item, depth }) => (
              <SharedFileRow key={item.id} item={item} depth={depth} isOwner={false} busy={busy === item.id} onOpen={() => open(item)} onCopy={() => copy(item)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

function DemoBanner({ email }: { email: string }) {
  const [resetting, setResetting] = useState(false)
  if (!isDemoAccountEmail(email)) return null
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-center gap-3 py-3 text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">
          You&apos;re browsing as <strong>{DEMO_ACCOUNT.name}</strong>, a shared demo account. Everything here is sample content other visitors can also change.
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={resetting}
          onClick={async () => {
            if (!window.confirm("Reset the demo account's documents, flows, and shared files back to the sample set?")) return
            setResetting(true)
            try {
              await signInAsDemoAccount({ reset: true })
              toast.success("Demo data reset.")
              window.location.reload()
            } catch (error) {
              toast.error(errorMessage(error, "Could not reset the demo data."))
              setResetting(false)
            }
          }}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" /> {resetting ? "Resetting…" : "Reset demo data"}
        </Button>
      </CardContent>
    </Card>
  )
}

function SignedOutCard() {
  const [starting, setStarting] = useState(false)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign in to manage your library</CardTitle>
        <CardDescription>Documents, saved flows, and shared files follow your account across devices once you sign in. You can still browse the community library below.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/login?callbackURL=%2Flibrary">Sign in</Link>
        </Button>
        <Button
          variant="secondary"
          disabled={starting}
          onClick={async () => {
            setStarting(true)
            try {
              await signInAsDemoAccount()
              window.location.reload()
            } catch (error) {
              toast.error(errorMessage(error, "The demo account isn't available right now."))
              setStarting(false)
            }
          }}
        >
          <Sparkles className="mr-1.5 h-4 w-4" /> {starting ? "Opening the demo…" : "Try the demo account"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function LibraryPageContent() {
  const { user, isAuthenticated, isLoading } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get("tab")
  const tab: LibraryTab = TABS.includes(requested as LibraryTab) ? (requested as LibraryTab) : "documents"

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 pb-24">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <Link
            href="/tools"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            aria-label="Back to tools"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every document, saved flow, and shared file linked to your account — plus the community&apos;s shared library.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {isAuthenticated && user ? <DemoBanner email={user.email} /> : <SignedOutCard />}
            <Tabs value={tab} onValueChange={(next) => router.replace(`/library?tab=${next}`)}>
              <TabsList className="mb-2">
                <TabsTrigger value="documents"><FileText className="h-4 w-4" /> Documents</TabsTrigger>
                <TabsTrigger value="flows"><ListTree className="h-4 w-4" /> Flows</TabsTrigger>
                <TabsTrigger value="shared"><Share2 className="h-4 w-4" /> Shared Files</TabsTrigger>
              </TabsList>
              <TabsContent value="documents"><DocumentsTab isAuthenticated={isAuthenticated} /></TabsContent>
              <TabsContent value="flows"><FlowsTab isAuthenticated={isAuthenticated} /></TabsContent>
              <TabsContent value="shared"><SharedFilesTab isAuthenticated={isAuthenticated} userId={user?.id ?? null} /></TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
