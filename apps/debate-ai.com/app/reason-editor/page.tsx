"use client"

/**
 * Native REASON editor route — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FilePlus2, FileText, Loader2, Trash2 } from "lucide-react"
import { EditorWithToolbar } from "debate-editor"
import { cn } from "debate-ui/src/lib/utils"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { ScrollArea } from "debate-ui/src/primitives/scroll-area"

interface ReasonDocument {
  id: number
  title: string
  content: string
  updatedAt: string | number
}

const AUTOSAVE_DELAY_MS = 800

export default function ReasonEditorPage() {
  const [documents, setDocuments] = useState<ReasonDocument[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = useMemo(
    () => documents.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId],
  )

  const loadDocuments = useCallback(async (selectFirst = false) => {
    setLoading(true)
    try {
      const res = await fetch("/api/doc/documents")
      const rows: ReasonDocument[] = await res.json()
      setDocuments(rows)
      if (selectFirst && rows.length > 0) setSelectedId(rows[0].id)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments(true)
  }, [loadDocuments])

  const createDocument = useCallback(async () => {
    const res = await fetch("/api/doc/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled", content: "" }),
    })
    const created: ReasonDocument = await res.json()
    setDocuments((prev) => [created, ...prev])
    setSelectedId(created.id)
  }, [])

  const deleteDocument = useCallback(
    async (id: number) => {
      await fetch(`/api/doc/documents/${id}`, { method: "DELETE" })
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      if (selectedId === id) setSelectedId(null)
    },
    [selectedId],
  )

  const saveDocument = useCallback((id: number, patch: { title?: string; content?: string }) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/doc/documents/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        })
      } finally {
        setSaving(false)
      }
    }, AUTOSAVE_DELAY_MS)
  }, [])

  const updateTitle = useCallback(
    (id: number, title: string) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, title } : d)))
      saveDocument(id, { title })
    },
    [saveDocument],
  )

  const updateContent = useCallback(
    (id: number, content: string) => {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, content } : d)))
      saveDocument(id, { content })
    },
    [saveDocument],
  )

  return (
    <div className="h-screen flex pt-14 lg:pt-0 pb-20 lg:pb-0">
      <aside className="w-64 shrink-0 border-r flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h2 className="text-sm font-semibold">Reason Editor</h2>
          <Button size="icon" variant="ghost" onClick={createDocument} title="New document">
            <FilePlus2 className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No documents yet. Create one to get started.
            </p>
          ) : (
            <ul className="p-1">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => setSelectedId(doc.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm truncate",
                      doc.id === selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{doc.title || "Untitled"}</span>
                    <Trash2
                      className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteDocument(doc.id)
                      }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b">
              <Input
                value={selected.title}
                onChange={(e) => updateTitle(selected.id, e.target.value)}
                className="max-w-sm h-8 text-sm font-medium"
                placeholder="Untitled"
              />
              {saving && <span className="text-xs text-muted-foreground">Saving…</span>}
            </div>
            <div className="flex-1 overflow-auto">
              <EditorWithToolbar
                key={selected.id}
                content={selected.content}
                contentKey={String(selected.id)}
                title={selected.title}
                showAiTools
                showOutline
                onChange={(html) => updateContent(selected.id, html)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {documents.length === 0 ? "Create a document to start writing." : "Select a document."}
          </div>
        )}
      </div>
    </div>
  )
}
