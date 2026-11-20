"use client"

/**
 * @fileoverview The small "About this file" note under the docs sidebar's
 * file tree: the open file's publication details — author, publisher,
 * research group, student authors, seasons and publication date — with the
 * publisher's name linking to its page (`/research/publishers/<slug>`), where
 * readers can subscribe.
 *
 * "Edit details" opens `FileMetadataDialog`. A file with no details yet shows
 * just that button, so the note stays quiet until someone fills it in.
 *
 * @module docs/metadata/FileMetadataNote
 */

import { useEffect, useState } from "react"
import { BookUser, Building2, CalendarDays, Pencil, Users } from "lucide-react"
import { formatSubscriptionPrice, publisherHref, type FileMetadataResponse } from "@debate-ai/file-market"
import { fetchFileMetadata } from "@debate-ai/file-market/client"
import { cn } from "../../ui/lib/utils"
import { FileMetadataDialog } from "./FileMetadataDialog"

export interface FileMetadataNoteProps {
  documentId: number
  title: string
  className?: string
}

/** `"2026-03-14"` → `"Mar 14, 2026"`; anything else as typed. */
export function formatPublishedOn(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/** Whether a file has any details worth showing. */
export function hasFileDetails(details: FileMetadataResponse | null): boolean {
  if (!details) return false
  const m = details.metadata
  return Boolean(
    m.author || details.publisher || m.researchGroup || m.students.length || m.years || m.publishedOn || m.summary,
  )
}

export function FileMetadataNote({ documentId, title, className }: FileMetadataNoteProps) {
  const [details, setDetails] = useState<FileMetadataResponse | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setDetails(null)
    let cancelled = false
    fetchFileMetadata(documentId)
      .then((response) => {
        if (!cancelled) setDetails(response)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [documentId])

  const m = details?.metadata
  const dates = [m?.years, m?.publishedOn ? formatPublishedOn(m.publishedOn) : ""].filter(Boolean).join(" · ")

  return (
    <section
      className={cn("shrink-0 rounded-md border bg-muted/30 px-3 py-2 text-xs", className)}
      aria-label="About this file"
      data-testid="file-metadata-note"
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-foreground">About this file</span>
        {details?.canEdit !== false && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto inline-flex items-center gap-1 rounded px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Edit details
          </button>
        )}
      </div>

      {details && hasFileDetails(details) && m ? (
        <dl className="mt-1.5 space-y-1 text-muted-foreground">
          {m.author && (
            <div className="flex items-start gap-1.5">
              <BookUser className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Author</dt>
              <dd className="min-w-0 break-words">By {m.author}</dd>
            </div>
          )}
          {details.publisher && (
            <div className="flex items-start gap-1.5">
              <Building2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Published by</dt>
              <dd className="min-w-0 break-words">
                Published by{" "}
                <a
                  href={publisherHref(details.publisher.slug)}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  title={`Open ${details.publisher.name}'s page · ${formatSubscriptionPrice(details.publisher.priceCents)}`}
                >
                  {details.publisher.name}
                </a>
              </dd>
            </div>
          )}
          {(m.researchGroup || m.students.length > 0) && (
            <div className="flex items-start gap-1.5">
              <Users className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Research group</dt>
              <dd className="min-w-0 break-words">
                {m.researchGroup}
                {m.researchGroup && m.students.length > 0 ? ": " : ""}
                {m.students.join(", ")}
              </dd>
            </div>
          )}
          {dates && (
            <div className="flex items-start gap-1.5">
              <CalendarDays className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Dates</dt>
              <dd>{dates}</dd>
            </div>
          )}
          {m.summary && <p className="line-clamp-3 break-words pt-0.5">{m.summary}</p>}
        </dl>
      ) : details ? (
        <p className="mt-1 text-muted-foreground">No author or publisher yet.</p>
      ) : null}

      <FileMetadataDialog
        documentId={editing ? documentId : null}
        title={title}
        onClose={() => setEditing(false)}
        onSaved={setDetails}
      />
    </section>
  )
}
