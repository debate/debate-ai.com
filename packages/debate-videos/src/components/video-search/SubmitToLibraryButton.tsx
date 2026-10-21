/**
 * @fileoverview The plus button beside the library's search bar, and the
 * dialog it opens: submit a video, or a YouTube channel to subscribe to.
 *
 * Nothing is added straight to the library. A submission is filed to
 * `/api/video-issues` as a `submit-video` or `submit-channel` report, which
 * lands in the moderators' review queue on the admin panel — "Add to library"
 * or "Subscribe" there is what publishes it. The library plays everything
 * from YouTube, so "your own video" is a YouTube link to it.
 */

"use client"

import React, { useState } from "react"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/primitives/dialog"
import { Button } from "../../ui/primitives/button"
import { Input } from "../../ui/primitives/input"
import { Textarea } from "../../ui/primitives/textarea"
import { Tabs, TabsList, TabsTrigger } from "../../ui/primitives/tabs"

/** What is being submitted. Matches the API's `kind` values. */
type SubmissionKind = "submit-video" | "submit-channel"

/** Copy for each tab. */
const COPY: Record<SubmissionKind, { label: string; placeholder: string; hint: string }> = {
  "submit-video": {
    label: "YouTube video link",
    placeholder: "https://www.youtube.com/watch?v=…",
    hint: "Upload your round or lecture to YouTube (unlisted works), then paste its link.",
  },
  "submit-channel": {
    label: "YouTube channel link or @handle",
    placeholder: "https://www.youtube.com/@YourChannel",
    hint: "Once approved, new videos from this channel are pulled into the library automatically.",
  },
}

/**
 * Renders the plus icon button and owns its submission dialog.
 */
export function SubmitToLibraryButton() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<SubmissionKind>("submit-video")
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setUrl("")
    setTitle("")
    setNote("")
    setSubmitted(false)
    setError(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!url.trim() || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/video-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          url: url.trim(),
          note: note.trim(),
          ...(kind === "submit-video" && title.trim() ? { title: title.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || "Could not send that submission")
      }
      setSubmitted(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const copy = COPY[kind]

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Submit a video or channel"
        title="Submit a video or channel"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to the library</DialogTitle>
            <DialogDescription>
              Submissions go to the moderators, who add them once they&apos;re approved.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Thanks, it&apos;s in the moderators&apos; queue.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={reset}>
                Submit another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Tabs
                value={kind}
                onValueChange={(value) => {
                  setKind(value as SubmissionKind)
                  setError(null)
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="submit-video">Video</TabsTrigger>
                  <TabsTrigger value="submit-channel">Channel</TabsTrigger>
                </TabsList>
              </Tabs>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{copy.label}</span>
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={copy.placeholder}
                  autoFocus
                  required
                />
                <span className="text-xs text-muted-foreground">{copy.hint}</span>
              </label>

              {kind === "submit-video" && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Title (optional)</span>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Taken from YouTube when left blank"
                  />
                </label>
              )}

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Note for the moderators (optional)</span>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Tournament, round, teams, or why it belongs here"
                  rows={3}
                />
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="submit" disabled={!url.trim() || isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Submit for review"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
