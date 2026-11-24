"use client"

/**
 * @fileoverview The Settings footer's Feedback dialog: an email and a
 * free-length message, sent to `POST /api/feedback` and read on the admin
 * page's Feedback tab. The server allows one submission an hour.
 */

import { useEffect, useState, type FormEvent } from "react"
import { usePathname } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { Button } from "../../ui/primitives/button"
import { Input } from "../../ui/primitives/input"
import { Label } from "../../ui/primitives/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/primitives/dialog"
import { useSession } from "../../lib/hooks/useSession"
import { isFeedbackEmail, MAX_FEEDBACK_LENGTH } from "../../lib/feedback/feedback"

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useSession()
  const pathname = usePathname()
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)

  // Fill in a signed-in reader's address, without overwriting what they typed.
  useEffect(() => {
    if (open && !email && user?.email) setEmail(user.email)
  }, [open, email, user?.email])

  // A fresh form each time the dialog opens after a send.
  useEffect(() => {
    if (open && status === "sent") {
      setStatus("idle")
      setMessage("")
    }
    if (open) setError(null)
    // Runs on open only: resetting on a status change would hide the thank-you.
  }, [open])

  const canSend = isFeedbackEmail(email.trim()) && message.trim().length > 0 && status !== "sending"

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSend) return
    setStatus("sending")
    setError(null)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), message, page: pathname }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Could not send your feedback. Please try again.")
      setStatus("sent")
    } catch (err) {
      setError((err as Error).message)
      setStatus("idle")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <DialogTitle>Thanks for the feedback</DialogTitle>
            <DialogDescription>We read every message. You can send more in an hour.</DialogDescription>
            <Button className="mt-2" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Send feedback</DialogTitle>
              <DialogDescription>
                Ideas, bugs, anything. Write as much as you like — we&apos;ll reply by email if needed.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback-email">Email</Label>
              <Input
                id="feedback-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="feedback-message">Feedback</Label>
              <textarea
                id="feedback-message"
                required
                value={message}
                maxLength={MAX_FEEDBACK_LENGTH}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                placeholder="What should we know?"
                className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-40 max-h-[50vh] w-full resize-y rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSend}>
                {status === "sending" ? "Sending…" : "Send feedback"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
