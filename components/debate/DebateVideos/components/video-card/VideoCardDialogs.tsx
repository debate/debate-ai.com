"use client"

import React, { useState } from "react"
import { Flag } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoId: string
  title: string
}

export function ReportDialog({ open, onOpenChange, videoId, title }: ReportDialogProps) {
  const [reportText, setReportText] = useState("")
  const [reportSubmitted, setReportSubmitted] = useState(false)

  const handleReport = () => {
    try {
      const existing = JSON.parse(localStorage.getItem("debateVideoReports") || "[]")
      existing.push({ videoId, title, report: reportText, date: new Date().toISOString() })
      localStorage.setItem("debateVideoReports", JSON.stringify(existing))
    } catch { }
    setReportSubmitted(true)
    setTimeout(() => {
      onOpenChange(false)
      setReportText("")
      setReportSubmitted(false)
    }, 1500)
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
              Describe the issue with <span className="font-medium text-foreground">{title}</span>:
            </p>
            <Textarea
              placeholder="Wrong category, broken link, inappropriate content..."
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              className="min-h-[80px]"
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleReport} disabled={!reportText.trim()}>Submit</Button>
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
            issue: issueText.trim(),
            timestamp: new Date().toISOString()
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