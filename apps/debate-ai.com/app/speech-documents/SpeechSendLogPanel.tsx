"use client"

/**
 * @fileoverview Client component backing `/speech-documents` — a live
 * history of everything the Reason Editor has actually sent into the
 * designated speech document via CardMirror's send-to-speech commands
 * (mark a pane as the speech doc, then the backtick / Alt-backtick
 * shortcuts, or the ribbon's "Send to Speech" buttons).
 *
 * This replaces the prior panel here, which read the OLD `reason-editor`
 * (TipTap) package's `Mod-Shift-S` / "→Speech"-button flow — a command
 * that no longer exists in the live CardMirror-based `/reason-editor`
 * route, so that panel could never show anything a user actually did.
 * `speechSendLogStore` (from `debate-editor`'s headless
 * `/engine` entry point — no ProseMirror or React pulled in here) is
 * populated by the real `insertSpeechSlice` call point instead, so this
 * page now reflects what actually happened in the live editor.
 *
 * @module app/speech-documents/SpeechSendLogPanel
 */

import { useEffect, useState } from "react"
import { Send, Trash2 } from "lucide-react"
import {
  speechSendLogStore,
  type SpeechSendLogEntry,
} from "debate-editor/engine"
import { Button } from "../../lib/ui/primitives/button"
import { EmptyState } from "../../lib/ui/panels/panel-shell"
import { useSpeechSendLogSync } from "@/lib/hooks/useSpeechSendLogSync"

function formatSentAt(sentAt: number): string {
  try {
    return new Date(sentAt).toLocaleString()
  } catch {
    return ""
  }
}

export function SpeechSendLogPanel() {
  const [entries, setEntries] = useState<SpeechSendLogEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const { synced, removeEntry, clearAll } = useSpeechSendLogSync()

  useEffect(() => {
    let cancelled = false
    void speechSendLogStore.init().then(() => {
      if (cancelled) return
      setEntries(speechSendLogStore.list())
      setLoaded(true)
    })
    const unsubscribe = speechSendLogStore.subscribe((next) => {
      if (!cancelled) setEntries(next)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const newestFirst = [...entries].reverse()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Speech Documents</h1>
        {entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
          >
            Clear history
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-1">
        A history of everything sent into your designated speech document
        from the Reason Editor. Open{" "}
        <a href="/reason-editor" className="underline underline-offset-2">
          Reason Editor
        </a>
        , mark a document as the speech doc (File menu → Speech → "Mark /
        Unmark Active Doc as the Speech Doc"), then send a selection or
        card with the backtick (`) key — or Alt-backtick to send at the
        end — from any other open document.
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        {synced ? "This history is synced to your account." : "Sign in to sync this history to your account."}
      </p>

      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : newestFirst.length === 0 ? (
        <EmptyState
          title="Nothing sent yet."
          message="Mark a document as the speech doc, then press the backtick key with a selection (or your cursor in a card) in another open document."
          icon={<Send className="h-4 w-4" />}
        />
      ) : (
        <ul className="space-y-3">
          {newestFirst.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-border p-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatSentAt(entry.sentAt)}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5">
                    {entry.atEnd ? "sent to end" : "sent at cursor"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  aria-label="Remove entry"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{entry.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
