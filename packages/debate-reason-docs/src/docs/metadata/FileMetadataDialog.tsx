"use client"

/**
 * @fileoverview "Edit details" for one of your files: the publication
 * details the sidebar's file note shows — author, the research publisher it
 * is published under, research group, student authors, seasons, publication
 * date and a short summary.
 *
 * The publisher picker lists the publishers the reader runs, and "New
 * publisher…" creates one in place (name, group and monthly subscription
 * price) so a file can be published under it without leaving the editor. The
 * publisher's full page — members, description, subscribers — is edited on
 * that page.
 *
 * Saves through `PUT /api/doc/documents/<id>/metadata`.
 *
 * @module docs/metadata/FileMetadataDialog
 */

import { useEffect, useState } from "react"
import { Loader2, Plus, Save } from "lucide-react"
import { toast } from "sonner"
import {
  dollarsToCents,
  formatSubscriptionPrice,
  parseStudentList,
  validateSubscriptionPrice,
  type FileMetadataResponse,
  type PublisherSummary,
} from "@debate-ai/file-market"
import { createPublisher, fetchFileMetadata, saveFileMetadata } from "@debate-ai/file-market/client"
import { Button } from "../../ui/primitives/button"
import { Input } from "../../ui/primitives/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/primitives/dialog"

export interface FileMetadataDialogProps {
  /** The file whose details to edit; `null` keeps the dialog closed. */
  documentId: number | null
  /** Shown in the title. */
  title?: string
  onClose: () => void
  /** Called with the saved details. */
  onSaved?: (saved: FileMetadataResponse) => void
}

const NEW_PUBLISHER = "__new__"

const TEXTAREA =
  "min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function FileMetadataDialog({ documentId, title, onClose, onSaved }: FileMetadataDialogProps) {
  const [loaded, setLoaded] = useState<FileMetadataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [author, setAuthor] = useState("")
  const [publisherId, setPublisherId] = useState<string>("")
  const [researchGroup, setResearchGroup] = useState("")
  const [students, setStudents] = useState("")
  const [years, setYears] = useState("")
  const [publishedOn, setPublishedOn] = useState("")
  const [summary, setSummary] = useState("")
  const [publishers, setPublishers] = useState<PublisherSummary[]>([])

  const [newName, setNewName] = useState("")
  const [newPrice, setNewPrice] = useState("0")

  useEffect(() => {
    setLoaded(null)
    setError(null)
    if (documentId == null) return
    let cancelled = false
    fetchFileMetadata(documentId)
      .then((response) => {
        if (cancelled) return
        const { metadata } = response
        setLoaded(response)
        setAuthor(metadata.author)
        setPublisherId(metadata.publisherId ?? "")
        setResearchGroup(metadata.researchGroup)
        setStudents(metadata.students.join("\n"))
        setYears(metadata.years)
        setPublishedOn(metadata.publishedOn)
        setSummary(metadata.summary)
        setPublishers(response.ownPublishers)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this file's details.")
      })
    return () => {
      cancelled = true
    }
  }, [documentId])

  const creating = publisherId === NEW_PUBLISHER
  const priceCents = creating ? dollarsToCents(newPrice) : 0
  const priceCheck = validateSubscriptionPrice(priceCents)
  const canSave = loaded !== null && !busy && (!creating || (newName.trim().length > 0 && priceCheck.ok))

  const save = async () => {
    if (documentId == null || !canSave) return
    setBusy(true)
    try {
      let chosen: string | null = publisherId || null
      if (creating) {
        const created = await createPublisher({
          name: newName.trim(),
          description: "",
          researchGroup: researchGroup.trim(),
          students: parseStudentList(students),
          years: years.trim(),
          website: "",
          priceCents: priceCheck.ok ? priceCheck.value : 0,
        })
        chosen = created.id
        setPublishers((prev) => [...prev, created])
        setPublisherId(created.id)
      }
      const saved = await saveFileMetadata(documentId, {
        author: author.trim(),
        publisherId: chosen,
        researchGroup: researchGroup.trim(),
        students: parseStudentList(students),
        years: years.trim(),
        publishedOn,
        summary: summary.trim(),
      })
      toast.success("Saved this file's details.")
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this file's details.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={documentId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle className="break-words">Details of “{title || "Untitled"}”</DialogTitle>
          <DialogDescription>
            Who wrote and published this file. Publishing it under a research publisher lists it on that
            publisher's page, where readers can subscribe.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !loaded ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Field label="Author">
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Who wrote it" />
              </Field>

              <Field label="Published by" hint="A research publisher you run. Its page lists this file.">
                <select
                  aria-label="Publisher"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"
                  value={publisherId}
                  onChange={(e) => setPublisherId(e.target.value)}
                >
                  <option value="">Not published</option>
                  {publishers.map((publisher) => (
                    <option key={publisher.id} value={publisher.id}>
                      {publisher.name} ({formatSubscriptionPrice(publisher.priceCents)})
                    </option>
                  ))}
                  <option value={NEW_PUBLISHER}>New publisher…</option>
                </select>
              </Field>

              {creating && (
                <div className="flex flex-col gap-3 rounded-md border border-dashed p-3">
                  <Field label="Publisher name">
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Westwood Research Lab" />
                  </Field>
                  <Field
                    label="Monthly subscription (USD)"
                    hint={priceCheck.ok ? "0 makes subscribing free. Subscribers can save every file you publish." : priceCheck.error}
                  >
                    <Input
                      inputMode="decimal"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      aria-label="Monthly subscription price in US dollars"
                      aria-invalid={!priceCheck.ok}
                    />
                  </Field>
                </div>
              )}

              <Field label="Research group">
                <Input value={researchGroup} onChange={(e) => setResearchGroup(e.target.value)} placeholder="Team, school or lab" />
              </Field>

              <Field label="Students" hint="One name per line, or separated by commas.">
                <textarea className={TEXTAREA} value={students} onChange={(e) => setStudents(e.target.value)} aria-label="Students" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Years">
                  <Input value={years} onChange={(e) => setYears(e.target.value)} placeholder="2025–2026" />
                </Field>
                <Field label="Published on">
                  <Input type="date" value={publishedOn} onChange={(e) => setPublishedOn(e.target.value)} />
                </Field>
              </div>

              <Field label="Summary">
                <textarea
                  className={TEXTAREA}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  aria-label="Summary"
                  placeholder="What the file covers"
                />
              </Field>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void save()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : creating ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {creating ? "Create publisher and save" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
