/**
 * @fileoverview Dialog components for video card actions (report and hide)
 *
 * The report dialog used to be a single free-text box, and by far the most
 * common thing typed into it was that a video is filed in the wrong place —
 * a college round shelved as high school, a kritik lecture under novice. As
 * prose that is a research task for whoever reads it: find the video, work
 * out which category the reporter meant, then apply it. So "miscategorized"
 * is now a reason of its own that collects the correction itself — the
 * format, the lecture category, or the competition level — from the same
 * lists the library files videos under, and an admin gets an answer rather
 * than a description.
 */

"use client"

import React, { useState } from "react"
import { Flag } from "lucide-react"
import { LECTURE_CATEGORIES } from "debate-data-sync/src/youtube/parsers/lecture-classifier"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../ui/primitives/dialog"
import { Button } from "../../ui/primitives/button"
import { Textarea } from "../../ui/primitives/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/primitives/select"
import { saveVideoReport } from "../../state/videoLibrary"

/** What a report can be about. Matches the API's own `kind` values. */
const REPORT_REASONS = [
  { value: "miscategorized", label: "It is in the wrong category" },
  { value: "unavailable", label: "The video does not play" },
  { value: "metadata", label: "Wrong teams, tournament or round" },
  { value: "quality", label: "Poor quality or wrong content" },
  { value: "other", label: "Something else" },
] as const

/** Is the video a round, or a lecture? Decides which correction to ask for. */
const VIDEO_SHAPES = [
  { value: "round", label: "A competitive round" },
  { value: "lecture", label: "A lecture or other video" },
] as const

/** Numeric debate styles, matching `videos.style`. */
const STYLE_OPTIONS = [
  { value: "1", label: "Policy" },
  { value: "2", label: "PF" },
  { value: "3", label: "LD" },
  { value: "4", label: "College" },
] as const

/** Competition levels a miscategorised round can be moved between. */
const ROUND_LEVEL_OPTIONS = [
  { value: "college", label: "College" },
  { value: "high-school", label: "High school" },
  { value: "middle-school", label: "Middle school" },
] as const

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
  title: string
}

export function ReportDialog({ open, onOpenChange, videoId, title }: ReportDialogProps) {
  const [reason, setReason] = useState<string>("miscategorized")
  const [shape, setShape] = useState<string>("round")
  const [style, setStyle] = useState<string>("")
  const [roundLevel, setRoundLevel] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [reportText, setReportText] = useState("")
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMiscategorized = reason === "miscategorized"
  const hasCorrection = isMiscategorized && (shape === "round" ? !!style || !!roundLevel : !!category)
  // Every other reason needs words; a miscategorisation can be filed by
  // picking the category alone, which is the whole point of the dropdowns.
  const canSubmit = hasCorrection || !!reportText.trim()

  const reset = () => {
    setReportText("")
    setReportSubmitted(false)
    setError(null)
    setStyle("")
    setRoundLevel("")
    setCategory("")
  }

  const handleReport = async () => {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    const correction = isMiscategorized
      ? {
          suggestedStyle: shape === "round" && style ? Number(style) : null,
          suggestedRoundLevel: shape === "round" ? roundLevel || null : null,
          suggestedCategory: shape === "lecture" ? category || null : null,
        }
      : {}

    // The local store keeps the report against the reporter's own library, as
    // it always has; the API is what makes it reach an admin.
    saveVideoReport({ videoId, title, report: reportText })

    try {
      const res = await fetch("/api/video-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          title,
          kind: reason,
          issue: reportText.trim(),
          ...correction,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || "Could not send that report")
      }
      setReportSubmitted(true)
      setTimeout(() => {
        onOpenChange(false)
        reset()
      }, 1500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-orange-500" />
            Report issue
          </DialogTitle>
        </DialogHeader>
        {reportSubmitted ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Thanks — report submitted.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              What is wrong with <span className="font-medium text-foreground">{title}</span>?
            </p>

            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isMiscategorized && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium text-foreground">Where does it belong?</p>

                <Select
                  value={shape}
                  onValueChange={(value) => {
                    setShape(value)
                    setStyle("")
                    setRoundLevel("")
                    setCategory("")
                  }}
                >
                  <SelectTrigger aria-label="Round or lecture">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_SHAPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {shape === "round" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger aria-label="Correct format">
                        <SelectValue placeholder="Format" />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={roundLevel} onValueChange={setRoundLevel}>
                      <SelectTrigger aria-label="Correct level">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUND_LEVEL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger aria-label="Correct lecture category">
                      <SelectValue placeholder="Lecture category" />
                    </SelectTrigger>
                    <SelectContent>
                      {LECTURE_CATEGORIES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <Textarea
              placeholder={
                isMiscategorized
                  ? "Anything else worth knowing (optional)"
                  : "Describe the issue..."
              }
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              className="min-h-[80px]"
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleReport} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Sending..." : "Submit"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface HideConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  videoId: string
  title: string
}

export function HideConfirmDialog({ open, onOpenChange, onConfirm, videoId, title }: HideConfirmDialogProps) {
  const [issueText, setIssueText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleHide = async () => {
    setIsSubmitting(true)

    // Submit issue to API if there's text
    if (issueText.trim()) {
      try {
        await fetch('/api/video-issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            title,
            kind: "other",
            issue: issueText.trim(),
          })
        })
      } catch (error) {
        console.error('Failed to submit issue:', error)
      }
    }

    onConfirm()
    onOpenChange(false)
    setIssueText("")
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hide this video?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          This video will be hidden from the list. You can still find it by searching, and unhide it from the menu.
        </p>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            What's wrong with this video? (optional)
          </label>
          <Textarea
            placeholder="Wrong category, broken link, poor quality, inappropriate content..."
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleHide}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Hiding..." : "Hide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}